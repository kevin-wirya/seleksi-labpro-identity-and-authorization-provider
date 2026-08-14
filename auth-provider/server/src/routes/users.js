const express=require('express');
const {hashPassword}=require('../utils/hash');
const router=express.Router();

// GET /api/admin/users
router.get('/',async(req,res)=>{
    const prisma=req.prisma;
    try{
        const users=await prisma.user.findMany({
            select:{
                id:true,
                name:true,
                email:true,
                status:true,
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
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/admin/users
router.post('/',async(req,res)=>{
    const prisma=req.prisma;
    const{name,email,password,status,group_ids}=req.body;
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
                user_groups:Array.isArray(group_ids)?{
                    create:group_ids.map(groupId=>({group_id:groupId}))
                }:undefined,
            },
            select:{
                id:true,
                name:true,
                email:true,
                status:true,
                created_at:true,
                user_groups:{
                    include:{group:true}
                }
            },
        });
        res.status(201).json({success:true,data:user});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// PATCH /api/admin/users/:id/status
router.patch('/:id/status',async(req,res)=>{
    const prisma=req.prisma;
    const{id}=req.params;
    const{status}=req.body;
    if(!['active','inactive'].includes(status)){
        return res.status(400).json({success:false,error:'Status must be active or inactive'});
    }
    try{
        const updatedUser=await prisma.user.update({
            where:{id},
            data:{status},
            select:{id:true,name:true,email:true,status:true},
        });
        res.json({success:true,data:updatedUser});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// PUT /api/admin/users/:id
router.put('/:id',async(req,res)=>{
    const prisma=req.prisma;
    const{id}=req.params;
    const{name,email,password,status}=req.body;
    try{
        const updateData={};
        if(name)updateData.name=name;
        if(email)updateData.email=email;
        if(status)updateData.status=status;
        if(password)updateData.password_hash=hashPassword(password);
        const updatedUser=await prisma.$transaction(async(tx)=>{
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
            return user;
        });
        res.json({success:true,data:updatedUser});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

module.exports=router;
