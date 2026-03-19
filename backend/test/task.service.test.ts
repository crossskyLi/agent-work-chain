import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { getTaskById, queryTasks } from '../src/services/task.service';

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE tasks (
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
  `);

  const stmt = db.prepare(`
    INSERT INTO tasks (
      task_id, creator, assigned_agent, assigned_agent_did, description, reward, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    'task-1',
    '0xcreatorA',
    '0xagent1',
    'did:ethr:0xagent1',
    'optimize query page',
    '1.0',
    'Created',
    100,
  );
  stmt.run(
    'task-2',
    '0xcreatorA',
    '0xagent2',
    'did:ethr:0xagent2',
    'build agent workflow',
    '2.0',
    'Resolved',
    200,
  );
  stmt.run(
    'task-3',
    '0xcreatorB',
    null,
    null,
    'write docs',
    '0.5',
    'Created',
    300,
  );

  return db;
}

describe('task.service', () => {
  let db: Database.Database;

  afterEach(() => {
    db?.close();
  });

  it('filters tasks by status and creator', () => {
    db = makeDb();
    const rows = queryTasks(db, { status: 'Created', creator: '0xcreatorA' });
    expect(rows).toHaveLength(1);
    expect(rows[0].task_id).toBe('task-1');
  });

  it('supports keyword query over task_id and description', () => {
    db = makeDb();
    const rows = queryTasks(db, { q: 'agent' });
    expect(rows.map((r) => r.task_id)).toContain('task-2');
  });

  it('returns paginated results ordered by created_at desc', () => {
    db = makeDb();
    const rows = queryTasks(db, { limit: 2, offset: 0 });
    expect(rows).toHaveLength(2);
    expect(rows[0].task_id).toBe('task-3');
    expect(rows[1].task_id).toBe('task-2');
  });

  it('returns undefined for non-existing task', () => {
    db = makeDb();
    const row = getTaskById(db, 'missing-id');
    expect(row).toBeUndefined();
  });
});
