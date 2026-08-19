import { PrismaClient } from '@prisma/client';

export interface CreateAuditLogDTO {
    event_type: string;
    actor_id?: string | null;
    user_id?: string | null;
    application_id?: string | null;
    session_id?: string | null;
    result: 'success' | 'failed' | 'granted' | 'denied';
    metadata?: Record<string, any> | string | null;
    ip_address?: string | null;
}

export async function createAuditLog(prisma: PrismaClient,dto: CreateAuditLogDTO){
    try{
        const metadataStr=typeof dto.metadata==='object'&&dto.metadata!==null
            ?JSON.stringify(dto.metadata)
            :dto.metadata||null;

        return await prisma.auditLog.create({
            data:{
                event_type:dto.event_type,
                actor_id:dto.actor_id||null,
                user_id:dto.user_id||null,
                application_id:dto.application_id||null,
                session_id:dto.session_id||null,
                result:dto.result,
                metadata:metadataStr,
                ip_address:dto.ip_address||null,
            },
        });
    }catch(err: any){
        console.error('⚠️ Failed to write audit log:',err.message);
    }
}
