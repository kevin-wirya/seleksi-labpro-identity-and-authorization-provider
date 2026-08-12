const express=require('express');
const crypto=require('crypto');
const {verifyPassword}=require('../utils/hash');
const router=express.Router();

function hashSessionToken(token){
    return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /api/auth/login
router.post('/login',async(req,res)=>{
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
        const rawSessionToken=crypto.randomBytes(32).toString('hex');
        const session_token_hash=hashSessionToken(rawSessionToken);
        const expires_at=new Date(Date.now()+24*60*60*1000); // expired dalam 24 Jam
        const ip_address=req.ip||req.headers['x-forwarded-for']||null;
        const user_agent=req.headers['user-agent']||null;
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
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// GET /api/auth/me
router.get('/me',async(req,res)=>{
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
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// GET /api/auth/authorize
router.get('/authorize',async(req,res)=>{
    const prisma=req.prisma;
    const{client_id,redirect_uri,state}=req.query;
    if(!client_id||!redirect_uri||!state){
        return res.status(400).json({success:false,error:'client_id, redirect_uri, and state are required'});
    }
    try{
        const app=await prisma.application.findUnique({
            where:{client_id},
            include:{
                redirect_uris:true,
                group_policies:true,
            },
        });
        if(!app||app.status!=='active'){
            return res.status(400).json({success:false,error:'Invalid or inactive client_id'});
        }
        const isExactMatch=app.redirect_uris.some(r=>r.redirect_uri===redirect_uri);
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
        const userGroupIds=session.user.user_groups.map(ug=>ug.group_id);
        const policies=app.group_policies;
        let isAllowed=true;
        if(policies.length>0){
            const hasDeny=policies.some(p=>p.effect==='deny'&&userGroupIds.includes(p.group_id));
            const hasAllow=policies.some(p=>p.effect==='allow'&&userGroupIds.includes(p.group_id));
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
                    ip_address:req.ip||req.headers['x-forwarded-for']||null,
                }
            });

            const redirectUrl=new URL(redirect_uri);
            redirectUrl.searchParams.set('error','access_denied');
            redirectUrl.searchParams.set('error_description','User is not authorized to access this application');
            redirectUrl.searchParams.set('state',state);
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
                redirect_uri,
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
                ip_address:req.ip||req.headers['x-forwarded-for']||null,
            }
        });
        const targetUrl=new URL(redirect_uri);
        targetUrl.searchParams.set('code',rawCode);
        targetUrl.searchParams.set('state',state);
        return res.redirect(302,targetUrl.toString());
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/auth/logout
router.post('/logout',async(req,res)=>{
    const prisma=req.prisma;
    const rawSessionToken=req.cookies?.sso_session;
    if(rawSessionToken){
        try{
            const session_token_hash=hashSessionToken(rawSessionToken);
            await prisma.ssoSession.updateMany({
                where:{session_token_hash,status:'active'},
                data:{
                    status:'revoked',
                    revoked_at:new Date(),
                    revoke_reason:'User logout',
                },
            });
        }catch(e){
            // ignore error
        }
    }
    res.clearCookie('sso_session',{path:'/'});
    res.json({success:true,message:'Logout successful'});
});

module.exports=router;
