import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../db';

function inferCapability(description: string): string {
  const text = String(description || '');
  if (/页面|UI|UX|体验|设计/i.test(text)) return 'design-creative';
  if (/代码|开发|数据|自动化/i.test(text)) return 'software-data';
  if (/销售|获客|转化/i.test(text)) return 'sales';
  return 'task-execution';
}

function chooseExecutor(db: Database.Database, preferredCapability: string) {
  let candidates: unknown[] = [];

  if (preferredCapability) {
    candidates = db
      .prepare(
        'SELECT * FROM agents WHERE capabilities LIKE ? ORDER BY tasks_completed DESC LIMIT 20',
      )
      .all(`%${preferredCapability}%`);
  }

  if (!candidates.length) {
    candidates = db
      .prepare('SELECT * FROM agents ORDER BY tasks_completed DESC LIMIT 20')
      .all();
  }

  if (!candidates.length) {
    throw new Error('No agents available');
  }

  return candidates[0] as { address: string; did: string; capabilities: string; tasks_completed: number };
}

function chooseArbitrator(db: Database.Database, capability: string, excludeAddress: string) {
  let rows: unknown[] = [];
  if (capability) {
    rows = db
      .prepare(
        'SELECT * FROM agents WHERE capabilities LIKE ? AND address != ? ORDER BY tasks_completed DESC LIMIT 20',
      )
      .all(`%${capability}%`, excludeAddress);
  }

  if (!rows.length) {
    rows = db
      .prepare(
        'SELECT * FROM agents WHERE address != ? ORDER BY tasks_completed DESC LIMIT 20',
      )
      .all(excludeAddress);
  }

  if (!rows.length) {
    throw new Error('No arbitrator candidate found');
  }

  return rows[0] as { address: string; did: string; capabilities: string };
}

function makeTxHash(seed: string): string {
  return `0x${crypto.createHash('sha256').update(seed).digest('hex')}`;
}

function makeCid(seed: string): string {
  const digest = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 46);
  return `bafy${digest}`;
}

function logEvent(
  db: Database.Database,
  opts: { eventName: string; taskId: string; blockNumber: number; txHash: string; data: unknown },
) {
  db.prepare(
    'INSERT INTO events (event_name, task_id, block_number, tx_hash, data) VALUES (?, ?, ?, ?, ?)',
  ).run(opts.eventName, opts.taskId, opts.blockNumber, opts.txHash, JSON.stringify(opts.data));
}

export interface LifecycleResult {
  taskId: string;
  finalStatus: string;
  qualityScore: number;
  approved: boolean;
  executor: string;
  arbitrator: string;
}

export function runLifecycle(
  taskId: string,
  options: { autoApproveThreshold?: number; arbitratorCapability?: string } = {},
): LifecycleResult {
  const db = getDb();
  const threshold = options.autoApproveThreshold ?? 75;
  const arbCapability = options.arbitratorCapability ?? 'legal';

  const task = db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId) as any;
  if (!task) throw new Error(`Task not found: ${taskId}`);

  const preferredCapability = inferCapability(task.description);
  const executor = chooseExecutor(db, preferredCapability);
  const arbitrator = chooseArbitrator(db, arbCapability, executor.address);

  const now = Math.floor(Date.now() / 1000);
  const blockBase = (task.block_number || 2000000) + 1;

  // Assign
  const txAssign = makeTxHash(`assign:${task.task_id}:${now}`);
  db.prepare(
    "UPDATE tasks SET assigned_agent = ?, assigned_agent_did = ?, status = 'InProgress', block_number = ?, tx_hash = ? WHERE task_id = ?",
  ).run(executor.address, executor.did, blockBase, txAssign, task.task_id);

  logEvent(db, {
    eventName: 'TaskAssigned',
    taskId: task.task_id,
    blockNumber: blockBase,
    txHash: txAssign,
    data: { preferredCapability, assignedAgent: executor.address, assignedAgentDID: executor.did },
  });

  // Complete
  const proofDigest = crypto
    .createHash('sha256')
    .update(JSON.stringify({ taskId: task.task_id, executor: executor.address }))
    .digest('hex');
  const proofCID = makeCid(`proof:${proofDigest}`);
  const qualityScore = Math.min(
    96,
    65 + Math.floor((executor.tasks_completed || 0) / 120) + (preferredCapability ? 8 : 3),
  );

  const txComplete = makeTxHash(`complete:${task.task_id}:${now}`);
  db.prepare(
    "UPDATE tasks SET output_cid = ?, status = 'Completed', completed_at = ?, block_number = ?, tx_hash = ? WHERE task_id = ?",
  ).run(proofCID, now, blockBase + 1, txComplete, task.task_id);

  logEvent(db, {
    eventName: 'TaskCompleted',
    taskId: task.task_id,
    blockNumber: blockBase + 1,
    txHash: txComplete,
    data: { outputCID: proofCID, proofDigest },
  });

  // Arbitration
  const approved = qualityScore >= threshold;

  if (approved) {
    const txReward = makeTxHash(`reward:${task.task_id}:${now}`);
    db.prepare(
      "UPDATE tasks SET status = 'Resolved', block_number = ?, tx_hash = ? WHERE task_id = ?",
    ).run(blockBase + 4, txReward, task.task_id);

    db.prepare(
      'UPDATE agents SET tasks_completed = tasks_completed + 1, disputes_won = disputes_won + 1 WHERE address = ?',
    ).run(executor.address);

    logEvent(db, {
      eventName: 'RewardReleased',
      taskId: task.task_id,
      blockNumber: blockBase + 4,
      txHash: txReward,
      data: { agent: executor.address, reward: task.reward },
    });
  } else {
    const txDispute = makeTxHash(`dispute:${task.task_id}:${now}`);
    db.prepare(
      "UPDATE tasks SET status = 'Disputed', block_number = ?, tx_hash = ? WHERE task_id = ?",
    ).run(blockBase + 4, txDispute, task.task_id);

    db.prepare(
      'UPDATE agents SET disputes_lost = disputes_lost + 1 WHERE address = ?',
    ).run(executor.address);
  }

  const finalTask = db.prepare('SELECT status FROM tasks WHERE task_id = ?').get(taskId) as { status: string };

  return {
    taskId,
    finalStatus: finalTask.status,
    qualityScore,
    approved,
    executor: executor.address,
    arbitrator: arbitrator.address,
  };
}
