import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

export function errorHandler(err: any,req: AuthenticatedRequest,res: Response,next: NextFunction){
    console.error('❌ Server Error:',err.stack||err.message);
    const statusCode=err.status||err.statusCode||500;
    res.status(statusCode).json({
        success:false,
        error:err.message||'Internal Server Error',
    });
}
