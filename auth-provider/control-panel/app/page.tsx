export default function Home() {
  return (
    <div className="min-h-screen bg-black text-slate-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="border-b border-zinc-800 pb-6 mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-sky-400 flex items-center gap-3">
              🛡️ SSO Control Panel & Observability
            </h1>
            <p className="text-zinc-400 text-sm mt-1">
              Identity Provider Central System Management Portal
            </p>
          </div>
          <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/30 text-xs px-3 py-1 rounded-full font-medium">
            System Online
          </span>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <a
            href="http://localhost:4000/metrics-ui"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-6 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:border-sky-500 transition group shadow-lg"
          >
            <div className="text-2xl mb-2">📊</div>
            <h2 className="text-lg font-semibold text-white group-hover:text-sky-400 transition">
              Real-Time Observability Dashboard
            </h2>
            <p className="text-zinc-400 text-sm mt-1">
              Monitor RED metrics (Rate, Error, Duration) and USE metrics (Queue Depth, Sync Worker) in real time.
            </p>
            <span className="inline-block mt-4 text-xs font-semibold text-sky-400">
              Open Dashboard &rarr;
            </span>
          </a>

          <a
            href="http://localhost:4000/api/auth/mfa-ui"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-6 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:border-amber-500 transition group shadow-lg"
          >
            <div className="text-2xl mb-2">🔐</div>
            <h2 className="text-lg font-semibold text-white group-hover:text-amber-400 transition">
              MFA / TOTP Portal (Bonus B01)
            </h2>
            <p className="text-zinc-400 text-sm mt-1">
              Setup 2-factor authentication, generate shared RFC 6238 TOTP secrets, and manage single-use recovery codes.
            </p>
            <span className="inline-block mt-4 text-xs font-semibold text-amber-400">
              Open MFA Portal &rarr;
            </span>
          </a>

          <a
            href="http://localhost:3001"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-6 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:border-emerald-500 transition group shadow-lg"
          >
            <div className="text-2xl mb-2">🌐</div>
            <h2 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition">
              App A (Relying Application 1)
            </h2>
            <p className="text-zinc-400 text-sm mt-1">
              Client web application running on port 3001 with OAuth2 PKCE SSO authentication.
            </p>
            <span className="inline-block mt-4 text-xs font-semibold text-emerald-400">
              Launch App A &rarr;
            </span>
          </a>

          <a
            href="http://localhost:3002"
            target="_blank"
            rel="noopener noreferrer"
            className="block p-6 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:border-purple-500 transition group shadow-lg"
          >
            <div className="text-2xl mb-2">⚡</div>
            <h2 className="text-lg font-semibold text-white group-hover:text-purple-400 transition">
              App B (Relying Application 2)
            </h2>
            <p className="text-zinc-400 text-sm mt-1">
              Client web application running on port 3002 with OAuth2 PKCE SSO authentication.
            </p>
            <span className="inline-block mt-4 text-xs font-semibold text-purple-400">
              Launch App B &rarr;
            </span>
          </a>
        </div>

        <div className="mt-8 p-6 bg-zinc-900/50 border border-zinc-800/80 rounded-xl">
          <h3 className="text-md font-semibold text-zinc-300 mb-3">
            🏥 Health Probes & System Infrastructure
          </h3>
          <div className="flex flex-wrap gap-4 text-xs">
            <a
              href="http://localhost:4000/health/live"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-md transition"
            >
              Liveness Probe: /health/live
            </a>
            <a
              href="http://localhost:4000/health/ready"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-md transition"
            >
              Readiness Probe: /health/ready
            </a>
            <a
              href="http://localhost:15672"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-md transition"
            >
              RabbitMQ Manager: port 15672
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
