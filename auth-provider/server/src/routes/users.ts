import express, { Request, Response } from 'express';
import { hashPassword } from '../utils/hash';
const router=express.Router();

// GET /api/admin/users
router.get('/',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    try{
        const users=await prisma.user.findMany({
            select:{
                id:true,
                name:true,
                email:true,
                status:true,
                mfa_enabled:true,
                created_at:true,
                updated_at:true,
                user_groups:{
                    include:{
                        group:true
                    },
                },
            },
            orderBy:{created_at:'desc'},
        });
        res.json({success:true,data:users});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/admin/users
router.post('/',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{name,email,password,status,mfa_enabled,group_ids}=req.body;
    if(!name||!email||!password){
        return res.status(400).json({success:false,error:'Name, email, and password are required'});
    }
    try{
        const existingUser=await prisma.user.findUnique({where:{email}});
        if(existingUser)return res.status(400).json({success:false,error:'Email already registered'});

        const password_hash=hashPassword(password);
        const user=await prisma.user.create({
            data:{
                name,
                email,
                password_hash,
                status:status||"active",
                mfa_enabled:Boolean(mfa_enabled),
                user_groups:Array.isArray(group_ids)?{
                    create:group_ids.map((groupId: string)=>({group_id:groupId}))
                }:undefined,
            },
            select:{
                id:true,
                name:true,
                email:true,
                status:true,
                mfa_enabled:true,
                created_at:true,
                user_groups:{
                    include:{group:true}
                }
            },
        });
        try{
            await prisma.auditLog.create({
                data:{
                    event_type:'user_created',
                    actor_id:'admin',
                    user_id:user.id,
                    result:'success',
                    metadata:JSON.stringify({name:user.name,email:user.email,status:user.status}),
                },
            });
        }catch(e){}
        res.status(201).json({success:true,data:user});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

import { revokeNonCompliantSessions } from '../utils/policyRevocation';

// PATCH /api/admin/users/:id/status
router.patch('/:id/status',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{id}=req.params;
    const{status}=req.body;
    if(!['active','inactive'].includes(status)){
        return res.status(400).json({success:false,error:'Status must be active or inactive'});
    }
    try{
        const updatedUser=await prisma.$transaction(async(tx: any)=>{
            const user=await tx.user.update({
                where:{id},
                data:{status},
                select:{id:true,name:true,email:true,status:true},
            });
            await tx.auditLog.create({
                data:{
                    event_type:'user_status_changed',
                    actor_id:'admin',
                    user_id:id,
                    result:'success',
                    metadata:JSON.stringify({new_status:status}),
                },
            });
            await revokeNonCompliantSessions(tx, undefined, id);
            return user;
        });
        res.json({success:true,data:updatedUser});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// PATCH /api/admin/users/:id/mfa
router.patch('/:id/mfa',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{id}=req.params;
    const{mfa_enabled}=req.body;
    try{
        const updatedUser=await prisma.user.update({
            where:{id},
            data:{mfa_enabled:Boolean(mfa_enabled)},
            select:{id:true,name:true,email:true,status:true,mfa_enabled:true},
        });
        res.json({success:true,data:updatedUser});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// PUT /api/admin/users/:id
router.put('/:id',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{id}=req.params;
    const{name,email,password,status}=req.body;
    try{
        const updateData: any={};
        if(name)updateData.name=name;
        if(email)updateData.email=email;
        if(status)updateData.status=status;
        if(password)updateData.password_hash=hashPassword(password);
        const updatedUser=await prisma.$transaction(async(tx: any)=>{
            const user=await tx.user.update({
                where:{id},
                data:updateData,
                select:{id:true,name:true,email:true,status:true,updated_at:true},
            });
            if(password||status==='inactive'){
                await tx.event.create({
                    data:{
                        event_type:password?'PasswordChanged':'UserUpdated',
                        user_id:id,
                        payload:JSON.stringify({
                            event_type:password?'PasswordChanged':'UserUpdated',
                            user_id:id,
                            updated_at:new Date().toISOString(),
                        }),
                        status:'pending',
                    },
                });
            }
            await tx.auditLog.create({
                data:{
                    event_type:password?'password_changed':'user_updated',
                    actor_id:'admin',
                    user_id:id,
                    result:'success',
                    metadata:JSON.stringify({fields_updated:Object.keys(updateData)}),
                },
            });
            await revokeNonCompliantSessions(tx, undefined, id);
            return user;
        });
        res.json({success:true,data:updatedUser});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

export default router;
