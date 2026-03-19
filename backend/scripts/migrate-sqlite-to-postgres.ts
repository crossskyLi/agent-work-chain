import Database from 'better-sqlite3';
import path from 'path';
import { ensurePgSchema, getPgWriter, closePg } from '../src/db/postgres';

type Row = Record<string, unknown>;

const SQLITE_PATH = process.env.SQLITE_PATH || process.env.DB_PATH || path.join(__dirname, '..', 'indexer.db');

function loadRows(db: Database.Database, table: string): Row[] {
  return db.prepare(`SELECT * FROM ${table}`).all() as Row[];
}

function valuesForColumns(row: Row, columns: string[]): unknown[] {
  return columns.map((c) => row[c] ?? null);
}

async function upsertTable(
  pgQuery: (sql: string, values?: unknown[]) => Promise<unknown>,
  table: string,
  columns: string[],
  conflictColumns: string[],
): Promise<number> {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const rows = loadRows(sqlite, table);
  sqlite.close();

  if (!rows.length) return 0;

  const colList = columns.join(', ');
  const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const conflictList = conflictColumns.join(', ');
  const updateSet = columns
    .filter((c) => !conflictColumns.includes(c))
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(', ');

  const sql = `
    INSERT INTO ${table} (${colList})
    VALUES (${valuePlaceholders})
    ON CONFLICT (${conflictList})
    DO UPDATE SET ${updateSet}
  `;

  for (const row of rows) {
    await pgQuery(sql, valuesForColumns(row, columns));
  }

  return rows.length;
}

async function main() {
  if (!getPgWriter()) {
    throw new Error('Postgres is not configured. Set DATABASE_URL or PG_WRITER_URL first.');
  }

  await ensurePgSchema();
  const writer = getPgWriter();
  if (!writer) throw new Error('Failed to initialize postgres writer.');

  const run = (sql: string, values?: unknown[]) => writer.query(sql, values);

  const tasks = await upsertTable(
    run,
    'tasks',
    [
      'task_id',
      'creator',
      'assigned_agent',
      'assigned_agent_did',
      'description',
      'input_cid',
      'output_cid',
      'reward',
      'status',
      'created_at',
      'completed_at',
      'block_number',
      'tx_hash',
    ],
    ['task_id'],
  );

  const agents = await upsertTable(
    run,
    'agents',
    [
      'address',
      'did',
      'capabilities',
      'tasks_completed',
      'disputes_won',
      'disputes_lost',
      'last_seen_block',
    ],
    ['address'],
  );

  const events = await upsertTable(
    run,
    'events',
    [
      'id',
      'event_name',
      'task_id',
      'block_number',
      'tx_hash',
      'data',
      'created_at',
    ],
    ['id'],
  );

  const settlements = await upsertTable(
    run,
    'settlements',
    [
      'id',
      'task_id',
      'type',
      'from_address',
      'to_address',
      'gross_amount',
      'net_amount',
      'fee_amount',
      'block_number',
      'tx_hash',
      'settled_at',
    ],
    ['id'],
  );

  console.log(
    JSON.stringify(
      {
        sqlitePath: SQLITE_PATH,
        copied: { tasks, agents, events, settlements },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.stack || err.message : String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePg();
  });
