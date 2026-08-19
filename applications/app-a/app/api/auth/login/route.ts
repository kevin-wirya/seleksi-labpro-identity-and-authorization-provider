import {NextResponse} from 'next/server';
import crypto from 'crypto';
import {prisma} from '@/lib/prisma';

export async function GET(){
    const state=crypto.randomBytes(16).toString('hex');
    const codeVerifier=crypto.randomBytes(32).toString('hex');
    const codeChallenge=crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    try{
        await prisma.auditLog.create({
            data:{
                event_type:'RedirectToAuthProvider',
                application_id:'app-a',
                result:'success',
                metadata:JSON.stringify({
                    target:'http://localhost:4000/api/auth/authorize',
                    client_id:'app-a',
                    state:state.substring(0,8)+'...',
                }),
            },
        });
    }catch(e){}

    const authUrl=new URL('http://localhost:4000/api/auth/authorize');
    authUrl.searchParams.set('client_id','app-a');
    authUrl.searchParams.set('redirect_uri','http://localhost:3001/api/auth/callback');
    authUrl.searchParams.set('state',state);
    authUrl.searchParams.set('code_challenge',codeChallenge);
    authUrl.searchParams.set('code_challenge_method','S256');
    const response=NextResponse.redirect(authUrl.toString());
    response.cookies.set('oauth_state',state,{httpOnly:true,path:'/',maxAge:600});
    response.cookies.set('oauth_verifier',codeVerifier,{httpOnly:true,path:'/',maxAge:600});
    return response;
}
