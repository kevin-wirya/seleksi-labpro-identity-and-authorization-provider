import 'dotenv/config';
import amqp, { Channel, Connection } from 'amqplib';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString=process.env.DATABASE_URL||'postgresql://admin:secret@localhost:5432/sso_db?schema=public';
const rabbitUrl=process.env.RABBITMQ_URL||'amqp://guest:guest@localhost:5672';
const pool=new Pool({connectionString});
const adapter=new PrismaPg(pool);
const prisma=new PrismaClient({adapter});

let conn: any=null;
let channel: Channel | null=null;
let isShuttingDown=false;

async function startWorker(){
    try{
        conn=await amqp.connect(rabbitUrl);
        channel=await conn.createChannel();
        await channel.assertQueue('identity_events',{durable:true});
        await channel.assertQueue('identity_events_dlq',{durable:true});
        console.log('👷 [Sync Worker] Connected to RabbitMQ. Listening on identity_events...');
        channel.consume('identity_events',async(msg)=>{
            if(!msg||isShuttingDown)return;
            try{
                const eventData=JSON.parse(msg.content.toString());
                console.log(`📥 [Sync Worker] Processing event: ${eventData.id} (${eventData.event_type})`);
                const activeApps=await prisma.application.findMany({where:{status:'active'}});
                let allSuccess=true;
                for(const app of activeApps){
                    const webhookUrl=app.logout_notification_url;
                    if(!webhookUrl)continue;
                    let isSuccess=false;
                    let errorMsg: string | null=null;
                    try{
                        const res=await fetch(webhookUrl,{
                            method:'POST',
                            headers:{'Content-Type':'application/json'},
                            body:JSON.stringify({
                                event_id:eventData.id,
                                event_type:eventData.event_type,
                                user_id:eventData.user_id,
                                central_session_id:eventData.central_session_id,
                                payload:eventData.payload,
                                timestamp:eventData.created_at,
                            }),
                        });
                        if(res.ok){
                            isSuccess=true;
                            console.log(`✅ Webhook delivered to ${app.name} (${res.status})`);
                        }else{
                            errorMsg=`HTTP ${res.status}`;
                            allSuccess=false;
                            console.warn(`⚠️ Webhook to ${app.name} returned status ${res.status}`);
                        }
                    }catch(err: any){
                        errorMsg=err.message;
                        allSuccess=false;
                        console.error(`❌ Webhook to ${app.name} failed:`,err.message);
                    }
                    await prisma.eventDelivery.create({
                        data:{
                            event_id:eventData.id,
                            application_id:app.id,
                            status:isSuccess?'succeeded':'failed',
                            attempt_count:1,
                            last_attempt_at:new Date(),
                            last_error:errorMsg,
                        },
                    });
                }
                if(allSuccess){
                    if(channel)channel.ack(msg);
                }else{
                    console.log(`⚠️ Event ${eventData.id} had delivery failures, sending to DLQ`);
                    if(channel){
                        channel.sendToQueue('identity_events_dlq',msg.content,{persistent:true});
                        channel.ack(msg);
                    }
                }
            }catch(err: any){
                console.error('❌ [Sync Worker] Unexpected error:',err.message);
                if(channel)channel.nack(msg,false,true);
            }
        });
    }catch(err: any){
        if(isShuttingDown)return;
        console.error('❌ [Sync Worker] Connection error, retrying in 5s...',err.message);
        setTimeout(startWorker,5000);
    }
}

async function gracefulShutdown(signal: string){
    console.log(`\n🛑 [Sync Worker] Received ${signal}. Starting graceful shutdown...`);
    isShuttingDown=true;
    try{
        if(channel)await channel.close();
        if(conn)await conn.close();
        await prisma.$disconnect();
        await pool.end();
        console.log('✅ Sync Worker closed connections cleanly.');
        process.exit(0);
    }catch(err: any){
        console.error('❌ Error during worker shutdown:',err.message);
        process.exit(1);
    }
}

process.on('SIGTERM',()=>gracefulShutdown('SIGTERM'));
process.on('SIGINT',()=>gracefulShutdown('SIGINT'));

startWorker();
