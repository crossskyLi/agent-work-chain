import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/error-handler';
import { validateQuery, agentQuerySchema } from '../middleware/validate';
import { findAgentByAddress, listAgents } from '../db/agent-reader';
import type { AgentQueryParams } from '../types';

const router = Router();

router.get(
  '/',
  validateQuery(agentQuerySchema),
  asyncHandler(async (req, res) => {
    const agents = await listAgents(req.query as AgentQueryParams);
    res.json({ agents, count: agents.length });
  }),
);

router.get(
  '/:address',
  asyncHandler(async (req, res) => {
    const agent = await findAgentByAddress(req.params.address);
    if (!agent) throw new AppError(404, 'Agent not found');
    res.json(agent);
  }),
);

export default router;
