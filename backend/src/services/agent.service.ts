import type Database from 'better-sqlite3';
import type { AgentRow, AgentQueryParams } from '../types';
import { toPositiveInt } from '../utils';

export function queryAgents(db: Database.Database, params: AgentQueryParams): AgentRow[] {
  const { capability, q, limit = 50, offset = 0 } = params;
  let sql = 'SELECT * FROM agents WHERE 1=1';
  const values: unknown[] = [];

  if (capability) {
    sql += ' AND capabilities LIKE ?';
    values.push(`%${capability}%`);
  }
  if (q) {
    sql += ' AND (address LIKE ? OR did LIKE ? OR capabilities LIKE ?)';
    const pattern = `%${q}%`;
    values.push(pattern, pattern, pattern);
  }

  sql += ' ORDER BY tasks_completed DESC LIMIT ? OFFSET ?';
  values.push(toPositiveInt(limit, 50), toPositiveInt(offset, 0));

  return db.prepare(sql).all(...values) as AgentRow[];
}

export function getAgentByAddress(db: Database.Database, address: string): AgentRow | undefined {
  return db
    .prepare('SELECT * FROM agents WHERE address = ? OR did = ?')
    .get(address, address) as AgentRow | undefined;
}
