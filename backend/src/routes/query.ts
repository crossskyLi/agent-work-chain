import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler';
import { validateQuery, queryHumanSchema, queryAgentSchema } from '../middleware/validate';
import { listTasks } from '../db/task-reader';
import { listAgents } from '../db/agent-reader';
import { listEvents } from '../db/event-reader';
import { getOverviewCounts } from '../db/overview-reader';

const router = Router();

router.get(
  '/human',
  validateQuery(queryHumanSchema),
  asyncHandler(async (req, res) => {
    const { q, limit } = req.query as unknown as { q: string; limit: number };

    const [tasks, agents, events] = await Promise.all([
      listTasks({ q, limit, offset: 0 }),
      listAgents({ q, limit, offset: 0 }),
      listEvents({ q, limit, offset: 0 }),
    ]);

    res.json({
      query: q,
      summary: {
        tasks: tasks.length,
        agents: agents.length,
        events: events.length,
      },
      tasks,
      agents,
      events,
    });
  }),
);

router.get(
  '/agent',
  validateQuery(queryAgentSchema),
  asyncHandler(async (req, res) => {
    const parsed = req.query as unknown as {
      intent: string;
      q: string;
      limit: number;
      status?: string;
      creator?: string;
      agent?: string;
      capability?: string;
      task_id?: string;
      event_name?: string;
    };
    const { intent, q, limit: safeLimit } = parsed;

    let payload;

    switch (intent) {
      case 'tasks': {
        const tasks = await listTasks({
          status: parsed.status,
          creator: parsed.creator,
          agent: parsed.agent,
          q,
          limit: safeLimit,
        });
        payload = {
          intent,
          count: tasks.length,
          records: tasks.map((t) => ({
            id: t.task_id,
            status: t.status,
            reward: t.reward,
            creator: t.creator,
            assignedAgent: t.assigned_agent,
            inputCid: t.input_cid,
            outputCid: t.output_cid,
            createdAt: t.created_at,
          })),
        };
        break;
      }

      case 'agents': {
        const agents = await listAgents({
          capability: parsed.capability,
          q,
          limit: safeLimit,
        });
        payload = {
          intent,
          count: agents.length,
          records: agents.map((a) => ({
            address: a.address,
            did: a.did,
            capabilities: a.capabilities,
            tasksCompleted: a.tasks_completed,
            disputesWon: a.disputes_won,
            disputesLost: a.disputes_lost,
          })),
        };
        break;
      }

      case 'events': {
        const events = await listEvents({
          task_id: parsed.task_id,
          event_name: parsed.event_name,
          q,
          limit: safeLimit,
        });
        payload = {
          intent,
          count: events.length,
          records: events.map((e) => ({
            id: e.id,
            event: e.event_name,
            taskId: e.task_id,
            block: e.block_number,
            tx: e.tx_hash,
            data: e.data,
          })),
        };
        break;
      }

      default: {
        const totals = await getOverviewCounts();
        const latestTasks = await listTasks({
          limit: Math.min(10, safeLimit),
          offset: 0,
        });

        payload = {
          intent: 'overview',
          count: 1,
          records: [
            {
              totals,
              latestTasks: latestTasks.map((t) => ({
                id: t.task_id,
                status: t.status,
                reward: t.reward,
              })),
            },
          ],
        };
      }
    }

    res.json({
      schema: 'agent-query-v1',
      generatedAt: new Date().toISOString(),
      payload,
    });
  }),
);

export default router;
