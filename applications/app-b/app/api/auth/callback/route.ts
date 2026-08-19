import {NextRequest,NextResponse} from 'next/server';
import crypto from 'node:crypto';
import {prisma} from '@/lib/prisma';

export async function GET(request:NextRequest){
    const searchParams=request.nextUrl.searchParams;
    const code=searchParams.get('code');
    const state=searchParams.get('state');
    const error=searchParams.get('error');
    const errorDescription=searchParams.get('error_description');
    const savedState=request.cookies.get('oauth_state')?.value;

    if(!state||!savedState||state!==savedState){
        try{
            await prisma.auditLog.create({
                data:{
                    event_type:'StateValidationFailed',
                    application_id:'app-b',
                    result:'failed',
                    metadata:JSON.stringify({reason:'State mismatch / Possible CSRF attack'}),
                },
            });
        }catch(e){}
        return NextResponse.json({success:false,error:'State mismatch / Possible CSRF attack detected'},{status:400});
    }

    if(error){
        try{
            await prisma.auditLog.create({
                data:{
                    event_type:'AuthorizationFailed',
                    application_id:'app-b',
                    result:'failed',
                    metadata:JSON.stringify({error,description:errorDescription}),
                },
            });
        }catch(e){}
        return NextResponse.json({success:false,error,error_description:errorDescription||'Access denied by Auth Provider policy'},{status:403});
    }

    if(!code) return NextResponse.json({success:false,error:'Authorization code missing'},{status:400});

    try{
        await prisma.auditLog.create({
            data:{
                event_type:'AuthorizationCodeReceived',
                application_id:'app-b',
                result:'success',
                metadata:JSON.stringify({code_snippet:code.substring(0,8)+'...',state:state.substring(0,8)+'...'}),
            },
        });
    }catch(e){}

    const authHost=process.env.AUTH_PROVIDER_INTERNAL_URL||'http://auth-provider:4000';
    let tokenRes: any;
    try{
        tokenRes=await fetch(`${authHost}/api/auth/token`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                grant_type:'authorization_code',
                code,
                client_id:'app-b',
                redirect_uri:'http://localhost:3002/api/auth/callback',
            }),
        });
    }catch(e){
        tokenRes=await fetch('http://localhost:4000/api/auth/token',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                grant_type:'authorization_code',
                code,
                client_id:'app-b',
                redirect_uri:'http://localhost:3002/api/auth/callback',
            }),
        });
    }
    const tokenData=await tokenRes.json();
    if(!tokenRes.ok||!tokenData.access_token){
        try{
            await prisma.auditLog.create({
                data:{
                    event_type:'TokenExchangeFailed',
                    application_id:'app-b',
                    result:'failed',
                    metadata:JSON.stringify({error:tokenData.error||'Token exchange failed'}),
                },
            });
        }catch(e){}
        return NextResponse.json({success:false,error:tokenData.error||'Failed to exchange authorization code'},{status:400});
    }

    try{
        await prisma.auditLog.create({
            data:{
                event_type:'AccessTokenExchanged',
                application_id:'app-b',
                result:'success',
                metadata:JSON.stringify({grant_type:'authorization_code',expires_in:tokenData.expires_in}),
            },
        });
    }catch(e){}

    let userinfoRes: any;
    try{
        userinfoRes=await fetch(`${authHost}/api/auth/userinfo`,{
            headers:{Authorization:`Bearer ${tokenData.access_token}`},
        });
    }catch(e){
        userinfoRes=await fetch('http://localhost:4000/api/auth/userinfo',{
            headers:{Authorization:`Bearer ${tokenData.access_token}`},
        });
    }
    const userinfo=await userinfoRes.json();
    if(!userinfoRes.ok){
        try{
            await prisma.auditLog.create({
                data:{
                    event_type:'UserInfoFetchFailed',
                    application_id:'app-b',
                    result:'failed',
                    metadata:JSON.stringify({error:userinfo.error}),
                },
            });
        }catch(e){}
        return NextResponse.json({success:false,error:userinfo.error||'Failed to fetch userinfo'},{status:400});
    }

    try{
        await prisma.auditLog.create({
            data:{
                event_type:'UserInfoFetched',
                application_id:'app-b',
                user_id:userinfo.sub,
                result:'success',
                metadata:JSON.stringify({email:userinfo.email,name:userinfo.name,groups:userinfo.groups}),
            },
        });
    }catch(e){}

    await prisma.profileCache.upsert({
        where:{external_user_id:userinfo.sub},
        update:{
            name:userinfo.name,
            email:userinfo.email,
            groups:JSON.stringify(userinfo.groups||[]),
            synced_at:new Date(),
        },
        create:{
            external_user_id:userinfo.sub,
            name:userinfo.name,
            email:userinfo.email,
            groups:JSON.stringify(userinfo.groups||[]),
        },
    });

    const rawLocalToken=crypto.randomBytes(32).toString('hex');
    const session_token_hash=crypto.createHash('sha256').update(rawLocalToken).digest('hex');
    const expires_at=new Date(Date.now()+24*60*60*1000);
    const appRecord=await prisma.application.findUnique({where:{client_id:'app-b'}});
    const localSession=await prisma.localSession.create({
        data:{
            session_token_hash,
            external_user_id:userinfo.sub,
            central_session_id:userinfo.sub,
            application_id:appRecord?appRecord.id:'app-b',
            status:'active',
            expires_at,
        },
    });

    try{
        await prisma.auditLog.create({
            data:{
                event_type:'LocalSessionCreated',
                application_id:'app-b',
                user_id:userinfo.sub,
                session_id:localSession.id,
                result:'success',
                metadata:JSON.stringify({session_id:localSession.id,expires_at}),
            },
        });
    }catch(e){}

    const response=NextResponse.redirect(new URL('/',request.url));
    response.cookies.set('app_b_session',rawLocalToken,{httpOnly:true,path:'/',maxAge:86400});
    return response;
}
