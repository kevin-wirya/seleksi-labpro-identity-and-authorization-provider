import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';

export async function POST(request:NextRequest){
    try{
        const body=await request.json();
        const{event_id,event_type,user_id,central_session_id}=body;
        if(!event_id||!user_id){
            return NextResponse.json({error:'Missing event_id or user_id'},{status:400});
        }
        const existingEvent=await prisma.processedEvent.findUnique({
            where:{event_id},
        });
        if(existingEvent){
            return NextResponse.json({success:true,message:'Event already processed'},{status:200});
        }
        await prisma.localSession.updateMany({
            where:{external_user_id:user_id,status:'active'},
            data:{status:'revoked',revoked_at:new Date(),revoke_reason:'central_sso_revocation'},
        });
        await prisma.processedEvent.create({
            data:{
                event_id,
                event_type:event_type||'SessionRevoked',
                result:'success',
                processed_at:new Date(),
            },
        });

        try{
            await prisma.auditLog.create({
                data:{
                    event_type:'LocalSessionRevoked',
                    user_id,
                    result:'success',
                    metadata:JSON.stringify({event_id,reason:'Webhook Central SSO Revocation'}),
                },
            });
        }catch(e){}

        return NextResponse.json({success:true,message:'Local session revoked successfully'},{status:200});
    }catch(err:any){
        return NextResponse.json({error:err.message},{status:500});
    }
}