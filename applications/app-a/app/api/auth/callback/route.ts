import {NextRequest,NextResponse} from 'next/server';

export async function GET(request:NextRequest){
    const searchParams=request.nextUrl.searchParams;
    const code=searchParams.get('code');
    const state=searchParams.get('state');
    const error=searchParams.get('error');
    const errorDescription=searchParams.get('error_description');
    const savedState=request.cookies.get('oauth_state')?.value;
    if(!state||!savedState||state!==savedState) return NextResponse.json({success:false,error:'State mismatch / Possible CSRF attack detected'},{status:400});
    if(error) return NextResponse.json({success:false,error,error_description:errorDescription||'Access denied by Auth Provider policy'},{status:403});
    if(!code) return NextResponse.json({success:false,error:'Authorization code missing'},{status:400});
    // POST /token
    const tokenRes=await fetch('http://localhost:4000/api/auth/token',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            grant_type:'authorization_code',
            code,
            client_id:'app-a',
            redirect_uri:'http://localhost:3001/api/auth/callback',
        }),
    });
    const tokenData=await tokenRes.json();
    if(!tokenRes.ok||!tokenData.access_token) return NextResponse.json({success:false,error:tokenData.error||'Failed to exchange authorization code'},{status:400});
    // GET /userinfo
    const userinfoRes=await fetch('http://localhost:4000/api/auth/userinfo',{
        headers:{Authorization:`Bearer ${tokenData.access_token}`},
    });
    const userinfo=await userinfoRes.json();
    if(!userinfoRes.ok) return NextResponse.json({success:false,error:userinfo.error||'Failed to fetch userinfo'},{status:400});
    return NextResponse.json({
        success:true,
        message:'Back-channel token exchange and userinfo fetching successful',
        tokens:tokenData,
        userinfo,
    });
}
