import express,{Request,Response} from 'express';
import crypto from 'crypto';
import{generateTotpSecret,getTotpAuthUrl,verifyTotp,generateRecoveryCodes} from '../utils/totp';

const router=express.Router();

async function getAuthenticatedUser(req: any,prisma: any){
    const rawSessionToken=req.cookies?.sso_session;
    if(!rawSessionToken) return null;
    try{
        const session_token_hash=crypto.createHash('sha256').update(rawSessionToken).digest('hex');
        const session=await prisma.ssoSession.findFirst({
            where:{session_token_hash,status:'active',expires_at:{gt:new Date()}},
            include:{user:true},
        });
        if(!session||!session.user||session.user.status!=='active') return null;
        return session.user;
    }catch(e){
        return null;
    }
}

// setup mfa
router.post('/setup',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const authUser=await getAuthenticatedUser(req,prisma);
    const targetEmail=authUser?authUser.email:(req.body.email||'');
    if(!authUser&&!req.body.email){
        return res.status(401).json({success:false,error:'Authentication required. Please log in first.'});
    }
    if(authUser&&req.body.email&&req.body.email!==authUser.email){
        return res.status(403).json({success:false,error:'Forbidden: Cannot modify MFA setup for another user'});
    }
    try{
        const secret=generateTotpSecret();
        const otpauth_url=getTotpAuthUrl(targetEmail||'user@example.com',secret);
        const{plainCodes,hashedCodes}=generateRecoveryCodes();
        
        if(targetEmail){
            await prisma.user.updateMany({
                where:{email:targetEmail},
                data:{
                    mfa_secret:secret,
                    mfa_recovery_codes:JSON.stringify(hashedCodes),
                },
            });
        }

        res.json({
            success:true,
            secret,
            otpauth_url,
            recovery_codes:plainCodes,
        });
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// verify mfa token
router.post('/verify',async(req: any,res: Response)=>{
    const{token,secret}=req.body;
    if(!token||!secret){
        return res.status(400).json({success:false,error:'Token and secret are required'});
    }
    const isValid=verifyTotp(token,secret);
    if(isValid){
        return res.json({success:true,message:'TOTP token verified successfully'});
    }
    res.status(400).json({success:false,error:'Invalid TOTP token or expired window'});
});

// enable mfa user
router.post('/enable',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const authUser=await getAuthenticatedUser(req,prisma);
    const email=authUser?authUser.email:req.body.email;
    if(!authUser&&!req.body.email){
        return res.status(401).json({success:false,error:'Authentication required. Please log in first.'});
    }
    if(authUser&&req.body.email&&req.body.email!==authUser.email){
        return res.status(403).json({success:false,error:'Forbidden: Cannot enable MFA for another user'});
    }
    const{token,secret}=req.body;
    try{
        const user=await prisma.user.findUnique({where:{email}});
        if(!user)return res.status(404).json({success:false,error:'User not found'});

        const targetSecret=secret||user.mfa_secret;
        if(token&&targetSecret){
            const isValid=verifyTotp(token,targetSecret);
            if(!isValid){
                return res.status(400).json({success:false,error:'Invalid TOTP verification code'});
            }
        }

        await prisma.user.update({
            where:{email},
            data:{
                mfa_enabled:true,
                mfa_secret:targetSecret||generateTotpSecret(),
            },
        });

        try{
            await prisma.auditLog.create({
                data:{
                    event_type:'mfa_enrolled',
                    actor_id:user.id,
                    user_id:user.id,
                    result:'success',
                    metadata:JSON.stringify({email:user.email}),
                    ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string|null,
                },
            });
        }catch(e){}

        res.json({success:true,message:'MFA enabled successfully'});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// disable mfa user
router.post('/disable',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const authUser=await getAuthenticatedUser(req,prisma);
    if(!authUser&&!req.body.email){
        return res.status(401).json({success:false,error:'Authentication required. Please log in first.'});
    }
    const email=authUser?authUser.email:req.body.email;
    if(authUser&&req.body.email&&req.body.email!==authUser.email){
        return res.status(403).json({success:false,error:'Forbidden: Cannot disable MFA for another user'});
    }
    try{
        const user=await prisma.user.findUnique({where:{email}});
        await prisma.user.update({
            where:{email},
            data:{mfa_enabled:false},
        });

        if(user){
            try{
                await prisma.auditLog.create({
                    data:{
                        event_type:'mfa_disabled',
                        actor_id:user.id,
                        user_id:user.id,
                        result:'success',
                        metadata:JSON.stringify({email:user.email}),
                        ip_address:(req.ip||req.headers['x-forwarded-for']||null) as string|null,
                    },
                });
            }catch(e){}
        }

        res.json({success:true,message:'MFA disabled successfully'});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// generate recovery codes for user
router.post('/generate-recovery-codes',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const authUser=await getAuthenticatedUser(req,prisma);
    if(!authUser){
        return res.status(401).json({success:false,error:'Authentication required to generate recovery codes. Please log in first.'});
    }
    const targetEmail=authUser.email;
    if(req.body.email&&req.body.email!==targetEmail){
        return res.status(403).json({success:false,error:'Forbidden: Cannot generate recovery codes for another user'});
    }
    try{
        const user=await prisma.user.findUnique({where:{email:targetEmail}});
        if(!user) return res.status(404).json({success:false,error:'User not found'});
        const{plainCodes,hashedCodes}=generateRecoveryCodes();
        await prisma.user.update({
            where:{email:targetEmail},
            data:{mfa_recovery_codes:JSON.stringify(hashedCodes)},
        });
        res.json({success:true,email:user.email,recovery_codes:plainCodes});
    }catch(e: any){
        res.status(500).json({success:false,error:e.message});
    }
});

// get user totp secret and setup info (without server-side OTP code generation)
router.get('/user-secret',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const authUser=await getAuthenticatedUser(req,prisma);
    if(!authUser){
        return res.status(401).json({success:false,error:'Authentication required to view TOTP secret. Please log in first.'});
    }
    const targetEmail=authUser.email;
    if(req.query.email&&String(req.query.email)!==targetEmail){
        return res.status(403).json({success:false,error:'Forbidden: Cannot view secret for another user'});
    }
    try{
        let user=await prisma.user.findUnique({where:{email:targetEmail}});
        if(!user) return res.status(404).json({success:false,error:'User not found'});
        // if MFA is already enabled, do not expose secret
        if(user.mfa_enabled){
            return res.json({
                success:true,
                email:user.email,
                secret:'•••••••••••••••• (Protected)',
                otpauth_url:'',
                mfa_enabled:true,
            });
        }
        if(!user.mfa_secret){
            const secret=generateTotpSecret();
            const{hashedCodes}=generateRecoveryCodes();
            user=await prisma.user.update({
                where:{email:targetEmail},
                data:{mfa_secret:secret,mfa_recovery_codes:JSON.stringify(hashedCodes)},
            });
        }
        const otpauth_url=getTotpAuthUrl(user.email,user.mfa_secret!);
        res.json({
            success:true,
            email:user.email,
            secret:user.mfa_secret,
            otpauth_url,
            mfa_enabled:false,
        });
    }catch(e: any){
        res.status(500).json({success:false,error:e.message});
    }
});

// mfa ui portal
router.get('/ui',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const authUser=await getAuthenticatedUser(req,prisma);
    const defaultEmail=authUser?authUser.email:'admin@sso.local';
    const authBanner=authUser 
        ? `<div style="background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);color:#4ade80;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:700;margin-bottom:24px;display:flex;align-items:center;gap:8px;">
            <span>🟢 Terautentikasi Sesi SSO sebagai: <strong>${authUser.email}</strong></span>
           </div>`
        : `<div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;padding:10px 14px;border-radius:10px;font-size:13px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;">
            <span>🔴 <strong>Belum Login SSO:</strong> Silakan login terlebih dahulu untuk mengelola MFA / Recovery Code akun Anda.</span>
            <a href="/login" style="background:#ef4444;color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none;font-weight:700;font-size:12px;">Login SSO</a>
           </div>`;

    const html=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MFA / TOTP Authenticator Portal - Auth Provider</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
    <style>
        *{box-sizing:border-box;margin:0;padding:0;font-family:'Plus Jakarta Sans',sans-serif;}
        body{background-color:#0b0a06;color:#f4f4f5;min-height:100vh;padding:32px 24px;background-image:radial-gradient(circle at 50% 20%,rgba(245,158,11,0.15) 0%,transparent 60%);}
        .container{max-width:960px;margin:0 auto;}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid rgba(245,158,11,0.25);}
        .title-box{display:flex;align-items:center;gap:14px;}
        .icon-box{width:48px;height:48px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:14px;display:flex;align-items:center;justify-content:center;}
        .title{font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;}
        .subtitle{font-size:13px;color:#a1a1aa;margin-top:2px;}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:24px;}
        .card{background:#14110b;border:1px solid rgba(245,158,11,0.25);border-radius:20px;padding:24px;box-shadow:0 20px 40px -15px rgba(0,0,0,0.7);backdrop-filter:blur(16px);}
        .card-title{font-size:14px;color:#fbbf24;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;display:flex;align-items:center;gap:8px;}
        .form-group{margin-bottom:16px;}
        label{display:block;font-size:11px;font-weight:700;color:#a1a1aa;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;}
        input[type="text"],input[type="email"]{width:100%;background:#060503;border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:12px;color:#ffffff;font-size:14px;outline:none;}
        input:focus{border-color:#fbbf24;box-shadow:0 0 0 2px rgba(251,191,36,0.2);}
        button{width:100%;background:#d97706;color:#ffffff;font-weight:700;padding:12px;border:none;border-radius:10px;cursor:pointer;transition:all 0.2s;font-size:14px;}
        button:hover{background:#f59e0b;}
        .qr-box{background:#060503;border:1px solid rgba(245,158,11,0.3);border-radius:14px;padding:16px;text-align:center;margin-top:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;}
        .qr-img{width:160px;height:160px;background:#ffffff;padding:8px;border-radius:12px;margin:8px 0;}
        .secret-val{font-family:'JetBrains Mono',monospace;font-size:14px;color:#fbbf24;word-break:break-all;margin-top:8px;background:rgba(245,158,11,0.1);padding:8px 12px;border-radius:8px;border:1px solid rgba(245,158,11,0.2);letter-spacing:2px;font-weight:700;}
        .badge{display:inline-block;padding:3px 10px;border-radius:9999px;font-size:11px;font-weight:700;text-transform:uppercase;}
        .badge-active{background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.3);}
        .badge-disabled{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
        .alert{padding:12px;border-radius:10px;font-size:13px;margin-top:12px;display:none;}
        .alert-success{background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.3);}
        .alert-error{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
        .note-box{background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:12px;font-size:12px;color:#93c5fd;line-height:1.5;margin-top:12px;}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title-box">
                <div class="icon-box">
                    <svg style="width:26px;height:26px;color:#fbbf24;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                </div>
                <div>
                    <div class="title">MFA / TOTP Portal</div>
                    <div class="subtitle">RFC 6238 Time-based One-Time Password Enrollment & Verification Portal</div>
                </div>
            </div>
        </div>

        ${authBanner}

        <div class="grid">
            <!-- Card 1: Setup & QR Code -->
            <div class="card">
                <div class="card-title">📱 Step 1: Authenticator QR Enrollment</div>
                <div class="form-group">
                    <label>User Email</label>
                    <input type="email" id="lookup_email" value="${defaultEmail}" placeholder="user@example.com">
                </div>
                <button style="margin-bottom:14px;" onclick="loadUserSetup()">Get Authenticator QR Code & Shared Secret</button>
                
                <div class="qr-box" id="qr_container">
                    <div style="font-size:12px;color:#a1a1aa;">Masukkan Email & Klik tombol di atas</div>
                </div>

                <div class="note-box">
                    💡 <strong>RFC 6238 TOTP Standard:</strong> Server hanya membagikan <em>Shared Secret</em> saat enrollment. Scan QR Code menggunakan <strong>Google Authenticator / Authy / 2FA App</strong> di Ponsel Anda. Kode 6-digit di-generate secara lokal oleh Ponsel Anda.
                </div>
            </div>

            <!-- Card 2: Verify Code & Enable MFA -->
            <div class="card">
                <div class="card-title">🔒 Step 2: Verify Authenticator Code</div>
                <p style="font-size:12px;color:#a1a1aa;margin-bottom:14px;line-height:1.4;">Masukkan kode 6 digit yang dihasilkan oleh aplikasi Authenticator di Ponsel Anda untuk menguji dan mengaktifkan MFA akun.</p>
                <div class="form-group">
                    <label>6-Digit Code</label>
                    <input type="text" id="verify_code_input" placeholder="123456" maxlength="6" style="text-align:center;letter-spacing:4px;font-weight:700;font-size:18px;">
                </div>
                <button style="background:#d97706;margin-bottom:14px;" onclick="verifyAuthenticatorCode()">Verify & Enable MFA</button>
                <div id="verify_alert" class="alert"></div>

                <hr style="border:none;border-top:1px solid rgba(245,158,11,0.2);margin:20px 0;">

                <div class="card-title">🔑 Single-Use Recovery Codes</div>
                <p style="font-size:12px;color:#a1a1aa;margin-bottom:14px;line-height:1.4;">Recovery Code digunakan jika Ponsel hilang. Setiap kode hanya dapat dipakai 1x.</p>
                <button style="background:#d97706;margin-bottom:14px;" onclick="fetchRecoveryCodes()">Generate 8 Recovery Codes</button>
                <div id="recovery_list" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#060907;padding:12px;border-radius:10px;border:1px solid rgba(245,158,11,0.3);min-height:70px;">
                    <div style="grid-column:1/-1;font-size:12px;color:#a1a1aa;text-align:center;padding:16px 0;">Klik tombol di atas untuk membuat 8 kode pemulihan baru</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let currentSecret='';

        async function loadUserSetup(){
            const email=document.getElementById('lookup_email').value;
            const container=document.getElementById('qr_container');
            container.innerHTML='<div style="font-size:12px;color:#a1a1aa;padding:20px 0;">Memuat Shared Secret & QR Code...</div>';
            try{
                const res=await fetch('/api/auth/mfa/user-secret?email='+encodeURIComponent(email));
                const data=await res.json();
                if(data.success){
                    currentSecret=data.secret;
                    const statusBadge=data.mfa_enabled 
                        ?'<span class="badge badge-active">MFA ACTIVE</span>' 
                        :'<span class="badge badge-disabled">MFA DISABLED</span>';
                    
                    const qrApiUrl='https://api.qrserver.com/v1/create-qr-code/?size=180x180&data='+encodeURIComponent(data.otpauth_url);
                    
                    container.innerHTML=\`
                        <div style="margin-bottom:8px;">\${statusBadge}</div>
                        <img class="qr-img" src="\${qrApiUrl}" alt="Authenticator QR Code" />
                        <div style="font-size:11px;color:#a1a1aa;margin-top:4px;">Base32 Shared Secret (Manual Entry):</div>
                        <div class="secret-val">\${data.secret}</div>
                    \`;
                }else{
                    container.innerHTML='<div style="color:#fca5a5;font-size:13px;padding:20px 0;">Error: '+(data.error||'Failed to load')+'</div>';
                }
            }catch(e){
                container.innerHTML='<div style="color:#fca5a5;font-size:13px;padding:20px 0;">Gagal terhubung ke Auth Provider Server</div>';
            }
        }

        async function verifyAuthenticatorCode(){
            const email=document.getElementById('lookup_email').value;
            const token=document.getElementById('verify_code_input').value.trim();
            const alert=document.getElementById('verify_alert');
            alert.style.display='none';
            if(!token||token.length!==6){
                alert.className='alert alert-error';
                alert.innerText='Masukkan 6-digit kode TOTP dari Google Authenticator';
                alert.style.display='block';
                return;
            }
            try{
                const res=await fetch('/api/auth/mfa/enable',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({email,token,secret:currentSecret})
                });
                const data=await res.json();
                if(data.success){
                    alert.className='alert alert-success';
                    alert.innerText='✅ '+data.message;
                    alert.style.display='block';
                    loadUserSetup();
                }else{
                    alert.className='alert alert-error';
                    alert.innerText='❌ '+(data.error||'Verifikasi gagal. Pastikan jam HP Anda akurat.');
                    alert.style.display='block';
                }
            }catch(e){
                alert.className='alert alert-error';
                alert.innerText='Gagal menghubungi server';
                alert.style.display='block';
            }
        }

        async function fetchRecoveryCodes(){
            const email=document.getElementById('lookup_email').value;
            const list=document.getElementById('recovery_list');
            list.innerHTML='<div style="grid-column:1/-1;font-size:12px;color:#a1a1aa;text-align:center;padding:16px 0;">Generating codes...</div>';
            try{
                const res=await fetch('/api/auth/mfa/generate-recovery-codes',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({email})
                });
                const data=await res.json();
                if(data.success&&data.recovery_codes){
                    list.innerHTML=data.recovery_codes.map(c=>'<div style="font-family:JetBrains Mono,monospace;font-size:13px;color:#fbbf24;background:rgba(245,158,11,0.1);padding:6px;border-radius:6px;text-align:center;font-weight:700;border:1px solid rgba(245,158,11,0.25);">'+c+'</div>').join('');
                }else{
                    list.innerHTML='<div style="grid-column:1/-1;color:#fca5a5;font-size:12px;text-align:center;">'+(data.error||'Failed to generate')+'</div>';
                }
            }catch(e){
                list.innerHTML='<div style="grid-column:1/-1;color:#fca5a5;font-size:12px;text-align:center;">Error connecting to server</div>';
            }
        }

        window.onload=()=>{
            loadUserSetup();
        };
    </script>
</body>
</html>`;
    res.send(html);
});

export default router;
