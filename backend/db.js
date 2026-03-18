'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'indexer.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    init(db);
  }
  return db;
}

function init(db) {
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

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(creator);
    CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent);
    CREATE INDEX IF NOT EXISTS idx_agents_did ON agents(did);
    CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id);
    CREATE INDEX IF NOT EXISTS idx_events_name ON events(event_name);
  `);
}

module.exports = { getDb };
