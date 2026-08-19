import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { verifyPassword } from '../utils/hash';
const router = express.Router();

function hashSessionToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// POST /api/auth/login
router.post('/login', async (req: any, res: Response) => {
    const prisma = req.prisma;
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.status !== 'active') {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        const isPasswordValid = verifyPassword(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        const rawSessionToken = crypto.randomBytes(32).toString('hex');
        const session_token_hash = hashSessionToken(rawSessionToken);
        const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // expired dalam 24 Jam
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
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/auth/me
router.get('/me', async (req: any, res: Response) => {
    const prisma = req.prisma;
    const rawSessionToken = req.cookies?.sso_session;
    if (!rawSessionToken) {
        return res.status(401).json({ success: false, error: 'No central session found' });
    }
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
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        status: true,
                        user_groups: {
                            include: { group: true }
                        }
                    }
                }
            }
        });

        if (!session || !session.user || session.user.status !== 'active') {
            return res.status(401).json({ success: false, error: 'Session expired or invalid' });
        }
        res.json({ success: true, data: session.user });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/auth/authorize
router.get('/authorize', async (req: any, res: Response) => {
    const prisma = req.prisma;
    const { client_id, redirect_uri, state, code_challenge, code_challenge_method } = req.query;
    if (!client_id || !redirect_uri || !state) {
        return res.status(400).json({ success: false, error: 'client_id, redirect_uri, and state are required' });
    }
    const clientIdStr = String(client_id);
    const redirectUriStr = String(redirect_uri);
    const stateStr = String(state);
    const codeChallengeStr = code_challenge ? String(code_challenge) : null;
    const codeChallengeMethodStr = code_challenge_method ? String(code_challenge_method) : null;

    try {
        const app = await prisma.application.findUnique({
            where: { client_id: clientIdStr },
            include: {
                redirect_uris: true,
                group_policies: true,
            },
        });
        if (!app || app.status !== 'active') {
            return res.status(400).json({ success: false, error: 'Invalid or inactive client_id' });
        }
        const isExactMatch = app.redirect_uris.some((r: any) => r.redirect_uri === redirectUriStr);
        if (!isExactMatch) {
            return res.status(400).json({ success: false, error: 'Invalid redirect_uri (Must be exact match)' });
        }
        const rawSessionToken = req.cookies?.sso_session;
        if(!rawSessionToken){
            const cc=codeChallengeStr?`&code_challenge=${encodeURIComponent(codeChallengeStr)}`:'';
            const ccm=codeChallengeMethodStr?`&code_challenge_method=${encodeURIComponent(codeChallengeMethodStr)}`:'';
            return res.redirect(302,`/login?client_id=${encodeURIComponent(clientIdStr)}&redirect_uri=${encodeURIComponent(redirectUriStr)}&state=${encodeURIComponent(stateStr)}${cc}${ccm}`);
        }
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
                        user_groups: true,
                    }
                }
            }
        });
        if(!session||!session.user||session.user.status!=='active'){
            res.clearCookie('sso_session',{path:'/'});
            const cc=codeChallengeStr?`&code_challenge=${encodeURIComponent(codeChallengeStr)}`:'';
            const ccm=codeChallengeMethodStr?`&code_challenge_method=${encodeURIComponent(codeChallengeMethodStr)}`:'';
            return res.redirect(302,`/login?client_id=${encodeURIComponent(clientIdStr)}&redirect_uri=${encodeURIComponent(redirectUriStr)}&state=${encodeURIComponent(stateStr)}${cc}${ccm}`);
        }
        const userGroupIds = session.user.user_groups.map((ug: any) => ug.group_id);
        const policies = app.group_policies;
        let isAllowed = true;
        if (policies.length > 0) {
            const hasDeny = policies.some((p: any) => p.effect === 'deny' && userGroupIds.includes(p.group_id));
            const allowPolicies = policies.filter((p: any) => p.effect === 'allow');
            if (hasDeny) {
                isAllowed = false;
            } else if (allowPolicies.length > 0) {
                const hasAllow = allowPolicies.some((p: any) => userGroupIds.includes(p.group_id));
                if (!hasAllow) {
                    isAllowed = false;
                }
            }
        }
        if (!isAllowed) {
            await prisma.auditLog.create({
                data: {
                    event_type: 'policy_denied',
                    actor_id: session.user_id,
                    user_id: session.user_id,
                    application_id: app.id,
                    session_id: session.id,
                    result: 'denied',
                    metadata: JSON.stringify({ reason: 'User groups do not satisfy application policy', user_groups: userGroupIds }),
                    ip_address: (req.ip || req.headers['x-forwarded-for'] || null) as string | null,
                }
            });

            const redirectUrl = new URL(redirectUriStr);
            redirectUrl.searchParams.set('error', 'access_denied');
            redirectUrl.searchParams.set('error_description', 'User is not authorized to access this application');
            redirectUrl.searchParams.set('state', stateStr);
            return res.redirect(302, redirectUrl.toString());
        }
        const rawCode = crypto.randomBytes(32).toString('hex');
        const code_hash = crypto.createHash('sha256').update(rawCode).digest('hex');
        const expires_at = new Date(Date.now() + 10 * 60 * 1000);
        await prisma.authorizationCode.create({
            data: {
                code_hash,
                user_id: session.user_id,
                application_id: app.id,
                sso_session_id: session.id,
                redirect_uri: redirectUriStr,
                code_challenge: codeChallengeStr,
                code_challenge_method: codeChallengeMethodStr,
                expires_at,
            }
        });
        await prisma.auditLog.create({
            data: {
                event_type: 'authorization_code_issued',
                actor_id: session.user_id,
                user_id: session.user_id,
                application_id: app.id,
                session_id: session.id,
                result: 'granted',
                ip_address: (req.ip || req.headers['x-forwarded-for'] || null) as string | null,
            }
        });
        const targetUrl = new URL(redirectUriStr);
        targetUrl.searchParams.set('code', rawCode);
        targetUrl.searchParams.set('state', stateStr);
        return res.redirect(302, targetUrl.toString());
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/auth/token
router.post('/token', async (req: any, res: Response) => {
    const prisma = req.prisma;
    const { grant_type, code, client_id, redirect_uri, code_verifier } = req.body;
    if (grant_type !== 'authorization_code' || !code || !client_id || !redirect_uri) {
        return res.status(400).json({ success: false, error: 'grant_type must be authorization_code, and code, client_id, redirect_uri are required' });
    }
    try {
        const code_hash = crypto.createHash('sha256').update(code).digest('hex');
        const authCode = await prisma.authorizationCode.findFirst({
            where: { code_hash },
            include: { application: true, sso_session: true },
        });
        if (!authCode || authCode.application.client_id !== client_id) {
            return res.status(400).json({ success: false, error: 'Invalid authorization code or client_id' });
        }
        if (authCode.redirect_uri !== redirect_uri) {
            return res.status(400).json({ success: false, error: 'Invalid redirect_uri' });
        }
        if (authCode.expires_at < new Date()) {
            return res.status(400).json({ success: false, error: 'Authorization code has expired' });
        }
        
        // PKCE Validation
        if (authCode.code_challenge) {
            if (!code_verifier) {
                return res.status(400).json({ success: false, error: 'code_verifier is required' });
            }
            if (authCode.code_challenge_method === 'S256') {
                const expectedChallenge = crypto.createHash('sha256').update(code_verifier).digest('base64url');
                if (expectedChallenge !== authCode.code_challenge) {
                    return res.status(400).json({ success: false, error: 'Invalid code_verifier' });
                }
            } else if (code_verifier !== authCode.code_challenge) {
                return res.status(400).json({ success: false, error: 'Invalid code_verifier' });
            }
        }

        // Check central session validity
        if (!authCode.sso_session || authCode.sso_session.status !== 'active' || authCode.sso_session.expires_at < new Date()) {
            return res.status(400).json({ success: false, error: 'Central session is no longer active' });
        }

        // Atomic check and update for used_at
        const updatedAuthCode = await prisma.authorizationCode.updateMany({
            where: {
                id: authCode.id,
                used_at: null,
            },
            data: { used_at: new Date() },
        });

        if (updatedAuthCode.count === 0) {
            await prisma.auditLog.create({
                data: {
                    event_type: 'code_replay_attempt',
                    actor_id: authCode.user_id,
                    user_id: authCode.user_id,
                    application_id: authCode.application_id,
                    session_id: authCode.sso_session_id,
                    result: 'denied',
                    metadata: JSON.stringify({ reason: 'Attempted to reuse authorization code' }),
                    ip_address: (req.ip || req.headers['x-forwarded-for'] || null) as string | null,
                }
            });
            return res.status(400).json({ success: false, error: 'Authorization code already used' });
        }
        const rawAccessToken = crypto.randomBytes(32).toString('hex');
        const token_hash = crypto.createHash('sha256').update(rawAccessToken).digest('hex');
        const expires_at = new Date(Date.now() + 60 * 60 * 1000); // access token 1 jam
        await prisma.accessToken.create({
            data: {
                token_hash,
                user_id: authCode.user_id,
                application_id: authCode.application_id,
                sso_session_id: authCode.sso_session_id,
                status: 'active',
                expires_at,
            }
        });
        await prisma.auditLog.create({
            data: {
                event_type: 'token_issued',
                actor_id: authCode.user_id,
                user_id: authCode.user_id,
                application_id: authCode.application_id,
                session_id: authCode.sso_session_id,
                result: 'granted',
                ip_address: (req.ip || req.headers['x-forwarded-for'] || null) as string | null,
            }
        });
        res.json({
            access_token: rawAccessToken,
            token_type: 'Bearer',
            expires_in: 3600,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/auth/userinfo
router.get('/userinfo', async (req: any, res: Response) => {
    const prisma = req.prisma;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
    }
    const rawAccessToken = authHeader.split(' ')[1];
    try {
        const token_hash = crypto.createHash('sha256').update(rawAccessToken).digest('hex');
        const tokenRecord = await prisma.accessToken.findFirst({
            where: {
                token_hash,
                status: 'active',
                expires_at: { gt: new Date() },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        status: true,
                        user_groups: {
                            include: {
                                group: true,
                            }
                        }
                    }
                }
            }
        });
        if (!tokenRecord || !tokenRecord.user || tokenRecord.user.status !== 'active') {
            return res.status(401).json({ success: false, error: 'Invalid or expired access token' });
        }
        const user = tokenRecord.user;
        const groups = user.user_groups.map((ug: any) => ug.group.name);
        res.json({
            sub: user.id,
            session_id: tokenRecord.sso_session_id,
            name: user.name,
            email: user.email,
            status: user.status,
            groups,
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ALL /api/auth/logout
router.all('/logout', async (req: any, res: Response) => {
    const prisma = req.prisma;
    const rawSessionToken = req.cookies?.sso_session;
    const redirect_uri = req.query?.redirect_uri || req.body?.redirect_uri;
    if (rawSessionToken) {
        try {
            const session_token_hash = hashSessionToken(rawSessionToken);
            const session = await prisma.ssoSession.findFirst({
                where: { session_token_hash, status: 'active' },
            });
            if (session) {
                await prisma.$transaction(async (tx: any) => {
                    await tx.ssoSession.update({
                        where: { id: session.id },
                        data: {
                            status: 'revoked',
                            revoked_at: new Date(),
                            revoke_reason: 'User logged out centrally',
                        },
                    });
                    await tx.auditLog.create({
                        data: {
                            event_type: 'sso_logout',
                            actor_id: session.user_id,
                            user_id: session.user_id,
                            session_id: session.id,
                            result: 'success',
                            ip_address: (req.ip || req.headers['x-forwarded-for'] || null) as string | null,
                        },
                    });
                    await tx.event.create({
                        data: {
                            event_type: 'SessionRevoked',
                            user_id: session.user_id,
                            central_session_id: session.id,
                            payload: JSON.stringify({
                                event_type: 'SessionRevoked',
                                user_id: session.user_id,
                                central_session_id: session.id,
                                revoked_at: new Date().toISOString(),
                                reason: 'User logged out centrally',
                            }),
                            status: 'pending',
                        },
                    });
                });
            }
        } catch (e) {
            console.error('Logout outbox transaction error:', e);
        }
    }
    res.clearCookie('sso_session', { path: '/' });
    if (redirect_uri) {
        return res.redirect(302, String(redirect_uri));
    }
    res.json({ success: true, message: 'Central SSO session revoked successfully' });
});

export default router;