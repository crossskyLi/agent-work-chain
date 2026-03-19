import { Router } from 'express';
import { getDb } from '../db';
import {
  querySettlements,
  getBillingSummary,
} from '../services/billing.service';
import { asyncHandler, AppError } from '../middleware/error-handler';
import { validateQuery, settlementQuerySchema } from '../middleware/validate';
import type { SettlementRow, TaskRow } from '../types';

const router = Router();

function formatSettlement(r: SettlementRow) {
  return {
    id: r.id,
    taskId: r.task_id,
    type: r.type,
    from: r.from_address,
    to: r.to_address,
    grossAmount: r.gross_amount,
    netAmount: r.net_amount,
    feeAmount: r.fee_amount,
    blockNumber: r.block_number,
    txHash: r.tx_hash,
    settledAt: r.settled_at,
  };
}

router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const db = getDb();
    res.json(getBillingSummary(db));
  }),
);

router.get(
  '/settlements',
  validateQuery(settlementQuerySchema),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const rows = querySettlements(db, req.query);
    const settlements = rows.map(formatSettlement);
    res.json({ settlements, count: settlements.length });
  }),
);

router.get(
  '/settlements/:taskId',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM settlements WHERE task_id = ? ORDER BY id ASC')
      .all(req.params.taskId) as SettlementRow[];

    if (!rows.length) {
      throw new AppError(404, 'No settlements found for this task');
    }

    const task = db
      .prepare(
        'SELECT task_id, creator, assigned_agent, reward, status FROM tasks WHERE task_id = ?',
      )
      .get(req.params.taskId) as TaskRow | undefined;

    res.json({
      task: task
        ? {
            taskId: task.task_id,
            creator: task.creator,
            agent: task.assigned_agent,
            reward: task.reward,
            status: task.status,
          }
        : null,
      settlements: rows.map(formatSettlement),
    });
  }),
);

export default router;
