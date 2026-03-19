'use strict';

const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

function parseArgs(argv) {
  const args = {
    dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'backend', 'indexer.db'),
    description: 'Help optimize overall page experience with separate human and agent interfaces.',
    reward: '0.01',
    creator: '',
    taskId: '',
    status: 'Created',
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--db' && argv[i + 1]) {
      args.dbPath = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    } else if (arg === '--description' && argv[i + 1]) {
      args.description = String(argv[i + 1]);
      i += 1;
    } else if (arg === '--reward' && argv[i + 1]) {
      args.reward = String(argv[i + 1]);
      i += 1;
    } else if (arg === '--creator' && argv[i + 1]) {
      args.creator = String(argv[i + 1]);
      i += 1;
    } else if (arg === '--task-id' && argv[i + 1]) {
      args.taskId = String(argv[i + 1]);
      i += 1;
    } else if (arg === '--status' && argv[i + 1]) {
      args.status = String(argv[i + 1]);
      i += 1;
    }
  }

  return args;
}

function makeAddress(seed) {
  const digest = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 40);
  return `0x${digest}`;
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

function main() {
  const args = parseArgs(process.argv);
  const db = new Database(args.dbPath);
  ensureTables(db);

  const now = Math.floor(Date.now() / 1000);
  const seed = `${args.description}:${now}`;
  const taskId = args.taskId || `sim-task-${now}-${crypto.randomBytes(3).toString('hex')}`;
  const creator = args.creator || makeAddress(`creator:${seed}`);
  const blockNumber = 2000000 + (now % 100000);
  const txHash = `0x${crypto.createHash('sha256').update(`tx:${seed}`).digest('hex')}`;

  db.prepare(`
    INSERT INTO tasks (
      task_id, creator, description, reward, status, created_at, block_number, tx_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(task_id) DO UPDATE SET
      creator = excluded.creator,
      description = excluded.description,
      reward = excluded.reward,
      status = excluded.status,
      created_at = excluded.created_at,
      block_number = excluded.block_number,
      tx_hash = excluded.tx_hash
  `).run(taskId, creator, args.description, args.reward, args.status, now, blockNumber, txHash);

  db.prepare(`
    INSERT INTO events (event_name, task_id, block_number, tx_hash, data)
    VALUES (?, ?, ?, ?, ?)
  `).run('TaskCreated', taskId, blockNumber, txHash, JSON.stringify({
    creator,
    reward: args.reward,
    description: args.description,
    source: 'simulate-task-request',
  }));

  const task = db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId);
  console.log(JSON.stringify({
    mode: 'simulated-task-request',
    dbPath: args.dbPath,
    task,
  }, null, 2));
}

main();
