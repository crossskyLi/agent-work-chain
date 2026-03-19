import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'indexer.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    bootstrap(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function bootstrap(db: Database.Database): void {
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

    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      type TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      gross_amount TEXT,
      net_amount TEXT NOT NULL,
      fee_amount TEXT,
      block_number INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      settled_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator);
    CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent);
    CREATE INDEX IF NOT EXISTS idx_agents_did ON agents(did);
    CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id);
    CREATE INDEX IF NOT EXISTS idx_events_name ON events(event_name);
    CREATE INDEX IF NOT EXISTS idx_settlements_task ON settlements(task_id);
    CREATE INDEX IF NOT EXISTS idx_settlements_type ON settlements(type);
    CREATE INDEX IF NOT EXISTS idx_settlements_to ON settlements(to_address);
    CREATE INDEX IF NOT EXISTS idx_settlements_from ON settlements(from_address);
  `);
}
