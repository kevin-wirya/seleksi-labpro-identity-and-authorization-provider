import {cookies} from 'next/headers';
import Link from 'next/link';
import crypto from 'node:crypto';
import {prisma} from '@/lib/prisma';

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
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
                <div className="max-w-2xl w-full bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700 space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-blue-400">APP A</h1>
                            <h2 className="text-xl font-semibold mt-1">Hello, Cipher {userProfile.name}</h2>
                        </div>
                        <form action="/api/auth/logout" method="POST">
                            <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-white font-medium shadow transition-all">
                                Local Logout
                            </button>
                        </form>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 space-y-2">
                            <p className="font-semibold text-blue-400 text-base mb-2">Profile Claims</p>
                            <p><span className="text-slate-400">Email:</span> {userProfile.email}</p>
                            <p><span className="text-slate-400">Groups:</span> {groups.join(', ')}</p>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 space-y-2">
                            <p className="font-semibold text-blue-400 text-base mb-2">Local Session Status</p>
                            <p><span className="text-slate-400">Status:</span> <span className="text-green-400 font-bold">{localSession.status}</span></p>
                            <p className="truncate"><span className="text-slate-400">Session ID:</span> {localSession.id}</p>
                            <p><span className="text-slate-400">Created:</span> {new Date(localSession.created_at).toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-300">Processed Events Log</h3>
                        {processedEvents.length===0?(
                            <p className="text-slate-500 text-sm italic">No processed events yet.</p>
                        ):(
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-300">
                                    <thead className="bg-slate-900 text-slate-400">
                                        <tr>
                                            <th className="p-2">Event ID</th>
                                            <th className="p-2">Type</th>
                                            <th className="p-2">Result</th>
                                            <th className="p-2">Processed At</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {processedEvents.map((evt)=>(
                                            <tr key={evt.event_id}>
                                                <td className="p-2 font-mono text-xs">{evt.event_id}</td>
                                                <td className="p-2">{evt.event_type}</td>
                                                <td className="p-2 text-green-400">{evt.result}</td>
                                                <td className="p-2">{new Date(evt.processed_at).toLocaleString()}</td>
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
            <h1 className="text-4xl font-bold mb-4">APP A</h1>
            <p className="text-slate-400 mb-8">Relying Application A - SSO Client</p>
            <Link href="/api/auth/login" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium shadow-lg transition-all">
                Login with SSO
            </Link>
        </div>
    );
}