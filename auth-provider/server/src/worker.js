require('dotenv/config');
const amqp=require('amqplib');
const {PrismaClient}=require('@prisma/client');
const {PrismaPg}=require('@prisma/adapter-pg');
const {Pool}=require('pg');

const connectionString=process.env.DATABASE_URL||'postgresql://admin:secret@localhost:5432/sso_db?schema=public';
const rabbitUrl=process.env.RABBITMQ_URL||'amqp://guest:guest@localhost:5672';
const pool=new Pool({connectionString});
const adapter=new PrismaPg(pool);
const prisma=new PrismaClient({adapter});

async function startWorker(){
    try{
        const conn=await amqp.connect(rabbitUrl);
        const channel=await conn.createChannel();
        await channel.assertQueue('identity_events',{durable:true});
        console.log('👷 [Sync Worker] Connected to RabbitMQ. Listening on identity_events...');
        channel.consume('identity_events',async(msg)=>{
            if(!msg)return;
            try{
                const eventData=JSON.parse(msg.content.toString());
                console.log(`📥 [Sync Worker] Received event: ${eventData.id} (${eventData.event_type}) for User: ${eventData.user_id}`);

                const activeApps=await prisma.application.findMany({
                    where:{status:'active'},
                });

                for(const app of activeApps){
                    if(!app.logout_notification_url)continue;
                    try{
                        console.log(`🚀 [Sync Worker] Broadcasting webhook to ${app.name} (${app.logout_notification_url})...`);
                        const res=await fetch(app.logout_notification_url,{
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
                        console.log(`✅ [Sync Worker] Webhook response from ${app.name}: ${res.status}`);
                    }catch(err){
                        console.error(`❌ [Sync Worker] Webhook failed for ${app.name}:`,err.message);
                    }
                }
                channel.ack(msg);
            }catch(err){
                console.error('❌ [Sync Worker] Error processing message:',err.message);
                channel.nack(msg,false,true); 
            }
        });
    }catch(err){
        console.error('❌ [Sync Worker] Connection error, retrying in 5s...',err.message);
        setTimeout(startWorker,5000);
    }
}

startWorker();