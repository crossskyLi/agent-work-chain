import { getDb } from '../db';
import { getPgReader } from './postgres';
import type { AgentQueryParams, AgentRow } from '../types';
import { getAgentByAddress, queryAgents } from '../services/agent.service';
import { toPositiveInt } from '../utils';

const READ_DRIVER = (process.env.READ_DB_DRIVER || 'sqlite').toLowerCase();

function usePostgresForReads(): boolean {
  return READ_DRIVER === 'postgres' && Boolean(getPgReader());
}

export async function listAgents(params: AgentQueryParams): Promise<AgentRow[]> {
  if (!usePostgresForReads()) {
    return queryAgents(getDb(), params);
  }

  const pg = getPgReader();
  if (!pg) return queryAgents(getDb(), params);

  const { capability, q, limit = 50, offset = 0 } = params;
  const where: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (capability) {
    where.push(`capabilities ILIKE $${i++}`);
    values.push(`%${capability}%`);
  }
  if (q) {
    where.push(`(address ILIKE $${i} OR did ILIKE $${i} OR capabilities ILIKE $${i})`);
    values.push(`%${q}%`);
    i += 1;
  }

  const sql = `
    SELECT *
    FROM agents
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY tasks_completed DESC
    LIMIT $${i++}
    OFFSET $${i}
  `;
  values.push(toPositiveInt(limit, 50), toPositiveInt(offset, 0));

  const result = await pg.query(sql, values);
  return result.rows as AgentRow[];
}

export async function findAgentByAddress(address: string): Promise<AgentRow | undefined> {
  if (!usePostgresForReads()) {
    return getAgentByAddress(getDb(), address);
  }

  const pg = getPgReader();
  if (!pg) return getAgentByAddress(getDb(), address);

  const result = await pg.query(
    'SELECT * FROM agents WHERE address = $1 OR did = $1 LIMIT 1',
    [address],
  );
  return result.rows[0] as AgentRow | undefined;
}
