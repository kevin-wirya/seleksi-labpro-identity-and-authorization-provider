import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import cookieParser from 'cookie-parser';
import amqp from 'amqplib';

import authRoute from './routes/auth';
import usersRoute from './routes/users';
import groupsRoute from './routes/groups';
import applicationsRoute from './routes/applications';

const app=express();
const PORT=process.env.PORT||4000;
const connectionString=process.env.DATABASE_URL||'postgresql://admin:secret@localhost:5432/sso_db?schema=public';
const pool=new Pool({connectionString});
const adapter=new PrismaPg(pool);
const prisma=new PrismaClient({adapter});

app.use(cors({origin:true,credentials:true}));
app.use(express.json());
app.use(cookieParser());
app.use((req: any,res: Response,next: NextFunction)=>{
    req.prisma=prisma;
    console.log(`📩 Request Masuk: ${req.method} ${req.url}`);
    next();
});
app.use('/api/auth',authRoute);
app.use('/api/admin/users',usersRoute);
app.use('/api/admin/groups',groupsRoute);
app.use('/api/admin/applications',applicationsRoute);
app.get('/health',(req: Request,res: Response)=>{
    res.json({status:'ok',timestamp:new Date()});
});

// liveliness
app.get('/health/live',(req: Request,res: Response)=>{
    res.status(200).json({status:'live',timestamp:new Date()});
});

// readiness
app.get('/health/ready',async(req: Request,res: Response)=>{
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
        const rabbitUrl=process.env.RABBITMQ_URL||'amqp://guest:guest@localhost:5672';
        const conn=await amqp.connect(rabbitUrl);
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

app.listen(PORT,()=>{
    console.log(`🚀 Auth Provider Server running on http://localhost:${PORT}`);
});
