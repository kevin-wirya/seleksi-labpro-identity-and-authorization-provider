require('dotenv/config');
const express=require('express');
const cors=require('cors');
const {PrismaClient}=require('@prisma/client');
const {PrismaPg}=require('@prisma/adapter-pg');
const {Pool}=require('pg');

const usersRoute=require('./routes/users');
const groupsRoute=require('./routes/groups');
const app=express();
const PORT=process.env.PORT||4000;
const connectionString=process.env.DATABASE_URL||'postgresql://admin:secret@localhost:5432/sso_db?schema=public';
const pool=new Pool({connectionString});
const adapter=new PrismaPg(pool);
const prisma=new PrismaClient({adapter});

app.use(cors());
app.use(express.json());
app.use((req,res,next)=>{
    req.prisma=prisma;
    next();
});
app.use('/api/admin/users',usersRoute);
app.use('/api/admin/groups',groupsRoute);
app.get('/health',(req,res)=>{
    res.json({status:'ok',timestamp:new Date()});
});
app.listen(PORT,()=>{
    console.log(`🚀 Auth Provider Server running on http://localhost:${PORT}`);
});
