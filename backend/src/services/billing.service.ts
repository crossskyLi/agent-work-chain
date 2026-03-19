import type Database from 'better-sqlite3';
import type { SettlementRow, SettlementQueryParams } from '../types';
import { toPositiveInt } from '../utils';

export function querySettlements(
  db: Database.Database,
  params: SettlementQueryParams,
): SettlementRow[] {
  const { task_id, type, address, limit = 100, offset = 0 } = params;
  let sql = 'SELECT * FROM settlements WHERE 1=1';
  const values: unknown[] = [];

  if (task_id) {
    sql += ' AND task_id = ?';
    values.push(task_id);
  }
  if (type) {
    sql += ' AND type = ?';
    values.push(type);
  }
  if (address) {
    sql += ' AND (from_address = ? OR to_address = ?)';
    values.push(address, address);
  }

  sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
  values.push(toPositiveInt(limit, 100), toPositiveInt(offset, 0));

  return db.prepare(sql).all(...values) as SettlementRow[];
}

export interface BillingSummary {
  totalEscrowed: number;
  totalReleased: number;
  totalRefunded: number;
  totalFees: number;
  activeEscrow: number;
  settledCount: number;
  activeCount: number;
}

export function getBillingSummary(db: Database.Database): BillingSummary {
  const released = db
    .prepare(
      "SELECT COALESCE(SUM(CAST(net_amount AS REAL)), 0) AS total FROM settlements WHERE type = 'reward_released'",
    )
    .get() as { total: number };

  const refunded = db
    .prepare(
      "SELECT COALESCE(SUM(CAST(net_amount AS REAL)), 0) AS total FROM settlements WHERE type = 'reward_refunded'",
    )
    .get() as { total: number };

  const fees = db
    .prepare(
      "SELECT COALESCE(SUM(CAST(fee_amount AS REAL)), 0) AS total FROM settlements WHERE type = 'fee_charged'",
    )
    .get() as { total: number };

  const settledCount = db
    .prepare(
      "SELECT COUNT(DISTINCT task_id) AS c FROM settlements WHERE type IN ('reward_released', 'reward_refunded')",
    )
    .get() as { c: number };

  const escrowed = db
    .prepare('SELECT COALESCE(SUM(CAST(reward AS REAL)), 0) AS total FROM tasks')
    .get() as { total: number };

  const activeEscrow = db
    .prepare(
      "SELECT COALESCE(SUM(CAST(reward AS REAL)), 0) AS total, COUNT(*) AS c FROM tasks WHERE status IN ('Created', 'InProgress', 'Completed')",
    )
    .get() as { total: number; c: number };

  return {
    totalEscrowed: escrowed.total,
    totalReleased: released.total,
    totalRefunded: refunded.total,
    totalFees: fees.total,
    activeEscrow: activeEscrow.total,
    settledCount: settledCount.c,
    activeCount: activeEscrow.c,
  };
}
