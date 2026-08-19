import { Response, NextFunction } from 'express';
import { globalMetrics } from '../routes/metrics';
import { AuthenticatedRequest } from '../types';

export function metricsMiddleware(req: AuthenticatedRequest,res: Response,next: NextFunction){
    const start=Date.now();
    const isInternalMetric=req.originalUrl?.includes('/metrics')||req.originalUrl?.includes('/health');
    res.on('finish',()=>{
        if(!isInternalMetric){
            const duration=Date.now()-start;
            globalMetrics.totalRequests+=1;
            globalMetrics.totalLatencyMs+=duration;
            if(res.statusCode>=400){
                globalMetrics.totalErrors+=1;
            }else{
                globalMetrics.totalSuccess+=1;
            }
        }
    });
    if(!isInternalMetric){
        console.log(`📩 Request Masuk: ${req.method} ${req.url}`);
    }
    next();
}
