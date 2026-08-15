import express, { Request, Response } from 'express';
const router=express.Router();

// GET /api/admin/groups
router.get('/',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    try{
        const groups=await prisma.group.findMany({
            include:{
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
        await prisma.group.delete({where:{id}});
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
        res.json({success:true,data:userGroup});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

// DELETE /api/admin/groups/assign
router.delete('/assign',async(req: any,res: Response)=>{
    const prisma=req.prisma;
    const{user_id,group_id}=req.body;
    if(!user_id||!group_id){
        return res.status(400).json({success:false,error:'user_id and group_id are required'});
    }
    try{
        await prisma.userGroup.delete({
            where:{
                user_id_group_id:{user_id,group_id},
            },
        });
        res.json({success:true,message:'User removed from group'});
    }catch(error: any){
        res.status(500).json({success:false,error:error.message});
    }
});

export default router;
