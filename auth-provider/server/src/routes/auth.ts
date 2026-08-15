import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { verifyPassword } from '../utils/hash';
import { generateTotpSecret, getTotpAuthUrl, verifyTotp, generateRecoveryCodes, hashRecoveryCode } from '../utils/totp';

const router=express.Router();

function hashSessionToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /api/auth/login
router.post('/login',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{email,password}=req.body;
    if(!email||!password){
        return res.status(400).json({success:false,error:'Email and password are required'});
    }
    try{
        const user=await prisma.user.findUnique({where:{email}});
        if(!user||user.status!=='active'){
            return res.status(401).json({success:false,error:'Invalid email or password'});
        }
        const isPasswordValid=verifyPassword(password,user.password_hash);
        if(!isPasswordValid){
            return res.status(401).json({success:false,error:'Invalid email or password'});
        }

        // Check if MFA is enabled for this user
        if(user.mfa_enabled){
            const mfaToken=crypto.randomBytes(32).toString('hex');
            const expires_at=new Date(Date.now()+5*60*1000); // 5 minutes expiration
            await prisma.mfaPendingSession.create({
                data:{
                    user_id:user.id,
                    token:mfaToken,
                    expires_at,
                }
            });
            await prisma.auditLog.create({
                data:{
                    event_type:'mfa_pending',
                    actor_id:user.id,
                    user_id:user.id,
                    result:'pending',
                    metadata:JSON.stringify({reason:'Password valid, awaiting 2FA code'}),
                    ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string | null,
                }
            });
            return res.json({
                success:true,
                mfa_required:true,
                mfa_token:mfaToken,
                message:'Password verified. Please submit your 6-digit TOTP or recovery code.'
            });
        }

        const rawSessionToken=crypto.randomBytes(32).toString('hex');
        const session_token_hash=hashSessionToken(rawSessionToken);
        const expires_at=new Date(Date.now()+24*60*60*1000); // expired dalam 24 Jam
        const ip_address=(req.ip||req.headers['x-forwarded-for']||null) as string | null;
        const user_agent=(req.headers['user-agent']||null) as string | null;
        await prisma.ssoSession.create({
            data:{
                user_id:user.id,
                session_token_hash,
                status:'active',
                expires_at,
                ip_address,
                user_agent,
            },
        });
        res.cookie('sso_session',rawSessionToken,{
            httpOnly:true,
            secure:process.env.NODE_ENV==='production',
            sameSite:'lax',
            maxAge:24*60*60*1000,
            path:'/',
        });
        res.json({
            success:true,
            message:'Login successful',
            data:{
                id:user.id,
                name:user.name,
                email:user.email,
            },
        });
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/auth/login/mfa - Verification step 2 for MFA enabled accounts
router.post('/login/mfa',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{mfa_token,code}=req.body;
    if(!mfa_token||!code){
        return res.status(400).json({success:false,error:'mfa_token and 6-digit TOTP code/recovery code are required'});
    }

    try{
        const pendingSession=await prisma.mfaPendingSession.findUnique({
            where:{token:mfa_token},
            include:{user:true}
        });

        if(!pendingSession||pendingSession.expires_at<new Date()){
            return res.status(401).json({success:false,error:'Invalid or expired MFA session'});
        }

        const user=pendingSession.user;
        let isCodeValid=false;
        let isRecoveryCode=false;

        // 1. Verify TOTP code
        if(user.mfa_secret && verifyTotp(String(code).trim(),user.mfa_secret)){
            isCodeValid=true;
        }else if(user.mfa_recovery_codes){
            // 2. Check if it's a recovery code
            const inputHash=hashRecoveryCode(String(code).trim());
            let recoveryList: string[]=[];
            try{
                recoveryList=JSON.parse(user.mfa_recovery_codes);
            }catch(e){
                recoveryList=[];
            }

            const codeIdx=recoveryList.indexOf(inputHash);
            if(codeIdx!==-1){
                isCodeValid=true;
                isRecoveryCode=true;
                // Remove used recovery code
                recoveryList.splice(codeIdx,1);
                await prisma.user.update({
                    where:{id:user.id},
                    data:{mfa_recovery_codes:JSON.stringify(recoveryList)}
                });
            }
        }

        if(!isCodeValid){
            await prisma.auditLog.create({
                data:{
                    event_type:'mfa_failed',
                    actor_id:user.id,
                    user_id:user.id,
                    result:'failed',
                    metadata:JSON.stringify({reason:'Invalid TOTP token or recovery code'}),
                    ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string | null,
                }
            });
            return res.status(401).json({success:false,error:'Invalid TOTP token or recovery code'});
        }

        // Delete pending MFA session
        await prisma.mfaPendingSession.delete({where:{id:pendingSession.id}});

        // Issue Central SSO Session
        const rawSessionToken=crypto.randomBytes(32).toString('hex');
        const session_token_hash=hashSessionToken(rawSessionToken);
        const expires_at=new Date(Date.now()+24*60*60*1000);
        const ip_address=(req.ip||req.headers['x-forwarded-for']||null) as string | null;
        const user_agent=(req.headers['user-agent']||null) as string | null;

        await prisma.ssoSession.create({
            data:{
                user_id:user.id,
                session_token_hash,
                status:'active',
                expires_at,
                ip_address,
                user_agent,
            },
        });

        await prisma.auditLog.create({
            data:{
                event_type:'mfa_success',
                actor_id:user.id,
                user_id:user.id,
                result:'success',
                metadata:JSON.stringify({method:isRecoveryCode?'recovery_code':'totp'}),
                ip_address,
            }
        });

        res.cookie('sso_session',rawSessionToken,{
            httpOnly:true,
            secure:process.env.NODE_ENV==='production',
            sameSite:'lax',
            maxAge:24*60*60*1000,
            path:'/',
        });

        res.json({
            success:true,
            message:'MFA authentication successful',
            data:{
                id:user.id,
                name:user.name,
                email:user.email,
            }
        });
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// GET /api/auth/mfa/status
router.get('/mfa/status',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const rawSessionToken=req.cookies?.sso_session;
    if(!rawSessionToken){
        return res.status(401).json({success:false,error:'No central session found'});
    }
    try{
        const session_token_hash=hashSessionToken(rawSessionToken);
        const session=await prisma.ssoSession.findFirst({
            where:{session_token_hash,status:'active',expires_at:{gt:new Date()}},
            include:{user:true}
        });
        if(!session||!session.user){
            return res.status(401).json({success:false,error:'Session invalid'});
        }
        res.json({
            success:true,
            mfa_enabled:session.user.mfa_enabled
        });
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/auth/mfa/setup - Generate secret & recovery codes for TOTP enrollment
router.post('/mfa/setup',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const rawSessionToken=req.cookies?.sso_session;
    if(!rawSessionToken){
        return res.status(401).json({success:false,error:'Authentication required'});
    }
    try{
        const session_token_hash=hashSessionToken(rawSessionToken);
        const session=await prisma.ssoSession.findFirst({
            where:{session_token_hash,status:'active',expires_at:{gt:new Date()}},
            include:{user:true}
        });
        if(!session||!session.user){
            return res.status(401).json({success:false,error:'Session invalid'});
        }

        const secret=generateTotpSecret();
        const otpauth_url=getTotpAuthUrl(session.user.email,secret);
        const{plainCodes,hashedCodes}=generateRecoveryCodes(8);

        res.json({
            success:true,
            data:{
                secret,
                otpauth_url,
                recovery_codes:plainCodes,
                hashed_recovery_codes:hashedCodes,
            }
        });
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/auth/mfa/enable - Confirm TOTP code & activate MFA for account
router.post('/mfa/enable',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const rawSessionToken=req.cookies?.sso_session;
    const{secret,hashed_recovery_codes,code}=req.body;

    if(!rawSessionToken){
        return res.status(401).json({success:false,error:'Authentication required'});
    }
    if(!secret||!hashed_recovery_codes||!code){
        return res.status(400).json({success:false,error:'secret, hashed_recovery_codes, and verification code are required'});
    }

    try{
        const session_token_hash=hashSessionToken(rawSessionToken);
        const session=await prisma.ssoSession.findFirst({
            where:{session_token_hash,status:'active',expires_at:{gt:new Date()}},
            include:{user:true}
        });
        if(!session||!session.user){
            return res.status(401).json({success:false,error:'Session invalid'});
        }

        // Verify the provided TOTP code against secret
        const isValid=verifyTotp(String(code).trim(),secret);
        if(!isValid){
            await prisma.auditLog.create({
                data:{
                    event_type:'mfa_enrolled_failed',
                    actor_id:session.user_id,
                    user_id:session.user_id,
                    result:'failed',
                    metadata:JSON.stringify({reason:'Invalid verification code during setup'}),
                    ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string | null,
                }
            });
            return res.status(400).json({success:false,error:'Invalid TOTP verification code. Setup aborted.'});
        }

        // Save MFA status & details
        await prisma.user.update({
            where:{id:session.user_id},
            data:{
                mfa_enabled:true,
                mfa_secret:secret,
                mfa_recovery_codes:JSON.stringify(hashed_recovery_codes),
            }
        });

        await prisma.auditLog.create({
            data:{
                event_type:'mfa_enrolled',
                actor_id:session.user_id,
                user_id:session.user_id,
                result:'success',
                metadata:JSON.stringify({type:'totp_rfc6238'}),
                ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string | null,
            }
        });

        res.json({
            success:true,
            message:'MFA (TOTP) has been successfully enabled for your account.'
        });
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/auth/mfa/disable - Disable MFA for account
router.post('/mfa/disable',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const rawSessionToken=req.cookies?.sso_session;
    const{code}=req.body;

    if(!rawSessionToken){
        return res.status(401).json({success:false,error:'Authentication required'});
    }
    if(!code){
        return res.status(400).json({success:false,error:'Verification code is required to disable MFA'});
    }

    try{
        const session_token_hash=hashSessionToken(rawSessionToken);
        const session=await prisma.ssoSession.findFirst({
            where:{session_token_hash,status:'active',expires_at:{gt:new Date()}},
            include:{user:true}
        });
        if(!session||!session.user){
            return res.status(401).json({success:false,error:'Session invalid'});
        }

        const user=session.user;
        let isValid=false;
        if(user.mfa_secret && verifyTotp(String(code).trim(),user.mfa_secret)){
            isValid=true;
        }

        if(!isValid){
            return res.status(400).json({success:false,error:'Invalid TOTP code'});
        }

        await prisma.user.update({
            where:{id:user.id},
            data:{
                mfa_enabled:false,
                mfa_secret:null,
                mfa_recovery_codes:null,
            }
        });

        await prisma.auditLog.create({
            data:{
                event_type:'mfa_disabled',
                actor_id:user.id,
                user_id:user.id,
                result:'success',
                ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string | null,
            }
        });

        res.json({
            success:true,
            message:'MFA has been disabled for your account.'
        });
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// GET /api/auth/me
router.get('/me',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const rawSessionToken=req.cookies?.sso_session;
    if(!rawSessionToken){
        return res.status(401).json({success:false,error:'No central session found'});
    }
    try{
        const session_token_hash=hashSessionToken(rawSessionToken);
        const session=await prisma.ssoSession.findFirst({
            where:{
                session_token_hash,
                status:'active',
                expires_at:{gt:new Date()},
            },
            include:{
                user:{
                    select:{
                        id:true,
                        name:true,
                        email:true,
                        status:true,
                        mfa_enabled:true,
                        user_groups:{
                            include:{group:true}
                        }
                    }
                }
            }
        });

        if(!session||!session.user||session.user.status!=='active'){
            return res.status(401).json({success:false,error:'Session expired or invalid'});
        }
        res.json({success:true,data:session.user});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// GET /api/auth/authorize
router.get('/authorize',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{client_id,redirect_uri,state}=req.query;
    if(!client_id||!redirect_uri||!state){
        return res.status(400).json({success:false,error:'client_id, redirect_uri, and state are required'});
    }
    const clientIdStr=String(client_id);
    const redirectUriStr=String(redirect_uri);
    const stateStr=String(state);

    try{
        const app=await prisma.application.findUnique({
            where:{client_id:clientIdStr},
            include:{
                redirect_uris:true,
                group_policies:true,
            },
        });
        if(!app||app.status!=='active'){
            return res.status(400).json({success:false,error:'Invalid or inactive client_id'});
        }
        const isExactMatch=app.redirect_uris.some((r: any)=>r.redirect_uri===redirectUriStr);
        if(!isExactMatch){
            return res.status(400).json({success:false,error:'Invalid redirect_uri (Must be exact match)'});
        }
        const rawSessionToken=req.cookies?.sso_session;
        if(!rawSessionToken){
            return res.status(401).json({success:false,error:'Authentication required. Please login first.'});
        }
        const session_token_hash=hashSessionToken(rawSessionToken);
        const session=await prisma.ssoSession.findFirst({
            where:{
                session_token_hash,
                status:'active',
                expires_at:{gt:new Date()},
            },
            include:{
                user:{
                    include:{
                        user_groups:true,
                    }
                }
            }
        });
        if(!session||!session.user||session.user.status!=='active'){
            return res.status(401).json({success:false,error:'Invalid or expired central session'});
        }
        const userGroupIds=session.user.user_groups.map((ug: any)=>ug.group_id);
        const policies=app.group_policies;
        let isAllowed=true;
        if(policies.length>0){
            const hasDeny=policies.some((p: any)=>p.effect==='deny'&&userGroupIds.includes(p.group_id));
            const hasAllow=policies.some((p: any)=>p.effect==='allow'&&userGroupIds.includes(p.group_id));
            if(hasDeny||!hasAllow){
                isAllowed=false;
            }
        }
        if(!isAllowed){
            await prisma.auditLog.create({
                data:{
                    event_type:'policy_denied',
                    actor_id:session.user_id,
                    user_id:session.user_id,
                    application_id:app.id,
                    session_id:session.id,
                    result:'denied',
                    metadata:JSON.stringify({reason:'User groups do not satisfy application policy',user_groups:userGroupIds}),
                    ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string | null,
                }
            });

            const redirectUrl=new URL(redirectUriStr);
            redirectUrl.searchParams.set('error','access_denied');
            redirectUrl.searchParams.set('error_description','User is not authorized to access this application');
            redirectUrl.searchParams.set('state',stateStr);
            return res.redirect(302,redirectUrl.toString());
        }
        const rawCode=crypto.randomBytes(32).toString('hex');
        const code_hash=crypto.createHash('sha256').update(rawCode).digest('hex');
        const expires_at=new Date(Date.now()+10*60*1000);
        await prisma.authorizationCode.create({
            data:{
                code_hash,
                user_id:session.user_id,
                application_id:app.id,
                sso_session_id:session.id,
                redirect_uri:redirectUriStr,
                expires_at,
            }
        });
        await prisma.auditLog.create({
            data:{
                event_type:'authorization_code_issued',
                actor_id:session.user_id,
                user_id:session.user_id,
                application_id:app.id,
                session_id:session.id,
                result:'granted',
                ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string | null,
            }
        });
        const targetUrl=new URL(redirectUriStr);
        targetUrl.searchParams.set('code',rawCode);
        targetUrl.searchParams.set('state',stateStr);
        return res.redirect(302,targetUrl.toString());
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/auth/token
router.post('/token',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{grant_type,code,client_id,redirect_uri}=req.body;
    if(grant_type!=='authorization_code'||!code||!client_id||!redirect_uri){
        return res.status(400).json({success:false,error:'grant_type must be authorization_code, and code, client_id, redirect_uri are required'});
    }
    try{
        const code_hash=crypto.createHash('sha256').update(code).digest('hex');
        const authCode=await prisma.authorizationCode.findFirst({
            where:{code_hash},
            include:{application:true},
        });
        if(!authCode||authCode.application.client_id!==client_id){
            return res.status(400).json({success:false,error:'Invalid authorization code or client_id'});
        }
        if(authCode.redirect_uri!==redirect_uri){
            return res.status(400).json({success:false,error:'Invalid redirect_uri'});
        }
        if(authCode.expires_at<new Date()){
            return res.status(400).json({success:false,error:'Authorization code has expired'});
        }
        if(authCode.used_at){
            await prisma.auditLog.create({
                data:{
                    event_type:'code_replay_attempt',
                    actor_id:authCode.user_id,
                    user_id:authCode.user_id,
                    application_id:authCode.application_id,
                    session_id:authCode.sso_session_id,
                    result:'denied',
                    metadata:JSON.stringify({reason:'Attempted to reuse authorization code'}),
                    ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string | null,
                }
            });
            return res.status(400).json({success:false,error:'Authorization code already used'});
        }
        await prisma.authorizationCode.update({
            where:{id:authCode.id},
            data:{used_at:new Date()},
        });
        const rawAccessToken=crypto.randomBytes(32).toString('hex');
        const token_hash=crypto.createHash('sha256').update(rawAccessToken).digest('hex');
        const expires_at=new Date(Date.now()+60*60*1000); // access token 1 jam
        await prisma.accessToken.create({
            data:{
                token_hash,
                user_id:authCode.user_id,
                application_id:authCode.application_id,
                sso_session_id:authCode.sso_session_id,
                status:'active',
                expires_at,
            }
        });
        await prisma.auditLog.create({
            data:{
                event_type:'token_issued',
                actor_id:authCode.user_id,
                user_id:authCode.user_id,
                application_id:authCode.application_id,
                session_id:authCode.sso_session_id,
                result:'granted',
                ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string | null,
            }
        });
        res.json({
            access_token:rawAccessToken,
            token_type:'Bearer',
            expires_in:3600,
        });
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// GET /api/auth/userinfo
router.get('/userinfo',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const authHeader=req.headers.authorization;
    if(!authHeader||!authHeader.startsWith('Bearer ')){
        return res.status(401).json({success:false,error:'Missing or invalid Authorization header'});
    }
    const rawAccessToken=authHeader.split(' ')[1];
    try{
        const token_hash=crypto.createHash('sha256').update(rawAccessToken).digest('hex');
        const tokenRecord=await prisma.accessToken.findFirst({
            where:{
                token_hash,
                status:'active',
                expires_at:{gt:new Date()},
            },
            include:{
                user:{
                    select:{
                        id:true,
                        name:true,
                        email:true,
                        status:true,
                        user_groups:{
                            include:{
                                group:true,
                            }
                        }
                    }
                }
            }
        });
        if(!tokenRecord||!tokenRecord.user||tokenRecord.user.status!=='active'){
            return res.status(401).json({success:false,error:'Invalid or expired access token'});
        }
        const user=tokenRecord.user;
        const groups=user.user_groups.map((ug: any)=>ug.group.name);
        res.json({
            sub:user.id,
            name:user.name,
            email:user.email,
            status:user.status,
            groups,
        });
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// ALL /api/auth/logout
router.all('/logout',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const rawSessionToken=req.cookies?.sso_session;
    const redirect_uri=req.query?.redirect_uri||req.body?.redirect_uri;
    if(rawSessionToken){
        try{
            const session_token_hash=hashSessionToken(rawSessionToken);
            const session=await prisma.ssoSession.findFirst({
                where:{session_token_hash,status:'active'},
            });
            if(session){
                await prisma.$transaction(async(tx: any)=>{
                    await tx.ssoSession.update({
                        where:{id:session.id},
                        data:{
                            status:'revoked',
                            revoked_at:new Date(),
                            revoke_reason:'User logged out centrally',
                        },
                    });
                    await tx.auditLog.create({
                        data:{
                            event_type:'sso_logout',
                            actor_id:session.user_id,
                            user_id:session.user_id,
                            session_id:session.id,
                            result:'success',
                            ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string | null,
                        },
                    });
                    await tx.event.create({
                        data:{
                            event_type:'SessionRevoked',
                            user_id:session.user_id,
                            central_session_id:session.id,
                            payload:JSON.stringify({
                                event_type:'SessionRevoked',
                                user_id:session.user_id,
                                central_session_id:session.id,
                                revoked_at:new Date().toISOString(),
                                reason:'User logged out centrally',
                            }),
                            status:'pending',
                        },
                    });
                });
            }
        }catch(e){
            console.error('Logout outbox transaction error:',e);
        }
    }
    res.clearCookie('sso_session',{path:'/'});
    if(redirect_uri){
        return res.redirect(302,String(redirect_uri));
    }
    res.json({success:true,message:'Central SSO session revoked successfully'});
});

// GET /api/auth/mfa-ui - Interactive MFA Setup & Testing UI
router.get('/mfa-ui',(req: Request,res: Response)=>{
    const html=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SSO Provider - Multi-Factor Authentication (MFA / TOTP)</title>
    <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#000000;color:#f8fafc;padding:24px;}
        .container{max-width:800px;margin:0 auto;}
        .header{border-bottom:1px solid #1f1f23;padding-bottom:16px;margin-bottom:24px;}
        .title{font-size:24px;font-weight:700;color:#ffffff;display:flex;align-items:center;gap:10px;}
        .card{background:#121215;border:1px solid #222226;border-radius:12px;padding:24px;margin-bottom:24px;}
        .card-title{font-size:18px;font-weight:600;color:#38bdf8;margin-bottom:12px;}
        .form-group{margin-bottom:16px;}
        label{display:block;font-size:13px;color:#a1a1aa;margin-bottom:6px;font-weight:500;}
        input{width:100%;padding:10px 14px;background:#09090b;border:1px solid #27272a;border-radius:8px;color:#ffffff;font-size:14px;}
        input:focus{outline:none;border-color:#38bdf8;}
        button{padding:10px 18px;background:#0284c7;color:#ffffff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;transition:background 0.2s;}
        button:hover{background:#0369a1;}
        .alert{padding:12px 16px;border-radius:8px;font-size:14px;margin-top:12px;display:none;}
        .alert-success{background:#14532d;color:#4ade80;border:1px solid #22c55e;}
        .alert-error{background:#7f1d1d;color:#fca5a5;border:1px solid #ef4444;}
        .code-box{background:#18181b;padding:12px;border-radius:6px;font-family:monospace;word-break:break-all;font-size:13px;color:#a7f3d0;margin-top:8px;}
        .recovery-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px;}
        .recovery-item{background:#18181b;padding:6px;text-align:center;font-family:monospace;font-size:12px;color:#fbbf24;border-radius:4px;border:1px solid #27272a;}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">🔐 MFA / TOTP Control Portal (Bonus B01)</div>
        </div>

        <!-- SECTION 1: TOTP SETUP -->
        <div class="card">
            <div class="card-title">1. Setup TOTP Multi-Factor Authentication</div>
            <p style="font-size:13px;color:#94a3b8;margin-bottom:16px;">Generate shared secret RFC 6238 and recovery codes for your account.</p>
            <button onclick="setupMfa()">🔑 Generate TOTP Secret & Recovery Codes</button>

            <div id="setupResult" style="display:none;margin-top:16px;">
                <label>Base32 Secret (for Authenticator App):</label>
                <div class="code-box" id="secretVal"></div>

                <label style="margin-top:12px;">OTPAuth URI (QR Code Target):</label>
                <div class="code-box" id="otpauthVal" style="color:#60a5fa;"></div>

                <label style="margin-top:12px;">One-Time Recovery Codes (Save these securely):</label>
                <div class="recovery-grid" id="recoveryGrid"></div>

                <div class="form-group" style="margin-top:20px;">
                    <label>Enter 6-digit TOTP code from app to confirm setup:</label>
                    <input type="text" id="confirmCode" placeholder="e.g. 123456" maxlength="6" style="width:200px;">
                    <button onclick="enableMfa()" style="margin-top:8px;">✅ Confirm & Enable MFA</button>
                </div>
            </div>
            <div id="setupAlert" class="alert"></div>
        </div>

        <!-- SECTION 2: MFA LOGIN TEST -->
        <div class="card">
            <div class="card-title">2. Test 2-Factor Authentication Login</div>
            <div id="loginStep1">
                <div class="form-group">
                    <label>Email Address:</label>
                    <input type="email" id="loginEmail" value="admin@sso.local">
                </div>
                <div class="form-group">
                    <label>Password:</label>
                    <input type="password" id="loginPassword" value="Admin123!">
                </div>
                <button onclick="doStep1Login()">Step 1: Verify Password</button>
            </div>

            <div id="loginStep2" style="display:none;margin-top:16px;background:#18181b;padding:16px;border-radius:8px;border:1px solid #3f3f46;">
                <div style="color:#fbbf24;font-weight:600;margin-bottom:8px;">⚠️ MFA Challenge Required</div>
                <div class="form-group">
                    <label>Enter 6-digit TOTP Code (or 10-char Recovery Code):</label>
                    <input type="text" id="mfaCode" placeholder="6-digit code or recovery code" style="width:280px;">
                </div>
                <button onclick="doStep2Mfa()">Step 2: Submit 2FA Code</button>
            </div>
            <div id="loginAlert" class="alert"></div>
        </div>
    </div>

    <script>
        let currentSecret = '';
        let currentHashedCodes = [];
        let currentMfaToken = '';

        async function setupMfa(){
            try{
                const res = await fetch('/api/auth/mfa/setup', { method:'POST' });
                const data = await res.json();
                if(data.success){
                    currentSecret = data.data.secret;
                    currentHashedCodes = data.data.hashed_recovery_codes;
                    document.getElementById('secretVal').innerText = data.data.secret;
                    document.getElementById('otpauthVal').innerText = data.data.otpauth_url;
                    
                    const grid = document.getElementById('recoveryGrid');
                    grid.innerHTML = data.data.recovery_codes.map(c => '<div class="recovery-item">' + c + '</div>').join('');
                    document.getElementById('setupResult').style.display = 'block';
                }else{
                    showAlert('setupAlert', 'error', data.error);
                }
            }catch(e){
                showAlert('setupAlert', 'error', e.message);
            }
        }

        async function enableMfa(){
            const code = document.getElementById('confirmCode').value;
            try{
                const res = await fetch('/api/auth/mfa/enable', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ secret: currentSecret, hashed_recovery_codes: currentHashedCodes, code })
                });
                const data = await res.json();
                if(data.success){
                    showAlert('setupAlert', 'success', data.message);
                }else{
                    showAlert('setupAlert', 'error', data.error);
                }
            }catch(e){
                showAlert('setupAlert', 'error', e.message);
            }
        }

        async function doStep1Login(){
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            try{
                const res = await fetch('/api/auth/login', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if(data.mfa_required){
                    currentMfaToken = data.mfa_token;
                    document.getElementById('loginStep2').style.display = 'block';
                    showAlert('loginAlert', 'success', 'Password correct. MFA challenge initiated!');
                }else if(data.success){
                    showAlert('loginAlert', 'success', 'Login successful (MFA was not enabled).');
                }else{
                    showAlert('loginAlert', 'error', data.error);
                }
            }catch(e){
                showAlert('loginAlert', 'error', e.message);
            }
        }

        async function doStep2Mfa(){
            const code = document.getElementById('mfaCode').value;
            try{
                const res = await fetch('/api/auth/login/mfa', {
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify({ mfa_token: currentMfaToken, code })
                });
                const data = await res.json();
                if(data.success){
                    showAlert('loginAlert', 'success', '🎉 MFA Login SUCCESS! Central SSO Session Cookie Issued.');
                }else{
                    showAlert('loginAlert', 'error', data.error);
                }
            }catch(e){
                showAlert('loginAlert', 'error', e.message);
            }
        }

        function showAlert(id, type, msg){
            const el = document.getElementById(id);
            el.className = 'alert alert-' + type;
            el.innerText = msg;
            el.style.display = 'block';
        }
    </script>
</body>
</html>`;
    res.send(html);
});

export default router;