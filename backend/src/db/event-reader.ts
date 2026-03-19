import { getDb } from '../db';
import { getPgReader } from './postgres';
import type { EventQueryParams, EventRow } from '../types';
import { queryEvents } from '../services/event.service';
import { toPositiveInt } from '../utils';

const READ_DRIVER = (process.env.READ_DB_DRIVER || 'sqlite').toLowerCase();

function usePostgresForReads(): boolean {
  return READ_DRIVER === 'postgres' && Boolean(getPgReader());
}

export async function listEvents(params: EventQueryParams): Promise<EventRow[]> {
  if (!usePostgresForReads()) {
    return queryEvents(getDb(), params);
  }

  const pg = getPgReader();
  if (!pg) return queryEvents(getDb(), params);

  const { task_id, event_name, q, limit = 100, offset = 0 } = params;
  const where: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (task_id) {
    where.push(`task_id = $${i++}`);
    values.push(task_id);
  }
  if (event_name) {
    where.push(`event_name = $${i++}`);
    values.push(event_name);
  }
  if (q) {
    where.push(`(task_id ILIKE $${i} OR event_name ILIKE $${i} OR data ILIKE $${i})`);
    values.push(`%${q}%`);
    i += 1;
  }

  const sql = `
    SELECT *
    FROM events
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY id DESC
    LIMIT $${i++}
    OFFSET $${i}
  `;
  values.push(toPositiveInt(limit, 100), toPositiveInt(offset, 0));

  const result = await pg.query(sql, values);
  return result.rows as EventRow[];
}
