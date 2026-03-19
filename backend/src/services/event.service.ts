import type Database from 'better-sqlite3';
import type { EventRow, EventQueryParams } from '../types';
import { toPositiveInt } from '../utils';

export function queryEvents(db: Database.Database, params: EventQueryParams): EventRow[] {
  const { task_id, event_name, q, limit = 100, offset = 0 } = params;
  let sql = 'SELECT * FROM events WHERE 1=1';
  const values: unknown[] = [];

  if (task_id) {
    sql += ' AND task_id = ?';
    values.push(task_id);
  }
  if (event_name) {
    sql += ' AND event_name = ?';
    values.push(event_name);
  }
  if (q) {
    sql += ' AND (task_id LIKE ? OR event_name LIKE ? OR data LIKE ?)';
    const pattern = `%${q}%`;
    values.push(pattern, pattern, pattern);
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  values.push(toPositiveInt(limit, 100), toPositiveInt(offset, 0));

  return db.prepare(sql).all(...values) as EventRow[];
}
