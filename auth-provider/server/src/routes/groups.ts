import express, { Request, Response } from 'express';
const router=express.Router();

// GET /api/admin/groups
router.get('/',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    try{
        const groups=await prisma.group.findMany({
            include:{
                user_groups:true,
                _count:{
                    select:{user_groups:true}
                },
            },
            orderBy:{name:'asc'},
        });
        res.json({success:true,data:groups});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/admin/groups
router.post('/',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{name,description}=req.body;
    if(!name){
        return res.status(400).json({success:false,error:'Group name is required'});
    }
    try{
        const existingGroup=await prisma.group.findUnique({where:{name}});
        if(existingGroup)return res.status(400).json({success:false,error:'Group name already exists'});

        const group=await prisma.group.create({
            data:{name,description},
        });
        try{
            await prisma.auditLog.create({
                data:{
                    event_type:'group_created',
                    actor_id:'admin',
                    result:'success',
                    metadata:JSON.stringify({group_id:group.id,name}),
                },
            });
        }catch(e){}
        res.status(201).json({success:true,data:group});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// PUT /api/admin/groups/:id
router.put('/:id',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{id}=req.params;
    const{name,description}=req.body;
    try{
        const group=await prisma.group.update({
            where:{id},
            data:{name,description},
        });
        try{
            await prisma.auditLog.create({
                data:{
                    event_type:'group_updated',
                    actor_id:'admin',
                    result:'success',
                    metadata:JSON.stringify({group_id:group.id,name,description}),
                },
            });
        }catch(e){}
        res.json({success:true,data:group});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// DELETE /api/admin/groups/:id
router.delete('/:id',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{id}=req.params;
    try{
        const group=await prisma.group.findUnique({where:{id}});
        await prisma.group.delete({where:{id}});
        if(group){
            try{
                await prisma.auditLog.create({
                    data:{
                        event_type:'group_deleted',
                        actor_id:'admin',
                        result:'success',
                        metadata:JSON.stringify({group_id:id,name:group.name}),
                    },
                });
            }catch(e){}
        }
        res.json({success:true,message:'Group deleted successfully'});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/admin/groups/assign
router.post('/assign',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{user_id,group_id}=req.body;
    if(!user_id||!group_id){
        return res.status(400).json({success:false,error:'user_id and group_id are required'});
    }
    try{
        const userGroup=await prisma.userGroup.upsert({
            where:{
                user_id_group_id:{user_id,group_id},
            },
            update:{},
            create:{user_id,group_id},
            include:{user:true,group:true},
        });
        try{
            await prisma.auditLog.create({
                data:{
                    event_type:'user_assigned_to_group',
                    actor_id:'admin',
                    user_id,
                    result:'success',
                    metadata:JSON.stringify({group_id}),
                },
            });
        }catch(e){}
        res.json({success:true,data:userGroup});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

import { revokeNonCompliantSessions } from '../utils/policyRevocation';

// DELETE /api/admin/groups/assign
router.delete('/assign',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{user_id,group_id}=req.body;
    if(!user_id||!group_id){
        return res.status(400).json({success:false,error:'user_id and group_id are required'});
    }
    try{
        await prisma.$transaction(async(tx: any)=>{
            await tx.userGroup.delete({
                where:{
                    user_id_group_id:{user_id,group_id},
                },
            });
            await tx.auditLog.create({
                data:{
                    event_type:'user_removed_from_group',
                    actor_id:'admin',
                    user_id,
                    result:'success',
                    metadata:JSON.stringify({group_id}),
                },
            });
            await revokeNonCompliantSessions(tx, undefined, user_id);
        });
        res.json({success:true,message:'User removed from group and impacted sessions revoked'});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

export default router;
