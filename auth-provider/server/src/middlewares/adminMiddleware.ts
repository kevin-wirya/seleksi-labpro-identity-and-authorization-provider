import { Response, NextFunction } from 'express';
import crypto from 'crypto';

export async function adminMiddleware(req: any,res: Response,next: NextFunction){
    const rawSessionToken=req.cookies?.sso_session;
    if(!rawSessionToken){
        return res.status(401).json({success:false,error:'Authentication required. Please log in to SSO first.'});
    }
    try{
        const session_token_hash=crypto.createHash('sha256').update(rawSessionToken).digest('hex');
        const session=await req.prisma.ssoSession.findFirst({
            where:{session_token_hash,status:'active',expires_at:{gt:new Date()}},
            include:{
                user:{
                    include:{
                        user_groups:{include:{group:true}}
                    }
                }
            }
        });
        if(!session||!session.user||session.user.status!=='active'){
            return res.status(401).json({success:false,error:'Invalid or expired SSO session. Please log in again.'});
        }
        const isAdmin=session.user.user_groups?.some((ug: any)=>ug.group&&ug.group.name.toLowerCase()==='administrators');
        if(!isAdmin){
            return res.status(403).json({success:false,error:'Forbidden: Access denied. Requires administrators group membership.'});
        }
        req.authUser=session.user;
        next();
    }catch(e: any){
        res.status(500).json({success:false,error:e.message});
    }
}
