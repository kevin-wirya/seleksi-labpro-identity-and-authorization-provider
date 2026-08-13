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
    return NextResponse.json({
        success:true,
        message:'Authorization Code received successfully on front-channel callback',
        code,
        state,
    });
}
