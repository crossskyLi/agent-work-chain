import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

const TASK_STATUSES = ['Created', 'InProgress', 'Completed', 'Disputed', 'Resolved', 'Cancelled'] as const;

const positiveInt = z.coerce.number().int().min(0);

export const taskQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  creator: z.string().optional(),
  agent: z.string().optional(),
  q: z.string().max(200).optional(),
  limit: positiveInt.max(200).default(50),
  offset: positiveInt.default(0),
});

export const agentQuerySchema = z.object({
  capability: z.string().optional(),
  q: z.string().max(200).optional(),
  limit: positiveInt.max(200).default(50),
  offset: positiveInt.default(0),
});

export const eventQuerySchema = z.object({
  task_id: z.string().optional(),
  event_name: z.string().optional(),
  q: z.string().max(200).optional(),
  limit: positiveInt.max(200).default(100),
  offset: positiveInt.default(0),
});

export const settlementQuerySchema = z.object({
  task_id: z.string().optional(),
  type: z.string().optional(),
  address: z.string().optional(),
  limit: positiveInt.max(200).default(100),
  offset: positiveInt.default(0),
});

export const queryHumanSchema = z.object({
  q: z.string().max(200).default(''),
  limit: positiveInt.max(200).default(20),
});

export const queryAgentSchema = z.object({
  intent: z.enum(['tasks', 'agents', 'events', 'overview']).default('overview'),
  q: z.string().max(200).default(''),
  limit: positiveInt.max(200).default(20),
  status: z.enum(TASK_STATUSES).optional(),
  creator: z.string().optional(),
  agent: z.string().optional(),
  capability: z.string().optional(),
  task_id: z.string().optional(),
  event_name: z.string().optional(),
});

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    (req as any).query = result.data;
    next();
  };
}
