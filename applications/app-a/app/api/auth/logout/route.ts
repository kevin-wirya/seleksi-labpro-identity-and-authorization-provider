import {NextRequest,NextResponse} from 'next/server';
import crypto from 'node:crypto';
import {prisma} from '@/lib/prisma';

export async function POST(request:NextRequest){
    const sessionToken=request.cookies.get('app_a_session')?.value;
    if(sessionToken){
        const tokenHash=crypto.createHash('sha256').update(sessionToken).digest('hex');
        await prisma.localSession.updateMany({
            where:{session_token_hash:tokenHash,status:'active'},
            data:{status:'revoked',revoked_at:new Date(),revoke_reason:'user_logout'},
        });
    }
    const response=NextResponse.redirect(new URL('/',request.url));
    response.cookies.delete('app_a_session');
    return response;
}