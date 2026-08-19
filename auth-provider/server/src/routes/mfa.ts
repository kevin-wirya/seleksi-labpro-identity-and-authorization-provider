import express,{Request,Response} from 'express';
import{generateTotpSecret,getTotpAuthUrl,verifyTotp,computeTotp,generateRecoveryCodes} from '../utils/totp';

const router=express.Router();

// POST /api/auth/mfa/setup
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

// POST /api/auth/mfa/verify
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

// POST /api/auth/mfa/enable
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

        res.json({success:true,message:'MFA enabled successfully'});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/auth/mfa/disable
router.post('/disable',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{email}=req.body;
    if(!email){
        return res.status(400).json({success:false,error:'Email is required'});
    }
    try{
        await prisma.user.update({
            where:{email},
            data:{mfa_enabled:false},
        });
        res.json({success:true,message:'MFA disabled successfully'});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// GET /api/auth/mfa/ui or /mfa-ui
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
        body{background-color:#060907;color:#f4f4f5;min-height:100vh;padding:32px 24px;background-image:radial-gradient(circle at 50% 20%,rgba(16,185,129,0.12) 0%,transparent 60%);}
        .container{max-width:900px;margin:0 auto;}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid rgba(16,185,129,0.2);}
        .title-box{display:flex;align-items:center;gap:14px;}
        .icon-box{width:48px;height:48px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:14px;display:flex;align-items:center;justify-content:center;}
        .title{font-size:24px;font-weight:900;color:#ffffff;}
        .subtitle{font-size:13px;color:#a1a1aa;margin-top:2px;}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:24px;}
        .card{background:#0f1712;border:1px solid rgba(16,185,129,0.2);border-radius:20px;padding:24px;box-shadow:0 20px 40px -15px rgba(0,0,0,0.7);backdrop-filter:blur(16px);}
        .card-title{font-size:14px;color:#34d399;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:16px;display:flex;align-items:center;gap:8px;}
        .form-group{margin-bottom:16px;}
        label{display:block;font-size:12px;font-weight:700;color:#a1a1aa;margin-bottom:6px;text-transform:uppercase;}
        input[type="text"],input[type="email"]{width:100%;background:#060907;border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:12px;color:#ffffff;font-size:14px;outline:none;}
        input:focus{border-color:#34d399;}
        button{width:100%;background:#059669;color:#ffffff;font-weight:700;padding:12px;border:none;border-radius:10px;cursor:pointer;transition:all 0.2s;font-size:14px;}
        button:hover{background:#10b981;}
        .code-display{background:#060907;border:1px solid rgba(245,158,11,0.4);border-radius:12px;padding:16px;text-align:center;margin-top:12px;}
        .code-val{font-family:monospace;font-size:32px;font-weight:900;color:#fbbf24;letter-spacing:6px;}
        .secret-val{font-family:monospace;font-size:13px;color:#a1a1aa;word-break:break-all;margin-top:6px;}
        .alert{padding:12px;border-radius:10px;font-size:13px;margin-top:12px;display:none;}
        .alert-success{background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);}
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
                    <div class="title">MFA / 2FA TOTP Portal</div>
                    <div class="subtitle">Multi-Factor Authentication Setup & Live Verification Portal</div>
                </div>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-title">🔐 TOTP Secret Generator & Simulator</div>
                <div class="form-group">
                    <label>Base32 Secret Key</label>
                    <input type="text" id="gen_secret" value="${sampleSecret}" readonly>
                </div>
                <div class="code-display">
                    <div style="font-size:11px;color:#a1a1aa;margin-bottom:4px;">CURRENT 6-DIGIT CODE</div>
                    <div class="code-val" id="current_code">${sampleCode}</div>
                    <div class="secret-val" id="timer_text">Refreshes in 30s</div>
                </div>
                <button style="margin-top:16px;background:#3b82f6;" onclick="regenerateSecret()">Generate New Secret</button>
            </div>

            <div class="card">
                <div class="card-title">✅ Test TOTP Verification</div>
                <div class="form-group">
                    <label>Base32 Secret</label>
                    <input type="text" id="verify_secret" value="${sampleSecret}">
                </div>
                <div class="form-group">
                    <label>6-Digit TOTP Code</label>
                    <input type="text" id="verify_token" placeholder="e.g. ${sampleCode}" maxlength="6">
                </div>
                <button onclick="testVerify()">Verify Code</button>
                <div id="verify_alert" class="alert"></div>
            </div>
        </div>
    </div>

    <script>
        let secret='${sampleSecret}';
        async function testVerify(){
            const sec=document.getElementById('verify_secret').value;
            const tok=document.getElementById('verify_token').value;
            const alertBox=document.getElementById('verify_alert');
            try{
                const res=await fetch('/api/auth/mfa/verify',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({secret:sec,token:tok})
                });
                const data=await res.json();
                alertBox.style.display='block';
                if(data.success){
                    alertBox.className='alert alert-success';
                    alertBox.innerText='✅ TOTP Verification Successful!';
                }else{
                    alertBox.className='alert alert-error';
                    alertBox.innerText='❌ '+data.error;
                }
            }catch(e){
                alertBox.style.display='block';
                alertBox.className='alert alert-error';
                alertBox.innerText='❌ Server connection failed';
            }
        }
        function regenerateSecret(){
            location.reload();
        }
    </script>
</body>
</html>`;
    res.send(html);
});

export default router;
