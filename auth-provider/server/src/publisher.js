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

let channel=null;

async function connectRabbitMQ(){
    try{
        const conn=await amqp.connect(rabbitUrl);
        channel=await conn.createChannel();
        await channel.assertQueue('identity_events',{durable:true});
        console.log('✅ Outbox Publisher connected to RabbitMQ queue: identity_events');
    }catch(err){
        console.error('❌ RabbitMQ connection error, retrying in 5s...',err.message);
        setTimeout(connectRabbitMQ,5000);
    }
}

async function pollOutbox(){
    if(!channel)return;
    try{
        const pendingEvents=await prisma.event.findMany({
            where:{published_at:null,status:'pending'},
            orderBy:{created_at:'asc'},
            take:20,
        });
        for(const evt of pendingEvents){
            const msg=JSON.stringify({
                id:evt.id,
                event_type:evt.event_type,
                user_id:evt.user_id,
                central_session_id:evt.central_session_id,
                application_id:evt.application_id,
                payload:typeof evt.payload==='string'?JSON.parse(evt.payload):evt.payload,
                created_at:evt.created_at,
            });
            const sent=channel.sendToQueue('identity_events',Buffer.from(msg),{persistent:true});
            if(sent){
                await prisma.event.update({
                    where:{id:evt.id},
                    data:{status:'published',published_at:new Date()},
                });
                console.log(`📡 [Outbox Publisher] Published event: ${evt.id} (${evt.event_type})`);
            }
        }
    }catch(err){
        console.error('❌ Error polling outbox events:',err.message);
    }
}

async function start(){
    await connectRabbitMQ();
    setInterval(pollOutbox,3000);
    console.log('🔄 Outbox Relay Publisher running (polling every 3s)...');
}

start();
