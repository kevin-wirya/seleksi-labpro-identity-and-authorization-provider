import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import cookieParser from 'cookie-parser';

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
app.listen(PORT,()=>{
    console.log(`🚀 Auth Provider Server running on http://localhost:${PORT}`);
});
