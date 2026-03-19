import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { validateQuery, eventQuerySchema } from '../middleware/validate';
import { listEvents } from '../db/event-reader';
import type { EventQueryParams } from '../types';

const router = Router();

router.get(
  '/',
  validateQuery(eventQuerySchema),
  asyncHandler(async (req, res) => {
    const events = await listEvents(req.query as EventQueryParams);
    res.json({ events, count: events.length });
  }),
);

export default router;
