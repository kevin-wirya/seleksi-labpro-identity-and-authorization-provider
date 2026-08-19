import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import cookieParser from 'cookie-parser';
import amqp from 'amqplib';

import { config } from './config/env';
import { metricsMiddleware } from './middlewares/metricsMiddleware';
import { errorHandler } from './middlewares/errorHandler';

import authRoute from './routes/auth';
import loginRoute from './routes/login';
import usersRoute from './routes/users';
import groupsRoute from './routes/groups';
import applicationsRoute from './routes/applications';
import metricsRoute from './routes/metrics';
import mfaRoute from './routes/mfa';

const app=express();
const PORT=config.port;
const pool=new Pool({connectionString:config.databaseUrl});
const adapter=new PrismaPg(pool);
const prisma=new PrismaClient({adapter});

app.use(cors({origin:true,credentials:true}));
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());

// Inject prisma & metrics middleware
app.use((req: any,_res: Response,next: NextFunction)=>{
    req.prisma=prisma;
    next();
});
app.use(metricsMiddleware);

// API Routes
app.use('/login',loginRoute);
app.use('/api/auth',authRoute);
app.use('/api/admin/users',usersRoute);
app.use('/api/admin/groups',groupsRoute);
app.use('/api/admin/applications',applicationsRoute);
app.use('/api/admin/metrics',metricsRoute);
app.use('/api/auth/mfa',mfaRoute);

app.get('/api/admin/audit-logs',async(req: any,res: Response)=>{
    try{
        const logs=await req.prisma.auditLog.findMany({
            orderBy:{created_at:'desc'},
            take:100,
        });
        res.json({success:true,data:logs});
    }catch(e: any){
        res.status(500).json({success:false,error:e.message});
    }
});

// UI Redirects
app.get('/api/auth/mfa-ui',(_req: Request,res: Response)=>res.redirect('/api/auth/mfa/ui'));
app.get('/mfa-ui',(_req: Request,res: Response)=>res.redirect('/api/auth/mfa/ui'));
app.get('/metrics-ui',(_req: Request,res: Response)=>res.redirect('/api/admin/metrics/ui'));

// Health Probes (B03)
app.get('/health',(_req: Request,res: Response)=>res.json({status:'ok',timestamp:new Date()}));
app.get('/health/live',(_req: Request,res: Response)=>res.status(200).json({status:'live',timestamp:new Date()}));

app.get('/health/ready',async(_req: Request,res: Response)=>{
    const checks={database:'ok',broker:'ok'};
    const errors: Record<string,string>={};
    let isHealthy=true;

    try{
        await prisma.$queryRaw`SELECT 1`;
    }catch(err: any){
        checks.database='error';
        errors.database=err.message;
        isHealthy=false;
    }

    try{
        const conn=await amqp.connect(config.rabbitmqUrl);
        await conn.close();
    }catch(err: any){
        checks.broker='error';
        errors.broker=err.message;
        isHealthy=false;
    }

    if(isHealthy){
        res.status(200).json({status:'ready',timestamp:new Date(),checks});
    }else{
        res.status(503).json({status:'not-ready',timestamp:new Date(),checks,errors});
    }
});

// Global Error Handler
app.use(errorHandler);

const server=app.listen(PORT,()=>{
    console.log(`🚀 Auth Provider Server running on http://localhost:${PORT}`);
    console.log(`📊 Observability Dashboard: http://localhost:${PORT}/metrics-ui`);
});

// Graceful Shutdown (B04)
async function gracefulShutdown(signal: string){
    console.log(`\n🛑 [Server] Received ${signal}. Starting graceful shutdown...`);
    server.close(async()=>{
        console.log('🔒 HTTP server closed.');
        try{
            await prisma.$disconnect();
            await pool.end();
            console.log('✅ PostgreSQL connection pool closed.');
            process.exit(0);
        }catch(err: any){
            console.error('❌ Error during shutdown:',err.message);
            process.exit(1);
        }
    });
    setTimeout(()=>{
        console.error('⚠️ Shutdown timeout reached. Forcefully exiting...');
        process.exit(1);
    },10000);
}

process.on('SIGTERM',()=>gracefulShutdown('SIGTERM'));
process.on('SIGINT',()=>gracefulShutdown('SIGINT'));
