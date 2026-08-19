import { PrismaClient } from '@prisma/client';
import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
    prisma?: PrismaClient;
    user?: any;
}

export interface MetricsStore {
    totalRequests: number;
    totalErrors: number;
    totalSuccess: number;
    totalLatencyMs: number;
}
