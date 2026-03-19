import { getDb } from '../db';
import { getPgReader } from './postgres';
import type { TaskQueryParams, TaskRow } from '../types';
import { queryTasks, getTaskById } from '../services/task.service';
import { toPositiveInt } from '../utils';

const READ_DRIVER = (process.env.READ_DB_DRIVER || 'sqlite').toLowerCase();

function usePostgresForReads(): boolean {
  return READ_DRIVER === 'postgres' && Boolean(getPgReader());
}

export async function listTasks(params: TaskQueryParams): Promise<TaskRow[]> {
  if (!usePostgresForReads()) {
    return queryTasks(getDb(), params);
  }

  const pg = getPgReader();
  if (!pg) return queryTasks(getDb(), params);

  const { status, creator, agent, q, limit = 50, offset = 0 } = params;
  const where: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (status) {
    where.push(`status = $${i++}`);
    values.push(status);
  }
  if (creator) {
    where.push(`creator = $${i++}`);
    values.push(creator);
  }
  if (agent) {
    where.push(`assigned_agent = $${i++}`);
    values.push(agent);
  }
  if (q) {
    where.push(`(task_id ILIKE $${i} OR description ILIKE $${i} OR assigned_agent_did ILIKE $${i})`);
    values.push(`%${q}%`);
    i += 1;
  }

  const sql = `
    SELECT *
    FROM tasks
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
    LIMIT $${i++}
    OFFSET $${i}
  `;
  values.push(toPositiveInt(limit, 50), toPositiveInt(offset, 0));

  const result = await pg.query(sql, values);
  return result.rows as TaskRow[];
}

export async function findTaskById(taskId: string): Promise<TaskRow | undefined> {
  if (!usePostgresForReads()) {
    return getTaskById(getDb(), taskId);
  }

  const pg = getPgReader();
  if (!pg) return getTaskById(getDb(), taskId);

  const result = await pg.query('SELECT * FROM tasks WHERE task_id = $1 LIMIT 1', [taskId]);
  return result.rows[0] as TaskRow | undefined;
}
