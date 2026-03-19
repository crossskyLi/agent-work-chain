import { Pool } from 'pg';

let writerPool: Pool | null = null;
let readerPool: Pool | null = null;
let schemaReady = false;

function getWriterUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.PG_WRITER_URL;
}

function getReaderUrl(): string | undefined {
  return process.env.PG_READER_URL || getWriterUrl();
}

export function isPostgresEnabled(): boolean {
  return Boolean(getWriterUrl());
}

export function getPgWriter(): Pool | null {
  const url = getWriterUrl();
  if (!url) return null;
  if (!writerPool) {
    writerPool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_WRITER_POOL_MAX || 10),
    });
  }
  return writerPool;
}

export function getPgReader(): Pool | null {
  const url = getReaderUrl();
  if (!url) return null;
  if (!readerPool) {
    readerPool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_READER_POOL_MAX || 20),
    });
  }
  return readerPool;
}

export async function ensurePgSchema(): Promise<void> {
  if (schemaReady) return;
  const pool = getPgWriter();
  if (!pool) return;

  await pool.query(`
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
      created_at BIGINT,
      completed_at BIGINT,
      block_number BIGINT,
      tx_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS agents (
      address TEXT PRIMARY KEY,
      did TEXT UNIQUE,
      capabilities TEXT,
      tasks_completed INTEGER DEFAULT 0,
      disputes_won INTEGER DEFAULT 0,
      disputes_lost INTEGER DEFAULT 0,
      last_seen_block BIGINT DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      event_name TEXT NOT NULL,
      task_id TEXT,
      block_number BIGINT NOT NULL,
      tx_hash TEXT NOT NULL,
      data TEXT,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id BIGSERIAL PRIMARY KEY,
      task_id TEXT NOT NULL,
      type TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      gross_amount TEXT,
      net_amount TEXT NOT NULL,
      fee_amount TEXT,
      block_number BIGINT NOT NULL,
      tx_hash TEXT NOT NULL,
      settled_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
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

  schemaReady = true;
}

export async function closePg(): Promise<void> {
  await Promise.all([
    writerPool?.end(),
    readerPool && readerPool !== writerPool ? readerPool.end() : Promise.resolve(),
  ]);
  writerPool = null;
  readerPool = null;
  schemaReady = false;
}
