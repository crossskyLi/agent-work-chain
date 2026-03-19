'use strict';

const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const args = {
    dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'indexer.db'),
    taskId: '',
    preferredCapability: '',
    arbitratorCapability: 'legal',
    autoApproveThreshold: 75,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--db' && argv[i + 1]) {
      args.dbPath = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    } else if (arg === '--task-id' && argv[i + 1]) {
      args.taskId = String(argv[i + 1]);
      i += 1;
    } else if (arg === '--capability' && argv[i + 1]) {
      args.preferredCapability = String(argv[i + 1]);
      i += 1;
    } else if (arg === '--arbitrator-capability' && argv[i + 1]) {
      args.arbitratorCapability = String(argv[i + 1]);
      i += 1;
    } else if (arg === '--auto-approve-threshold' && argv[i + 1]) {
      args.autoApproveThreshold = Number(argv[i + 1]) || 75;
      i += 1;
    }
  }

  return args;
}

function ensureTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      task_id TEXT PRIMARY KEY,
      creator TEXT NOT NULL,
      assigned_agent TEXT,
      assigned_agent_did TEXT,
      description TEXT,
      input_cid TEXT,
      output_cid TEXT,
      reward TEXT,
      status TEXT NOT NULL DEFAULT 'Created',
      created_at INTEGER,
      completed_at INTEGER,
      block_number INTEGER,
      tx_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS agents (
      address TEXT PRIMARY KEY,
      did TEXT UNIQUE,
      capabilities TEXT,
      tasks_completed INTEGER DEFAULT 0,
      disputes_won INTEGER DEFAULT 0,
      disputes_lost INTEGER DEFAULT 0,
      last_seen_block INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      task_id TEXT,
      block_number INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      data TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
  `);
}

function inferCapability(taskDescription) {
  const text = String(taskDescription || '');
  if (/页面|UI|UX|体验|设计/i.test(text)) return 'design-creative';
  if (/代码|开发|数据|自动化/i.test(text)) return 'software-data';
  if (/销售|获客|转化/i.test(text)) return 'sales';
  return 'task-execution';
}

function chooseExecutor(db, preferredCapability) {
  const capability = preferredCapability || '';
  let candidates = [];

  if (capability) {
    candidates = db.prepare(`
      SELECT *
      FROM agents
      WHERE capabilities LIKE ?
      ORDER BY tasks_completed DESC
      LIMIT 20
    `).all(`%${capability}%`);
  }

  if (!candidates.length) {
    candidates = db.prepare(`
      SELECT *
      FROM agents
      ORDER BY tasks_completed DESC
      LIMIT 20
    `).all();
  }

  if (!candidates.length) {
    throw new Error('No agents available. Run simulate:agents first.');
  }

  return candidates[0];
}

function chooseArbitrator(db, capability, excludeAddress) {
  let rows = [];
  if (capability) {
    rows = db.prepare(`
      SELECT *
      FROM agents
      WHERE capabilities LIKE ?
        AND address != ?
      ORDER BY tasks_completed DESC
      LIMIT 20
    `).all(`%${capability}%`, excludeAddress);
  }

  if (!rows.length) {
    rows = db.prepare(`
      SELECT *
      FROM agents
      WHERE address != ?
      ORDER BY tasks_completed DESC
      LIMIT 20
    `).all(excludeAddress);
  }

  if (!rows.length) {
    throw new Error('No arbitrator candidate found.');
  }

  return rows[0];
}

function makeTxHash(seed) {
  return `0x${crypto.createHash('sha256').update(seed).digest('hex')}`;
}

function makeCid(seed) {
  const digest = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 46);
  return `bafy${digest}`;
}

function logEvent(db, { eventName, taskId, blockNumber, txHash, data }) {
  db.prepare(`
    INSERT INTO events (event_name, task_id, block_number, tx_hash, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(eventName, taskId, blockNumber, txHash, JSON.stringify(data));
}

function buildWorkProof(task, executor, preferredCapability) {
  const now = new Date().toISOString();
  const proofPayload = {
    taskId: task.task_id,
    executor: {
      address: executor.address,
      did: executor.did,
      capabilities: executor.capabilities,
    },
    executionPlan: {
      workstream: 'dual-ui-optimization',
      humanInterface: [
        'simplify navigation and reduce cognitive load',
        'highlight primary actions with clear labels',
        'improve readability and onboarding hints',
      ],
      agentInterface: [
        'increase information density for task state',
        'show deterministic status transitions',
        'surface structured diagnostics and confidence',
      ],
      targetCapability: preferredCapability || inferCapability(task.description),
    },
    effort: {
      estimatedHours: 14,
      storyPoints: 8,
      changedModules: ['site/query', 'backend/api', 'task-state-flow'],
    },
    deliveredAt: now,
  };

  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(proofPayload))
    .digest('hex');

  const qualityScore = Math.min(
    96,
    65 + Math.floor((executor.tasks_completed || 0) / 120) + (preferredCapability ? 8 : 3)
  );

  return {
    proofPayload,
    proofDigest: digest,
    proofCID: makeCid(`proof:${digest}`),
    qualityScore,
  };
}

function main() {
  const args = parseArgs(process.argv);
  const db = new Database(args.dbPath);
  ensureTables(db);

  let task;
  if (args.taskId) {
    task = db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(args.taskId);
  } else {
    task = db.prepare(`
      SELECT *
      FROM tasks
      WHERE status = 'Created'
      ORDER BY created_at DESC
      LIMIT 1
    `).get();
  }

  if (!task) {
    throw new Error('No target task found. Create one via simulate:task first.');
  }

  const preferredCapability = args.preferredCapability || inferCapability(task.description);
  const executor = chooseExecutor(db, preferredCapability);
  const arbitrator = chooseArbitrator(db, args.arbitratorCapability, executor.address);

  const now = Math.floor(Date.now() / 1000);
  const blockBase = (task.block_number || 2000000) + 1;

  const txAssign = makeTxHash(`assign:${task.task_id}:${now}`);
  db.prepare(`
    UPDATE tasks
    SET assigned_agent = ?, assigned_agent_did = ?, status = 'InProgress', block_number = ?, tx_hash = ?
    WHERE task_id = ?
  `).run(executor.address, executor.did, blockBase, txAssign, task.task_id);
  logEvent(db, {
    eventName: 'TaskAssigned',
    taskId: task.task_id,
    blockNumber: blockBase,
    txHash: txAssign,
    data: {
      preferredCapability,
      assignedAgent: executor.address,
      assignedAgentDID: executor.did,
      strategy: 'capability_then_tasks_completed',
    },
  });

  const workProof = buildWorkProof(task, executor, preferredCapability);
  const txComplete = makeTxHash(`complete:${task.task_id}:${now}`);
  db.prepare(`
    UPDATE tasks
    SET output_cid = ?, status = 'Completed', completed_at = ?, block_number = ?, tx_hash = ?
    WHERE task_id = ?
  `).run(workProof.proofCID, now, blockBase + 1, txComplete, task.task_id);
  logEvent(db, {
    eventName: 'TaskCompleted',
    taskId: task.task_id,
    blockNumber: blockBase + 1,
    txHash: txComplete,
    data: {
      outputCID: workProof.proofCID,
      proofDigest: workProof.proofDigest,
      proofPayload: workProof.proofPayload,
    },
  });

  const txArbSubmit = makeTxHash(`arb-submit:${task.task_id}:${now}`);
  logEvent(db, {
    eventName: 'ArbitrationRequested',
    taskId: task.task_id,
    blockNumber: blockBase + 2,
    txHash: txArbSubmit,
    data: {
      arbitratorAgent: {
        address: arbitrator.address,
        did: arbitrator.did,
        capabilities: arbitrator.capabilities,
      },
      submittedBy: 'simulate-auto-lifecycle',
      reviewInput: {
        proofCID: workProof.proofCID,
        proofDigest: workProof.proofDigest,
      },
    },
  });

  const approved = workProof.qualityScore >= args.autoApproveThreshold;
  const txArbRule = makeTxHash(`arb-rule:${task.task_id}:${now}`);
  logEvent(db, {
    eventName: 'ArbitrationRuled',
    taskId: task.task_id,
    blockNumber: blockBase + 3,
    txHash: txArbRule,
    data: {
      arbitrator: arbitrator.address,
      verdict: approved ? 'APPROVED' : 'REJECTED',
      qualityScore: workProof.qualityScore,
      threshold: args.autoApproveThreshold,
      reason: approved
        ? 'work proof is complete and consistent with task objective'
        : 'work proof quality below acceptance threshold',
    },
  });

  if (approved) {
    db.prepare(`
      UPDATE tasks
      SET status = 'Resolved', block_number = ?, tx_hash = ?
      WHERE task_id = ?
    `).run(blockBase + 4, makeTxHash(`reward:${task.task_id}:${now}`), task.task_id);

    db.prepare(`
      UPDATE agents
      SET tasks_completed = tasks_completed + 1
      WHERE address = ?
    `).run(executor.address);

    db.prepare(`
      UPDATE agents
      SET disputes_won = disputes_won + 1
      WHERE address = ?
    `).run(executor.address);

    logEvent(db, {
      eventName: 'RewardReleased',
      taskId: task.task_id,
      blockNumber: blockBase + 4,
      txHash: makeTxHash(`reward:${task.task_id}:${now}`),
      data: {
        agent: executor.address,
        reward: task.reward,
        settlement: 'approved-by-arbitrator-agent',
      },
    });
  } else {
    db.prepare(`
      UPDATE tasks
      SET status = 'Disputed', block_number = ?, tx_hash = ?
      WHERE task_id = ?
    `).run(blockBase + 4, makeTxHash(`dispute:${task.task_id}:${now}`), task.task_id);

    db.prepare(`
      UPDATE agents
      SET disputes_lost = disputes_lost + 1
      WHERE address = ?
    `).run(executor.address);
  }

  const taskAfter = db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(task.task_id);
  const recentEvents = db.prepare(`
    SELECT id, event_name, task_id, block_number, tx_hash, data, created_at
    FROM events
    WHERE task_id = ?
    ORDER BY id DESC
    LIMIT 8
  `).all(task.task_id);

  console.log(JSON.stringify({
    mode: 'simulated-auto-lifecycle',
    taskId: task.task_id,
    preferredCapability,
    executor: {
      address: executor.address,
      did: executor.did,
      capabilities: executor.capabilities,
    },
    arbitrator: {
      address: arbitrator.address,
      did: arbitrator.did,
      capabilities: arbitrator.capabilities,
    },
    workProof: {
      proofCID: workProof.proofCID,
      proofDigest: workProof.proofDigest,
      qualityScore: workProof.qualityScore,
      threshold: args.autoApproveThreshold,
    },
    finalTask: taskAfter,
    recentEvents,
  }, null, 2));
}

main();
