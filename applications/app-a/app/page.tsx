import {cookies} from 'next/headers';
import Link from 'next/link';
import crypto from 'node:crypto';
import {prisma} from '@/lib/prisma';

function ShieldIcon() {
    return (
        <svg className="w-6 h-6 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
    );
}

function UserIcon() {
    return (
        <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
    );
}

function LogOutIcon() {
    return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
    );
}

function LogInIcon() {
    return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l4-4m0 0l-4-4m4 4H3m6 4v1a3 3 0 003 3h4a3 3 0 003-3V7a3 3 0 00-3-3h-4a3 3 0 00-3 3v1" />
        </svg>
    );
}

export default async function Home(){
    const cookieStore=await cookies();
    const sessionToken=cookieStore.get('app_a_session')?.value;
    let userProfile=null;
    let localSession=null;
    let processedEvents:any[]=[];
    if(sessionToken){
        const tokenHash=crypto.createHash('sha256').update(sessionToken).digest('hex');
        localSession=await prisma.localSession.findFirst({
            where:{session_token_hash:tokenHash,status:'active',expires_at:{gt:new Date()}},
        });
        if(localSession){
            userProfile=await prisma.profileCache.findUnique({
                where:{external_user_id:localSession.external_user_id},
            });
            processedEvents=await prisma.processedEvent.findMany({
                take:10,
                orderBy:{processed_at:'desc'},
            });
        }
    }

    if(userProfile&&localSession){
        const groups=userProfile.groups?JSON.parse(userProfile.groups):[];
        return(
            <div className="flex flex-col items-center justify-center min-h-screen bg-black text-zinc-100 p-6">
                <div className="max-w-3xl w-full bg-zinc-900/80 rounded-2xl p-8 shadow-2xl border border-zinc-800 space-y-6">
                    <div className="flex justify-between items-center border-b border-zinc-800 pb-5">
                        <div className="flex items-center space-x-3">
                            <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl">
                                <ShieldIcon />
                            </div>
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h1 className="text-2xl font-black text-white tracking-wide">APP A</h1>
                                    <span className="px-2 py-0.5 text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full">Relying Application</span>
                                </div>
                                <h2 className="text-lg text-zinc-300 font-normal mt-0.5">Welcome back, <span className="font-semibold text-white">{userProfile.name}</span></h2>
                            </div>
                        </div>
                        <form action="/api/auth/logout" method="POST">
                            <button type="submit" className="flex items-center space-x-2 px-4 py-2.5 bg-red-600/90 hover:bg-red-600 rounded-xl text-white text-sm font-semibold transition-all shadow-lg shadow-red-900/20">
                                <LogOutIcon />
                                <span>Local Logout</span>
                            </button>
                        </form>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800/80 space-y-3">
                            <div className="flex items-center space-x-2 text-sky-400 font-bold border-b border-zinc-800 pb-2">
                                <UserIcon />
                                <span>Profile Claims</span>
                            </div>
                            <div className="space-y-1.5 text-zinc-300">
                                <p><span className="text-zinc-500">Email:</span> <span className="text-zinc-200 font-medium">{userProfile.email}</span></p>
                                <p><span className="text-zinc-500">Groups:</span> <span className="inline-flex gap-1.5 flex-wrap mt-1">{groups.map((grp: string) => (
                                    <span key={grp} className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded text-xs border border-zinc-700">{grp}</span>
                                ))}</span></p>
                            </div>
                        </div>
                        <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800/80 space-y-3">
                            <div className="flex items-center space-x-2 text-sky-400 font-bold border-b border-zinc-800 pb-2">
                                <ShieldIcon />
                                <span>Local Session Status</span>
                            </div>
                            <div className="space-y-1.5 text-zinc-300">
                                <p><span className="text-zinc-500">Status:</span> <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs font-bold uppercase">{localSession.status}</span></p>
                                <p className="truncate"><span className="text-zinc-500">Session ID:</span> <span className="font-mono text-xs text-zinc-400">{localSession.id}</span></p>
                                <p><span className="text-zinc-500">Created:</span> <span className="text-zinc-300">{new Date(localSession.created_at).toLocaleString()}</span></p>
                                <p><span className="text-zinc-500">Expires:</span> <span className="text-zinc-300">{new Date(localSession.expires_at).toLocaleString()}</span></p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <h3 className="font-bold text-zinc-200 text-sm tracking-wide uppercase text-zinc-400">Processed Events Log</h3>
                        {processedEvents.length===0?(
                            <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800 text-center text-zinc-500 text-sm italic">
                                No processed events received yet.
                            </div>
                        ):(
                            <div className="overflow-x-auto rounded-xl border border-zinc-800">
                                <table className="w-full text-left text-sm text-zinc-300">
                                    <thead className="bg-zinc-950 text-zinc-400 text-xs uppercase font-semibold">
                                        <tr>
                                            <th className="p-3">Event ID</th>
                                            <th className="p-3">Type</th>
                                            <th className="p-3">Result</th>
                                            <th className="p-3">Processed At</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/80 bg-zinc-900/40">
                                        {processedEvents.map((evt)=>(
                                            <tr key={evt.event_id} className="hover:bg-zinc-800/40 transition-colors">
                                                <td className="p-3 font-mono text-xs text-zinc-400">{evt.event_id}</td>
                                                <td className="p-3 font-medium text-zinc-200">{evt.event_type}</td>
                                                <td className="p-3"><span className="px-2 py-0.5 text-xs bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">{evt.result}</span></td>
                                                <td className="p-3 text-zinc-400 text-xs">{new Date(evt.processed_at).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return(
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-zinc-100 p-6">
            <div className="max-w-md w-full bg-zinc-900/80 rounded-2xl p-8 shadow-2xl border border-zinc-800 text-center space-y-6">
                <div className="mx-auto w-16 h-16 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center justify-center">
                    <ShieldIcon />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-white tracking-wide">APP A</h1>
                    <p className="text-zinc-400 text-sm mt-1">Relying Application A • SSO Client</p>
                </div>
                <Link href="/api/auth/login" className="flex items-center justify-center space-x-2 w-full py-3.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-white font-bold transition-all shadow-lg shadow-sky-950">
                    <LogInIcon />
                    <span>Login with SSO</span>
                </Link>
            </div>
        </div>
    );
}