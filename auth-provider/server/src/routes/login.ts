import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { verifyPassword } from '../utils/hash';

const router = express.Router();

function hashSessionToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function renderLoginPage(props: {
    error?: string;
    email?: string;
    clientId?: string;
    redirectUri?: string;
    state?: string;
    user?: any;
}) {
    const { error, email = '', clientId = '', redirectUri = '', state = '', user } = props;

    let appBadgeHtml = '';
    if (clientId) {
        appBadgeHtml = `
        <div style="margin-bottom: 20px; padding: 10px 14px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg style="width: 18px; height: 18px; color: #38bdf8;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span style="font-size: 13px; font-weight: 700; color: #38bdf8;">Authenticating for ${clientId.toUpperCase()}</span>
        </div>`;
    }

    if (user) {
        const groups = user.user_groups?.map((ug: any) => ug.group.name) || [];
        const groupsHtml = groups.map((g: string) => `<span style="background: #27272a; color: #e4e4e7; font-size: 11px; padding: 3px 8px; border-radius: 4px; border: 1px solid #3f3f46; margin-right: 4px;">${g}</span>`).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SSO Central Session - Auth Provider</title>
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Lato', sans-serif; }
        body { background-color: #09090b; color: #f4f4f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
        .card { background-color: #18181b; border: 1px solid #27272a; border-radius: 20px; padding: 36px; max-width: 440px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); text-align: center; }
        .icon-box { width: 56px; height: 56px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; }
        h1 { font-size: 22px; font-weight: 900; color: #ffffff; margin-bottom: 6px; }
        p.subtitle { font-size: 13px; color: #a1a1aa; margin-bottom: 24px; }
        .user-info { background: #09090b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; text-align: left; margin-bottom: 24px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
        .info-row:last-child { margin-bottom: 0; }
        .label { color: #71717a; }
        .value { color: #ffffff; font-weight: 700; }
        .badge { background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
        .btn-logout { background: #dc2626; color: #ffffff; border: none; padding: 12px; width: 100%; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; transition: background 0.2s; }
        .btn-logout:hover { background: #b91c1c; }
        .btn-continue { background: #0284c7; color: #ffffff; text-decoration: none; padding: 12px; width: 100%; border-radius: 12px; font-weight: 700; font-size: 14px; display: block; margin-bottom: 12px; transition: background 0.2s; }
        .btn-continue:hover { background: #0369a1; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-box">
            <svg style="width: 28px; height: 28px; color: #38bdf8;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        </div>
        <h1>Central SSO Session Active</h1>
        <p class="subtitle">You are logged in to the Identity Provider</p>
        
        <div class="user-info">
            <div class="info-row"><span class="label">Name</span><span class="value">${user.name}</span></div>
            <div class="info-row"><span class="label">Email</span><span class="value">${user.email}</span></div>
            <div class="info-row"><span class="label">Status</span><span class="badge">${user.status}</span></div>
            <div class="info-row" style="margin-top: 8px;"><span class="label">Groups</span><div style="margin-top: 4px;">${groupsHtml || '-'}</div></div>
        </div>

        ${clientId ? `<a href="/api/auth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}" class="btn-continue">Continue to ${clientId.toUpperCase()}</a>` : ''}

        <form action="/api/auth/logout" method="POST">
            <button type="submit" class="btn-logout">SSO Global Logout</button>
        </form>
    </div>
</body>
</html>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign In - SSO Identity Provider</title>
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Lato', sans-serif; }
        body { background-color: #09090b; color: #f4f4f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
        .card { background-color: #18181b; border: 1px solid #27272a; border-radius: 20px; padding: 36px; max-width: 420px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); }
        .icon-box { width: 56px; height: 56px; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; }
        h1 { font-size: 24px; font-weight: 900; color: #ffffff; text-align: center; margin-bottom: 6px; }
        p.subtitle { font-size: 13px; color: #a1a1aa; text-align: center; margin-bottom: 24px; }
        .error-alert { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; font-size: 13px; padding: 12px; border-radius: 10px; margin-bottom: 20px; text-align: center; }
        .form-group { margin-bottom: 18px; text-align: left; }
        label { display: block; font-size: 12px; font-weight: 700; color: #a1a1aa; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        input[type="email"], input[type="password"] { width: 100%; background: #09090b; border: 1px solid #27272a; border-radius: 10px; padding: 12px 14px; font-size: 14px; color: #ffffff; outline: none; transition: border-color 0.2s; }
        input[type="email"]:focus, input[type="password"]:focus { border-color: #0284c7; }
        .btn-submit { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff; border: none; padding: 13px; width: 100%; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; transition: opacity 0.2s; margin-top: 8px; }
        .btn-submit:hover { opacity: 0.9; }
        .footer-text { font-size: 11px; color: #52525b; text-align: center; margin-top: 24px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-box">
            <svg style="width: 28px; height: 28px; color: #38bdf8;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        </div>
        <h1>Identity Provider</h1>
        <p class="subtitle">Single Sign-On Authentication Center</p>

        ${appBadgeHtml}
        ${error ? `<div class="error-alert">${error}</div>` : ''}

        <form action="/login" method="POST">
            <input type="hidden" name="client_id" value="${clientId}">
            <input type="hidden" name="redirect_uri" value="${redirectUri}">
            <input type="hidden" name="state" value="${state}">

            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" name="email" required placeholder="admin@example.com" value="${email}">
            </div>

            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required placeholder="••••••••">
            </div>

            <button type="submit" class="btn-submit">Sign In to SSO</button>
        </form>

        <div class="footer-text">Protected by Central Session Server</div>
    </div>
</body>
</html>`;
}

// GET /login
router.get('/', async (req: any, res: Response) => {
    const prisma = req.prisma;
    const clientId = (req.query.client_id || '') as string;
    const redirectUri = (req.query.redirect_uri || '') as string;
    const state = (req.query.state || '') as string;

    const rawSessionToken = req.cookies?.sso_session;
    if (rawSessionToken) {
        try {
            const session_token_hash = hashSessionToken(rawSessionToken);
            const session = await prisma.ssoSession.findFirst({
                where: {
                    session_token_hash,
                    status: 'active',
                    expires_at: { gt: new Date() },
                },
                include: {
                    user: {
                        include: {
                            user_groups: { include: { group: true } },
                        },
                    },
                },
            });
            if (session && session.user && session.user.status === 'active') {
                return res.send(renderLoginPage({ user: session.user, clientId, redirectUri, state }));
            }
        } catch (e) {
            // fallthrough
        }
    }

    res.send(renderLoginPage({ clientId, redirectUri, state }));
});

// POST /login
router.post('/', async (req: any, res: Response) => {
    const prisma = req.prisma;
    const { email, password, client_id = '', redirect_uri = '', state = '' } = req.body;

    if (!email || !password) {
        return res.status(400).send(renderLoginPage({
            error: 'Email and password are required',
            email,
            clientId: client_id,
            redirectUri: redirect_uri,
            state,
        }));
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.status !== 'active') {
            return res.status(401).send(renderLoginPage({
                error: 'Invalid email or password or inactive account',
                email,
                clientId: client_id,
                redirectUri: redirect_uri,
                state,
            }));
        }

        const isPasswordValid = verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).send(renderLoginPage({
                error: 'Invalid email or password',
                email,
                clientId: client_id,
                redirectUri: redirect_uri,
                state,
            }));
        }

        // Create Central Session
        const rawSessionToken = crypto.randomBytes(32).toString('hex');
        const session_token_hash = hashSessionToken(rawSessionToken);
        const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const ip_address = (req.ip || req.headers['x-forwarded-for'] || null) as string | null;
        const user_agent = (req.headers['user-agent'] || null) as string | null;

        await prisma.ssoSession.create({
            data: {
                user_id: user.id,
                session_token_hash,
                status: 'active',
                expires_at,
                ip_address,
                user_agent,
            },
        });

        res.cookie('sso_session', rawSessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/',
        });

        // If client_id and redirect_uri were provided, forward to authorize endpoint
        if (client_id && redirect_uri) {
            const authUrl = `/api/auth/authorize?client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${encodeURIComponent(state)}`;
            return res.redirect(302, authUrl);
        }

        // Otherwise show central session status page
        res.redirect('/login');
    } catch (error: any) {
        res.status(500).send(renderLoginPage({
            error: error.message,
            email,
            clientId: client_id,
            redirectUri: redirect_uri,
            state,
        }));
    }
});

export default router;
