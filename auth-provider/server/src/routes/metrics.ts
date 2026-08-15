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
    <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;background:#000000;color:#f8fafc;padding:24px;}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #1f1f23;}
        .title{font-size:24px;font-weight:700;color:#ffffff;display:flex;align-items:center;gap:10px;}
        .badge{padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;}
        .badge-active{background:#166534;color:#4ade80;border:1px solid #22c55e;}
        .badge-offline{background:#991b1b;color:#fca5a5;border:1px solid #ef4444;}
        .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:24px;}
        .card{background:#121215;border:1px solid #222226;border-radius:12px;padding:20px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.5);}
        .card-title{font-size:13px;color:#a1a1aa;font-weight:600;text-transform:uppercase;margin-bottom:8px;}
        .card-value{font-size:28px;font-weight:800;color:#f8fafc;}
        .card-sub{font-size:12px;color:#71717a;margin-top:6px;}
        .status-dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px;}
        .dot-green{background:#22c55e;box-shadow:0 0 8px #22c55e;}
        .dot-red{background:#ef4444;box-shadow:0 0 8px #ef4444;}
        .section-title{font-size:16px;font-weight:600;color:#e4e4e7;margin-bottom:12px;display:flex;align-items:center;gap:8px;}
        .live-indicator{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#4ade80;}
        .pulse{width:8px;height:8px;border-radius:50%;background:#4ade80;animation:pulse 1.5s infinite;}
        @keyframes pulse{0%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(74,222,128,0.7);}70%{transform:scale(1);box-shadow:0 0 0 8px rgba(74,222,128,0);}100%{transform:scale(0.95);box-shadow:0 0 0 0 rgba(74,222,128,0);}}
    </style>
</head>
<body>
    <div class="header">
        <div class="title">
            📊 SSO Observability Dashboard
        </div>
        <div class="live-indicator">
            <span class="pulse"></span> LIVE (Refreshing every 2s)
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
            <div class="card-value" id="deliveries_ok" style="color:#4ade80;">0</div>
            <div class="card-sub" id="deliveries_failed_sub">0 failed attempts</div>
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
