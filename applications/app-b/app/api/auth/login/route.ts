import {NextResponse} from 'next/server';
import crypto from 'crypto';

export async function GET(){
    const state=crypto.randomBytes(16).toString('hex');
    const codeVerifier=crypto.randomBytes(32).toString('hex');
    const codeChallenge=crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const authUrl=new URL('http://localhost:4000/api/auth/authorize');
    authUrl.searchParams.set('client_id','app-b');
    authUrl.searchParams.set('redirect_uri','http://localhost:3002/api/auth/callback');
    authUrl.searchParams.set('state',state);
    authUrl.searchParams.set('code_challenge',codeChallenge);
    authUrl.searchParams.set('code_challenge_method','S256');
    const response=NextResponse.redirect(authUrl.toString());
    response.cookies.set('oauth_state',state,{httpOnly:true,path:'/',maxAge:600});
    response.cookies.set('oauth_verifier',codeVerifier,{httpOnly:true,path:'/',maxAge:600});
    return response;
}
