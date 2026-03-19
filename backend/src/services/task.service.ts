import type Database from 'better-sqlite3';
import type { TaskRow, TaskQueryParams } from '../types';
import { toPositiveInt } from '../utils';

export function queryTasks(db: Database.Database, params: TaskQueryParams): TaskRow[] {
  const { status, creator, agent, q, limit = 50, offset = 0 } = params;
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const values: unknown[] = [];

  if (status) {
    sql += ' AND status = ?';
    values.push(status);
  }
  if (creator) {
    sql += ' AND creator = ?';
    values.push(creator);
  }
  if (agent) {
    sql += ' AND assigned_agent = ?';
    values.push(agent);
  }
  if (q) {
    sql += ' AND (task_id LIKE ? OR description LIKE ? OR assigned_agent_did LIKE ?)';
    const pattern = `%${q}%`;
    values.push(pattern, pattern, pattern);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  values.push(toPositiveInt(limit, 50), toPositiveInt(offset, 0));

  return db.prepare(sql).all(...values) as TaskRow[];
}

export function getTaskById(db: Database.Database, taskId: string): TaskRow | undefined {
  return db.prepare('SELECT * FROM tasks WHERE task_id = ?').get(taskId) as TaskRow | undefined;
}
