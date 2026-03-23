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
    CREATE TABLE IF NOT EXISTS auditors (
      address TEXT PRIMARY KEY,
      specialties TEXT,
      stake TEXT DEFAULT '0',
      total_audits INTEGER DEFAULT 0,
      accuracy_score INTEGER DEFAULT 5000,
      registered_at INTEGER,
      block_number INTEGER,
      tx_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS audits (
      audit_id TEXT PRIMARY KEY,
      auditor TEXT NOT NULL,
      target_agent TEXT NOT NULL,
      report_cid TEXT,
      overall_score INTEGER,
      dimensions TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      submitted_at INTEGER,
      block_number INTEGER,
      tx_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS certifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent TEXT NOT NULL,
      cert_type TEXT NOT NULL,
      issued_at INTEGER,
      valid_until INTEGER,
      block_number INTEGER,
      tx_hash TEXT,
      UNIQUE(agent, cert_type)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      audit_id TEXT,
      block_number INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      data TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
    CREATE INDEX IF NOT EXISTS idx_audits_auditor ON audits(auditor);
    CREATE INDEX IF NOT EXISTS idx_audits_target_agent ON audits(target_agent);
    CREATE INDEX IF NOT EXISTS idx_certifications_agent ON certifications(agent);
    CREATE INDEX IF NOT EXISTS idx_events_audit_id ON events(audit_id);
    CREATE INDEX IF NOT EXISTS idx_events_event_name ON events(event_name);
  `);
}
