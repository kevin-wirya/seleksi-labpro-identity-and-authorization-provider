import {cookies} from 'next/headers';
import Link from 'next/link';
import crypto from 'crypto';
import {prisma} from '@/lib/prisma';

export default async function Home(){
    const cookieStore=await cookies();
    const sessionToken=cookieStore.get('app_b_session')?.value;
    let userProfile=null;
    let localSession=null;
    if(sessionToken){
        const tokenHash=crypto.createHash('sha256').update(sessionToken).digest('hex');
        localSession=await prisma.localSession.findFirst({
            where:{session_token_hash:tokenHash,status:'active',expires_at:{gt:new Date()}},
        });
        if(localSession){
            userProfile=await prisma.profileCache.findUnique({
                where:{external_user_id:localSession.external_user_id},
            });
        }
    }
    if(userProfile&&localSession){
        const groups=userProfile.groups?JSON.parse(userProfile.groups):[];
        return(
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
                <div className="max-w-md w-full bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
                    <h1 className="text-3xl font-bold mb-2 text-purple-400">APP B</h1>
                    <h2 className="text-2xl font-semibold mb-4">Hello, Cipher {userProfile.name}</h2>
                    <div className="space-y-3 text-slate-300 text-sm mb-6">
                        <p><span className="font-semibold text-slate-400">Email:</span> {userProfile.email}</p>
                        <p><span className="font-semibold text-slate-400">Groups:</span> {groups.join(', ')}</p>
                        <p><span className="font-semibold text-slate-400">Session Status:</span> <span className="text-green-400 font-bold">{localSession.status}</span></p>
                        <p><span className="font-semibold text-slate-400">Created:</span> {new Date(localSession.created_at).toLocaleString()}</p>
                        <p><span className="font-semibold text-slate-400">Expires:</span> {new Date(localSession.expires_at).toLocaleString()}</p>
                    </div>
                </div>
            </div>
        );
    }
    return(
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
            <h1 className="text-4xl font-bold mb-4">APP B</h1>
            <p className="text-slate-400 mb-8">Relying Application B - SSO Client</p>
            <Link href="/api/auth/login" className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-medium shadow-lg transition-all">
                Login with SSO
            </Link>
        </div>
    );
}
