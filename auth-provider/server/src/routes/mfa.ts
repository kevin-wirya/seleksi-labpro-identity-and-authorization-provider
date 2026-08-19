import express,{Request,Response} from 'express';
import{generateTotpSecret,getTotpAuthUrl,verifyTotp,computeTotp,generateRecoveryCodes} from '../utils/totp';

const router=express.Router();

// setup mfa
router.post('/setup',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{email}=req.body;
    try{
        const secret=generateTotpSecret();
        const otpauth_url=getTotpAuthUrl(email||'user@example.com',secret);
        const{plainCodes,hashedCodes}=generateRecoveryCodes();
        
        if(email){
            await prisma.user.updateMany({
                where:{email},
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
    const{email,token,secret}=req.body;
    if(!email){
        return res.status(400).json({success:false,error:'Email is required'});
    }
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
    const{email}=req.body;
    if(!email){
        return res.status(400).json({success:false,error:'Email is required'});
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
    const{email}=req.body;
    if(!email) return res.status(400).json({success:false,error:'Email required'});
    try{
        const user=await prisma.user.findUnique({where:{email:String(email)}});
        if(!user) return res.status(404).json({success:false,error:'User not found'});
        const{plainCodes,hashedCodes}=generateRecoveryCodes();
        await prisma.user.update({
            where:{email:String(email)},
            data:{mfa_recovery_codes:JSON.stringify(hashedCodes)},
        });
        res.json({success:true,email:user.email,recovery_codes:plainCodes});
    }catch(e: any){
        res.status(500).json({success:false,error:e.message});
    }
});

// get user totp secret
router.get('/user-secret',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{email}=req.query;
    if(!email) return res.status(400).json({success:false,error:'Email required'});
    try{
        let user=await prisma.user.findUnique({where:{email:String(email)}});
        if(!user) return res.status(404).json({success:false,error:'User not found'});
        if(!user.mfa_secret){
            const secret=generateTotpSecret();
            const{hashedCodes}=generateRecoveryCodes();
            user=await prisma.user.update({
                where:{email:String(email)},
                data:{mfa_secret:secret,mfa_recovery_codes:JSON.stringify(hashedCodes)},
            });
        }
        const currentCounter=Math.floor(Date.now()/30000);
        const code=computeTotp(user.mfa_secret!,currentCounter);
        res.json({
            success:true,
            email:user.email,
            secret:user.mfa_secret,
            code,
            mfa_enabled:user.mfa_enabled,
        });
    }catch(e: any){
        res.status(500).json({success:false,error:e.message});
    }
});

// mfa ui portal
router.get('/ui',(req: Request,res: Response)=>{
    const sampleSecret=generateTotpSecret();
    const currentCounter=Math.floor(Date.now()/30000);
    const sampleCode=computeTotp(sampleSecret,currentCounter);

    const html=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MFA / TOTP Portal - Auth Provider</title>
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap" rel="stylesheet">
    <style>
        *{box-sizing:border-box;margin:0;padding:0;font-family:'Lato',sans-serif;}
        body{background-color:#0b0a06;color:#f4f4f5;min-height:100vh;padding:32px 24px;background-image:radial-gradient(circle at 50% 20%,rgba(245,158,11,0.15) 0%,transparent 60%);}
        .container{max-width:900px;margin:0 auto;}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid rgba(245,158,11,0.25);}
        .title-box{display:flex;align-items:center;gap:14px;}
        .icon-box{width:48px;height:48px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:14px;display:flex;align-items:center;justify-content:center;}
        .title{font-size:24px;font-weight:900;color:#ffffff;}
        .subtitle{font-size:13px;color:#a1a1aa;margin-top:2px;}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:24px;}
        .card{background:#14110b;border:1px solid rgba(245,158,11,0.25);border-radius:20px;padding:24px;box-shadow:0 20px 40px -15px rgba(0,0,0,0.7);backdrop-filter:blur(16px);}
        .card-title{font-size:14px;color:#fbbf24;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;display:flex;align-items:center;gap:8px;}
        .form-group{margin-bottom:16px;}
        label{display:block;font-size:12px;font-weight:700;color:#a1a1aa;margin-bottom:6px;text-transform:uppercase;}
        input[type="text"],input[type="email"]{width:100%;background:#060503;border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:12px;color:#ffffff;font-size:14px;outline:none;}
        input:focus{border-color:#fbbf24;}
        button{width:100%;background:#d97706;color:#ffffff;font-weight:700;padding:12px;border:none;border-radius:10px;cursor:pointer;transition:all 0.2s;font-size:14px;}
        button:hover{background:#f59e0b;}
        .code-display{background:#060503;border:1px solid rgba(245,158,11,0.4);border-radius:12px;padding:16px;text-align:center;margin-top:12px;}
        .code-val{font-family:monospace;font-size:32px;font-weight:900;color:#fbbf24;letter-spacing:6px;}
        .secret-val{font-family:monospace;font-size:13px;color:#a1a1aa;word-break:break-all;margin-top:6px;}
        .alert{padding:12px;border-radius:10px;font-size:13px;margin-top:12px;display:none;}
        .alert-success{background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);}
        .alert-error{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
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
                    <div class="title">MFA TOTP Portal</div>
                    <div class="subtitle">Multi-Factor Authentication Setup & Live Verification Portal</div>
                </div>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-title">👤 User Live TOTP Code Lookup</div>
                <div class="form-group">
                    <label>User Email</label>
                    <input type="email" id="lookup_email" value="heihachi@example.com" placeholder="user@example.com">
                </div>
                <button style="margin-bottom:14px;" onclick="lookupUserSecret()">Get Live Code for User</button>
                <div class="code-display" id="user_code_display">
                    <div style="font-size:11px;color:#a1a1aa;margin-bottom:4px;">LIVE USER TOTP CODE</div>
                    <div class="code-val" id="user_current_code">------</div>
                    <div class="secret-val" id="user_secret_val">Click button above to load</div>
                    <div style="font-size:12px;color:#fbbf24;margin-top:10px;font-weight:700;" id="timer_box">⏳ Refreshes in 30s</div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">🔑 Single-Use Recovery Codes</div>
                <p style="font-size:12px;color:#a1a1aa;margin-bottom:14px;line-height:1.4;">Recovery Code digunakan saat tidak membawa authenticator app. Setiap kode hanya bisa digunakan 1 kali.</p>
                <button style="background:#3b82f6;margin-bottom:14px;" onclick="fetchRecoveryCodes()">Generate 8 Recovery Codes</button>
                <div id="recovery_list" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#060907;padding:12px;border-radius:10px;border:1px solid rgba(59,130,246,0.3);min-height:90px;">
                    <div style="grid-column:1/-1;font-size:12px;color:#a1a1aa;text-align:center;padding:20px 0;">Klik tombol di atas untuk membuat 8 kode pemulihan baru</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        async function lookupUserSecret(){
            const email=document.getElementById('lookup_email').value;
            const codeVal=document.getElementById('user_current_code');
            const secretVal=document.getElementById('user_secret_val');
            try{
                const res=await fetch('/api/auth/mfa/user-secret?email='+encodeURIComponent(email));
                const data=await res.json();
                if(data.success){
                    codeVal.innerText=data.code;
                    secretVal.innerHTML='MFA Active: '+(data.mfa_enabled?'YES':'NO');
                }else{
                    codeVal.innerText='ERROR';
                    secretVal.innerText=data.error;
                }
            }catch(e){
                codeVal.innerText='ERROR';
                secretVal.innerText='Failed to load user secret';
            }
        }

        async function fetchRecoveryCodes(){
            const email=document.getElementById('lookup_email').value;
            const list=document.getElementById('recovery_list');
            list.innerHTML='<div style="grid-column:1/-1;font-size:12px;color:#a1a1aa;text-align:center;padding:20px 0;">Generating codes...</div>';
            try{
                const res=await fetch('/api/auth/mfa/generate-recovery-codes',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({email})
                });
                const data=await res.json();
                if(data.success&&data.recovery_codes){
                    list.innerHTML=data.recovery_codes.map(c=>'<div style="font-family:monospace;font-size:13px;color:#60a5fa;background:rgba(59,130,246,0.1);padding:6px;border-radius:6px;text-align:center;font-weight:700;border:1px solid rgba(59,130,246,0.2);">'+c+'</div>').join('');
                }else{
                    list.innerHTML='<div style="grid-column:1/-1;color:#fca5a5;font-size:12px;text-align:center;">'+(data.error||'Failed to generate')+'</div>';
                }
            }catch(e){
                list.innerHTML='<div style="grid-column:1/-1;color:#fca5a5;font-size:12px;text-align:center;">Error connecting to server</div>';
            }
        }

        function updateTimer(){
            const now=Math.floor(Date.now()/1000);
            const remaining=30-(now%30);
            const t1=document.getElementById('timer_box');
            if(t1) t1.innerText='⏳ Refreshes in '+remaining+'s';
            if(remaining===30){
                lookupUserSecret();
            }
        }

        window.onload=()=>{
            lookupUserSecret();
            setInterval(updateTimer,1000);
        };
    </script>
</body>
</html>`;
    res.send(html);
});

export default router;
