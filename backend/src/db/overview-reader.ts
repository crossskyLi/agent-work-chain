import { getDb } from '../db';
import { getPgReader } from './postgres';

const READ_DRIVER = (process.env.READ_DB_DRIVER || 'sqlite').toLowerCase();

function usePostgresForReads(): boolean {
  return READ_DRIVER === 'postgres' && Boolean(getPgReader());
}

export async function getOverviewCounts(): Promise<{
  tasks: number;
  agents: number;
  events: number;
}> {
  if (!usePostgresForReads()) {
    const db = getDb();
    return {
      tasks: (db.prepare('SELECT COUNT(*) as c FROM tasks').get() as { c: number }).c,
      agents: (db.prepare('SELECT COUNT(*) as c FROM agents').get() as { c: number }).c,
      events: (db.prepare('SELECT COUNT(*) as c FROM events').get() as { c: number }).c,
    };
  }

  const pg = getPgReader();
  if (!pg) {
    const db = getDb();
    return {
      tasks: (db.prepare('SELECT COUNT(*) as c FROM tasks').get() as { c: number }).c,
      agents: (db.prepare('SELECT COUNT(*) as c FROM agents').get() as { c: number }).c,
      events: (db.prepare('SELECT COUNT(*) as c FROM events').get() as { c: number }).c,
    };
  }

  const [taskCount, agentCount, eventCount] = await Promise.all([
    pg.query('SELECT COUNT(*)::int AS c FROM tasks'),
    pg.query('SELECT COUNT(*)::int AS c FROM agents'),
    pg.query('SELECT COUNT(*)::int AS c FROM events'),
  ]);

  return {
    tasks: Number(taskCount.rows[0]?.c || 0),
    agents: Number(agentCount.rows[0]?.c || 0),
    events: Number(eventCount.rows[0]?.c || 0),
  };
}
