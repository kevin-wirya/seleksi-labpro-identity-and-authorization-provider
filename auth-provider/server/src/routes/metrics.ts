import express, { Request, Response } from 'express';
import amqp from 'amqplib';

const router=express.Router();

export interface MetricsStore {
    totalRequests: number;
    totalErrors: number;
    totalSuccess: number;
    totalLatencyMs: number;
}

export const globalMetrics: MetricsStore={
    totalRequests:0,
    totalErrors:0,
    totalSuccess:0,
    totalLatencyMs:0,
};

// GET /api/admin/metrics
router.get('/',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const rabbitUrl=process.env.RABBITMQ_URL||'amqp://guest:guest@localhost:5672';
    
    let queueDepth=0;
    let dlqDepth=0;
    let consumerCount=0;
    let brokerStatus='connected';

    try{
        const conn=await amqp.connect(rabbitUrl);
        const ch=await conn.createChannel();
        const mainQueue=await ch.checkQueue('identity_events');
        const dlqQueue=await ch.checkQueue('identity_events_dlq');
        queueDepth=mainQueue.messageCount;
        consumerCount=mainQueue.consumerCount;
        dlqDepth=dlqQueue.messageCount;
        await ch.close();
        await conn.close();
    }catch(err: any){
        brokerStatus='disconnected';
    }

    let pendingEventsCount=0;
    let publishedEventsCount=0;
    let succeededDeliveriesCount=0;
    let failedDeliveriesCount=0;

    try{
        pendingEventsCount=await prisma.event.count({where:{status:'pending'}});
        publishedEventsCount=await prisma.event.count({where:{status:'published'}});
        succeededDeliveriesCount=await prisma.eventDelivery.count({where:{status:'succeeded'}});
        failedDeliveriesCount=await prisma.eventDelivery.count({where:{status:'failed'}});
    }catch(err: any){
        console.error('Metrics DB fetch error:',err.message);
    }

    const totalReq=globalMetrics.totalRequests;
    const totalErr=globalMetrics.totalErrors;
    const avgLatency=totalReq>0?Number((globalMetrics.totalLatencyMs/totalReq).toFixed(2)):0;
    const errorRate=totalReq>0?Number(((totalErr/totalReq)*100).toFixed(2)):0;

    const workerStatus=consumerCount>0?'ACTIVE':'OFFLINE';

    res.json({
        success:true,
        timestamp:new Date(),
        red:{
            total_requests:totalReq,
            total_success:globalMetrics.totalSuccess,
            total_errors:totalErr,
            error_rate_pct:errorRate,
            avg_latency_ms:avgLatency,
        },
        use:{
            broker_status:brokerStatus,
            worker_status:workerStatus,
            active_consumers:consumerCount,
            queue_depth:queueDepth,
            dlq_depth:dlqDepth,
            events_pending:pendingEventsCount,
            events_published:publishedEventsCount,
            deliveries_succeeded:succeededDeliveriesCount,
            deliveries_failed:failedDeliveriesCount,
        },
    });
});

// GET /metrics-ui
router.get('/ui',(req: Request,res: Response)=>{
    const html=`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auth Provider - Real-Time Observability Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap" rel="stylesheet">
    <style>
        *{box-sizing:border-box;margin:0;padding:0;font-family:'Lato',sans-serif;}
        body{background-color:#060907;color:#f4f4f5;min-height:100vh;padding:32px 24px;background-image:radial-gradient(circle at 50% 20%,rgba(16,185,129,0.12) 0%,transparent 60%);}
        .container{max-width:1100px;margin:0 auto;}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid rgba(16,185,129,0.2);}
        .title-box{display:flex;align-items:center;gap:14px;}
        .icon-box{width:48px;height:48px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:14px;display:flex;align-items:center;justify-content:center;}
        .title{font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;}
        .subtitle{font-size:13px;color:#a1a1aa;margin-top:2px;}
        .badge{padding:4px 12px;border-radius:9999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;}
        .badge-active{background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);}
        .badge-offline{background:rgba(239,68,68,0.15);color:#fca5a5;border:1px solid rgba(239,68,68,0.3);}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;margin-bottom:32px;}
        .card{background:#0f1712;border:1px solid rgba(16,185,129,0.2);border-radius:20px;padding:24px;box-shadow:0 20px 40px -15px rgba(0,0,0,0.7);transition:all 0.2s;backdrop-filter:blur(16px);}
        .card:hover{transform:translateY(-2px);border-color:rgba(16,185,129,0.4);box-shadow:0 25px 50px -12px rgba(16,185,129,0.15);}
        .card-title{font-size:12px;color:#a1a1aa;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;}
        .card-value{font-size:32px;font-weight:900;color:#ffffff;}
        .card-sub{font-size:12px;color:#71717a;margin-top:8px;}
        .section-title{font-size:15px;font-weight:700;color:#34d399;margin-bottom:16px;display:flex;align-items:center;gap:8px;text-transform:uppercase;letter-spacing:0.5px;}
        .live-indicator{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#34d399;background:rgba(16,185,129,0.1);padding:6px 14px;border-radius:9999px;border:1px solid rgba(16,185,129,0.25);}
        .pulse{width:8px;height:8px;border-radius:50%;background:#34d399;animation:pulse 1.5s infinite;}
        @keyframes pulse{0%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(52,211,153,0.7);}70%{transform:scale(1);box-shadow:0 0 0 8px rgba(52,211,153,0);}100%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(52,211,153,0);}}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title-box">
                <div class="icon-box">
                    <svg style="width:26px;height:26px;color:#34d399;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                </div>
                <div>
                    <div class="title">SSO Observability Dashboard</div>
                    <div class="subtitle">Real-Time Infrastructure & System Telemetry</div>
                </div>
            </div>
            <div class="live-indicator">
                <span class="pulse"></span> LIVE (2s refresh)
            </div>
        </div>

        <div class="section-title">🔴 RED Metrics (Rate, Errors, Duration)</div>
        <div class="grid">
            <div class="card">
                <div class="card-title">Total Requests</div>
                <div class="card-value" id="total_requests">0</div>
                <div class="card-sub">HTTP Inbound Requests</div>
            </div>
            <div class="card">
                <div class="card-title">Avg Latency</div>
                <div class="card-value" id="avg_latency" style="color:#38bdf8;">0 ms</div>
                <div class="card-sub">Average response duration</div>
            </div>
            <div class="card">
                <div class="card-title">Error Rate</div>
                <div class="card-value" id="error_rate" style="color:#f43f5e;">0 %</div>
                <div class="card-sub" id="error_count_sub">0 errors</div>
            </div>
        </div>

        <div class="section-title">⚡ USE Metrics (Utilization, Saturation, Errors)</div>
        <div class="grid">
            <div class="card">
                <div class="card-title">RabbitMQ Queue Depth</div>
                <div class="card-value" id="queue_depth" style="color:#fbbf24;">0</div>
                <div class="card-sub">Active messages in identity_events</div>
            </div>
            <div class="card">
                <div class="card-title">Dead Letter Queue (DLQ)</div>
                <div class="card-value" id="dlq_depth" style="color:#f87171;">0</div>
                <div class="card-sub">Failed messages in identity_events_dlq</div>
            </div>
            <div class="card">
                <div class="card-title">Sync Worker Status</div>
                <div class="card-value" id="worker_status_card">
                    <span id="worker_badge" class="badge badge-active">ACTIVE</span>
                </div>
                <div class="card-sub" id="consumer_sub">1 Consumer connected</div>
            </div>
            <div class="card">
                <div class="card-title">Webhook Deliveries</div>
                <div class="card-value" id="deliveries_ok" style="color:#34d399;">0</div>
                <div class="card-sub" id="deliveries_failed_sub">0 failed attempts</div>
            </div>
        </div>
    </div>

    <script>
        async function fetchMetrics(){
            try{
                const res=await fetch('/api/admin/metrics');
                const data=await res.json();
                if(data.success){
                    document.getElementById('total_requests').innerText=data.red.total_requests;
                    document.getElementById('avg_latency').innerText=data.red.avg_latency_ms+' ms';
                    document.getElementById('error_rate').innerText=data.red.error_rate_pct+' %';
                    document.getElementById('error_count_sub').innerText=data.red.total_errors+' error responses';
                    
                    document.getElementById('queue_depth').innerText=data.use.queue_depth;
                    document.getElementById('dlq_depth').innerText=data.use.dlq_depth;
                    
                    const badge=document.getElementById('worker_badge');
                    if(data.use.worker_status==='ACTIVE'){
                        badge.className='badge badge-active';
                        badge.innerText='ACTIVE';
                    }else{
                        badge.className='badge badge-offline';
                        badge.innerText='OFFLINE';
                    }
                    document.getElementById('consumer_sub').innerText=data.use.active_consumers+' active consumer(s)';
                    document.getElementById('deliveries_ok').innerText=data.use.deliveries_succeeded;
                    document.getElementById('deliveries_failed_sub').innerText=data.use.deliveries_failed+' failed attempt(s)';
                }
            }catch(err){
                console.error('Metrics fetch error:',err);
            }
        }
        fetchMetrics();
        setInterval(fetchMetrics,2000);
    </script>
</body>
</html>`;
    res.send(html);
});

export default router;
