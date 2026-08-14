const express=require('express');
const router=express.Router();

// GET /api/admin/applications
router.get('/',async(req,res)=>{
    const prisma=req.prisma;
    try{
        const apps=await prisma.application.findMany({
            include:{
                redirect_uris:true,
                group_policies:{
                    include:{group:true}
                },
            },
            orderBy:{created_at:'desc'},
        });
        res.json({success:true,data:apps});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/admin/applications
router.post('/',async(req,res)=>{
    const prisma=req.prisma;
    const{name,client_id,launch_url,logout_notification_url,status}=req.body;
    if(!name||!client_id||!logout_notification_url){
        return res.status(400).json({success:false,error:'name, client_id, and logout_notification_url are required'});
    }
    try{
        const existingApp=await prisma.application.findUnique({where:{client_id}});
        if(existingApp)return res.status(400).json({success:false,error:'client_id already exists'});

        const app=await prisma.application.create({
            data:{
                name,
                client_id,
                launch_url,
                logout_notification_url,
                status:status||'active',
            },
            include:{
                redirect_uris:true,
                group_policies:true,
            },
        });
        res.status(201).json({success:true,data:app});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// PUT /api/admin/applications/:id
router.put('/:id',async(req,res)=>{
    const prisma=req.prisma;
    const{id}=req.params;
    const{name,launch_url,logout_notification_url,status}=req.body;
    try{
        const app=await prisma.application.update({
            where:{id},
            data:{name,launch_url,logout_notification_url,status},
        });
        res.json({success:true,data:app});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// DELETE /api/admin/applications/:id
router.delete('/:id',async(req,res)=>{
    const prisma=req.prisma;
    const{id}=req.params;
    try{
        await prisma.application.delete({where:{id}});
        res.json({success:true,message:'Application deleted successfully'});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/admin/applications/:id/redirect-uris
router.post('/:id/redirect-uris',async(req,res)=>{
    const prisma=req.prisma;
    const{id}=req.params;
    const{redirect_uri}=req.body;
    if(!redirect_uri){
        return res.status(400).json({success:false,error:'redirect_uri is required'});
    }
    try{
        const existingUri=await prisma.applicationRedirectUri.findFirst({
            where:{application_id:id,redirect_uri},
        });
        if(existingUri)return res.status(400).json({success:false,error:'Redirect URI already registered for this app'});

        const uri=await prisma.applicationRedirectUri.create({
            data:{application_id:id,redirect_uri},
        });
        res.status(201).json({success:true,data:uri});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// DELETE /api/admin/applications/:id/redirect-uris/:uriId
router.delete('/:id/redirect-uris/:uriId',async(req,res)=>{
    const prisma=req.prisma;
    const{uriId}=req.params;
    try{
        await prisma.applicationRedirectUri.delete({where:{id:uriId}});
        res.json({success:true,message:'Redirect URI deleted successfully'});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// POST /api/admin/applications/:id/policies
router.post('/:id/policies',async(req,res)=>{
    const prisma=req.prisma;
    const{id}=req.params;
    const{group_id,effect}=req.body;
    if(!group_id){
        return res.status(400).json({success:false,error:'group_id is required'});
    }
    const policyEffect=effect||'allow';
    try{
        const policy=await prisma.$transaction(async(tx)=>{
            const pol=await tx.applicationGroupPolicy.upsert({
                where:{
                    application_id_group_id_effect:{
                        application_id:id,
                        group_id,
                        effect:policyEffect,
                    },
                },
                update:{},
                create:{
                    application_id:id,
                    group_id,
                    effect:policyEffect,
                },
                include:{group:true},
            });
            await tx.event.create({
                data:{
                    event_type:'PolicyUpdated',
                    user_id:'system',
                    application_id:id,
                    payload:JSON.stringify({
                        event_type:'PolicyUpdated',
                        application_id:id,
                        group_id,
                        effect:policyEffect,
                    }),
                    status:'pending',
                },
            });
            return pol;
        });
        res.json({success:true,data:policy});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

// DELETE /api/admin/applications/:id/policies/:policyId
router.delete('/:id/policies/:policyId',async(req,res)=>{
    const prisma=req.prisma;
    const{policyId}=req.params;
    try{
        await prisma.applicationGroupPolicy.delete({where:{id:policyId}});
        res.json({success:true,message:'Group policy deleted successfully'});
    }catch(error){
        res.status(500).json({success:false,error:error.message});
    }
});

module.exports=router;
