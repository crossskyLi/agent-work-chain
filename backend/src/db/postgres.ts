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
    CREATE TABLE IF NOT EXISTS auditors (
      address TEXT PRIMARY KEY,
      specialties TEXT,
      stake TEXT DEFAULT '0',
      total_audits INTEGER DEFAULT 0,
      accuracy_score INTEGER DEFAULT 5000,
      registered_at BIGINT,
      block_number BIGINT,
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
      submitted_at BIGINT,
      block_number BIGINT,
      tx_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS certifications (
      id BIGSERIAL PRIMARY KEY,
      agent TEXT NOT NULL,
      cert_type TEXT NOT NULL,
      issued_at BIGINT,
      valid_until BIGINT,
      block_number BIGINT,
      tx_hash TEXT,
      UNIQUE(agent, cert_type)
    );

    CREATE TABLE IF NOT EXISTS events (
      id BIGSERIAL PRIMARY KEY,
      event_name TEXT NOT NULL,
      audit_id TEXT,
      block_number BIGINT NOT NULL,
      tx_hash TEXT NOT NULL,
      data TEXT,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );

    CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
    CREATE INDEX IF NOT EXISTS idx_audits_auditor ON audits(auditor);
    CREATE INDEX IF NOT EXISTS idx_audits_target_agent ON audits(target_agent);
    CREATE INDEX IF NOT EXISTS idx_certifications_agent ON certifications(agent);
    CREATE INDEX IF NOT EXISTS idx_events_audit_id ON events(audit_id);
    CREATE INDEX IF NOT EXISTS idx_events_event_name ON events(event_name);
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
