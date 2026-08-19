export async function revokeNonCompliantSessions(tx: any,targetAppId?: string,targetUserId?: string){
    const activeSessions=await tx.ssoSession.findMany({
        where:{
            status:'active',
            ...(targetUserId?{user_id:targetUserId}:{}),
        },
        include:{
            user:{include:{user_groups:true}},
        },
    });

    const applications=await tx.application.findMany({
        where:targetAppId?{id:targetAppId}:{status:'active'},
        include:{group_policies:true},
    });

    for(const session of activeSessions){
        if(!session.user||session.user.status!=='active'){
            await tx.ssoSession.update({where:{id:session.id},data:{status:'revoked'}});
            await tx.event.create({
                data:{
                    event_type:'SessionRevoked',
                    user_id:session.user_id,
                    session_id:session.id,
                    payload:JSON.stringify({event_type:'SessionRevoked',user_id:session.user_id,central_session_id:session.id,reason:'User deactivated'}),
                    status:'pending',
                },
            });
            continue;
        }

        const userGroupIds=session.user.user_groups.map((ug: any)=>ug.group_id);
        for(const app of applications){
            const policies=app.group_policies;
            let isAllowed=true;
            if(policies.length>0){
                const hasDeny=policies.some((p: any)=>p.effect==='deny'&&userGroupIds.includes(p.group_id));
                const allowPolicies=policies.filter((p: any)=>p.effect==='allow');
                if(hasDeny){
                    isAllowed=false;
                }else if(allowPolicies.length>0){
                    const hasAllow=allowPolicies.some((p: any)=>userGroupIds.includes(p.group_id));
                    if(!hasAllow){
                        isAllowed=false;
                    }
                }
            }
            if(!isAllowed){
                await tx.ssoSession.update({where:{id:session.id},data:{status:'revoked'}});
                await tx.event.create({
                    data:{
                        event_type:'SessionRevoked',
                        user_id:session.user_id,
                        application_id:app.id,
                        session_id:session.id,
                        payload:JSON.stringify({event_type:'SessionRevoked',user_id:session.user_id,central_session_id:session.id,reason:'User lost policy access'}),
                        status:'pending',
                    },
                });
                break;
            }
        }
    }
}
