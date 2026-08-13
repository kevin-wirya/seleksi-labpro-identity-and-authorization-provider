import Link from 'next/link';

export default function Home(){
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
