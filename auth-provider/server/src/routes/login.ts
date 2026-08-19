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
    codeChallenge?: string;
    codeChallengeMethod?: string;
    user?: any;
}) {
    const { error, email = '', clientId = '', redirectUri = '', state = '', codeChallenge = '', codeChallengeMethod = '', user } = props;

    let appBadgeHtml = '';
    if (clientId) {
        appBadgeHtml = `
        <div style="margin-bottom: 20px; padding: 10px 14px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <svg style="width: 18px; height: 18px; color: #34d399;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span style="font-size: 13px; font-weight: 700; color: #34d399;">Authenticating for ${clientId.toUpperCase()}</span>
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
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
        body { background-color: #060907; color: #f4f4f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; background-image: radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.12) 0%, transparent 60%); }
        .card { background-color: #0f1712; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 24px; padding: 36px; max-width: 440px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), 0 0 40px rgba(16, 185, 129, 0.08); text-align: center; backdrop-filter: blur(16px); }
        .icon-box { width: 60px; height: 60px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 18px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.15); }
        h1 { font-size: 22px; font-weight: 800; color: #ffffff; margin-bottom: 6px; letter-spacing: -0.5px; }
        p.subtitle { font-size: 13px; color: #a1a1aa; margin-bottom: 24px; }
        .user-info { background: #060907; border: 1px solid rgba(16, 185, 129, 0.15); border-radius: 14px; padding: 18px; text-align: left; margin-bottom: 24px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
        .info-row:last-child { margin-bottom: 0; }
        .label { color: #71717a; font-weight: 600; }
        .value { color: #ffffff; font-weight: 700; }
        .badge { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .btn-logout { background: #dc2626; color: #ffffff; border: none; padding: 13px; width: 100%; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; }
        .btn-logout:hover { background: #b91c1c; transform: translateY(-1px); }
        .btn-continue { background: linear-gradient(135deg, #10b981 0%, #047857 100%); color: #ffffff; text-decoration: none; padding: 13px; width: 100%; border-radius: 12px; font-weight: 700; font-size: 14px; display: block; margin-bottom: 12px; transition: all 0.2s; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3); }
        .btn-continue:hover { opacity: 0.95; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4); }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-box">
            <svg style="width: 30px; height: 30px; color: #34d399;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
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
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
        body { background-color: #060907; color: #f4f4f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; background-image: radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.12) 0%, transparent 60%); }
        .card { background-color: #0f1712; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 24px; padding: 36px; max-width: 420px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), 0 0 40px rgba(16, 185, 129, 0.08); backdrop-filter: blur(16px); }
        .icon-box { width: 60px; height: 60px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 18px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.15); }
        h1 { font-size: 24px; font-weight: 800; color: #ffffff; text-align: center; margin-bottom: 6px; letter-spacing: -0.5px; }
        p.subtitle { font-size: 13px; color: #a1a1aa; text-align: center; margin-bottom: 24px; }
        .error-alert { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; font-size: 13px; padding: 12px; border-radius: 10px; margin-bottom: 20px; text-align: center; }
        .form-group { margin-bottom: 18px; text-align: left; }
        label { display: block; font-size: 12px; font-weight: 700; color: #a1a1aa; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        input[type="email"], input[type="password"] { width: 100%; background: #060907; border: 1px solid #1f2923; border-radius: 12px; padding: 12px 14px; font-size: 14px; color: #ffffff; outline: none; transition: all 0.2s; }
        input[type="email"]:focus, input[type="password"]:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2); }
        .btn-submit { background: linear-gradient(135deg, #10b981 0%, #047857 100%); color: #ffffff; border: none; padding: 14px; width: 100%; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s; margin-top: 8px; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.35); }
        .btn-submit:hover { opacity: 0.95; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.45); }
        .footer-text { font-size: 11px; color: #52525b; text-align: center; margin-top: 24px; font-weight: 600; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-box">
            <svg style="width: 30px; height: 30px; color: #34d399;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        </div>
        <h1>Identity Provider</h1>
        <p class="subtitle">Single Sign-On Authentication Center</p>

        ${appBadgeHtml}
        ${error ? `<div class="error-alert">${error}</div>` : ''}

        <form action="/login" method="POST">
            <input type="hidden" name="client_id" value="${clientId}">
            <input type="hidden" name="redirect_uri" value="${redirectUri}">
            <input type="hidden" name="state" value="${state}">
            <input type="hidden" name="code_challenge" value="${codeChallenge}">
            <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod}">

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
    const codeChallenge = (req.query.code_challenge || '') as string;
    const codeChallengeMethod = (req.query.code_challenge_method || '') as string;

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
                return res.send(renderLoginPage({ user: session.user, clientId, redirectUri, state, codeChallenge, codeChallengeMethod }));
            }
        } catch (e) {
            // fallthrough
        }
    }

    res.send(renderLoginPage({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod }));
});

// POST /login
router.post('/', async (req: any, res: Response) => {
    const prisma = req.prisma;
    const { email, password, client_id = '', redirect_uri = '', state = '', code_challenge = '', code_challenge_method = '' } = req.body;

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
            try{
                await prisma.auditLog.create({
                    data:{
                        event_type:'login_failed',
                        result:'denied',
                        metadata:JSON.stringify({email,reason:!user?'User not found':'User inactive'}),
                        ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string|null,
                    },
                });
            }catch(e){}
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
            try{
                await prisma.auditLog.create({
                    data:{
                        event_type:'login_failed',
                        actor_id:user.id,
                        user_id:user.id,
                        result:'denied',
                        metadata:JSON.stringify({email,reason:'Invalid password'}),
                        ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string|null,
                    },
                });
            }catch(e){}
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

        try{
            await prisma.auditLog.create({
                data:{
                    event_type:'login_success',
                    actor_id:user.id,
                    user_id:user.id,
                    result:'success',
                    metadata:JSON.stringify({email:user.email,name:user.name}),
                    ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string|null,
                },
            });
        }catch(e){}

        res.cookie('sso_session', rawSessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/',
        });

        // If client_id and redirect_uri were provided, forward to authorize endpoint
        if (client_id && redirect_uri) {
            const cc = code_challenge ? `&code_challenge=${encodeURIComponent(code_challenge)}` : '';
            const ccm = code_challenge_method ? `&code_challenge_method=${encodeURIComponent(code_challenge_method)}` : '';
            const authUrl = `/api/auth/authorize?client_id=${encodeURIComponent(client_id)}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${encodeURIComponent(state)}${cc}${ccm}`;
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
