import { getDb } from '../db';

export interface AuditRow {
  audit_id: string;
  auditor: string;
  target_agent: string;
  report_cid: string | null;
  overall_score: number | null;
  dimensions: string | null;
  status: string;
  submitted_at: number | null;
  block_number: number | null;
  tx_hash: string | null;
}

export interface AuditorRow {
  address: string;
  specialties: string | null;
  stake: string;
  total_audits: number;
  accuracy_score: number;
  registered_at: number | null;
  block_number: number | null;
  tx_hash: string | null;
}

export interface AuditListFilters {
  status?: string;
  auditor?: string;
  targetAgent?: string;
  limit?: number;
  offset?: number;
}

const CHALLENGE_AUDITOR = '__challenge__';

export function getAuditById(auditId: string): AuditRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM audits WHERE audit_id = ?').get(auditId) as AuditRow | undefined;
}

export function listAudits(filters: AuditListFilters): AuditRow[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.auditor) {
    conditions.push('auditor = ?');
    params.push(filters.auditor);
  }
  if (filters.targetAgent) {
    conditions.push('target_agent = ?');
    params.push(filters.targetAgent);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 500);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const sql = `SELECT * FROM audits ${where} ORDER BY COALESCE(submitted_at, 0) DESC LIMIT ? OFFSET ?`;
  return db.prepare(sql).all(...params, limit, offset) as AuditRow[];
}

export function getAuditsByAgent(targetAgent: string): AuditRow[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM audits WHERE target_agent = ? ORDER BY COALESCE(submitted_at, 0) DESC',
    )
    .all(targetAgent) as AuditRow[];
}

/** Average overall_score from Confirmed audits (excludes challenge-only audits). */
export function getAgentTrustScore(targetAgent: string): {
  averageScore: number | null;
  confirmedCount: number;
} {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT AVG(overall_score) AS avg_score, COUNT(*) AS cnt
       FROM audits
       WHERE target_agent = ? AND status = 'Confirmed'
         AND overall_score IS NOT NULL AND auditor != ?`,
    )
    .get(targetAgent, CHALLENGE_AUDITOR) as { avg_score: number | null; cnt: number };

  const averageScore =
    row.avg_score != null && !Number.isNaN(row.avg_score) ? Math.round(row.avg_score * 100) / 100 : null;

  return { averageScore, confirmedCount: row.cnt };
}

export function getAuditorStats(auditor: string): AuditorRow | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM auditors WHERE address = ?').get(auditor) as AuditorRow | undefined;
}

export function listAuditors(limit = 100, offset = 0): AuditorRow[] {
  const db = getDb();
  const lim = Math.min(Math.max(limit, 1), 500);
  const off = Math.max(offset, 0);
  return db
    .prepare('SELECT * FROM auditors ORDER BY address ASC LIMIT ? OFFSET ?')
    .all(lim, off) as AuditorRow[];
}

export interface TrustScoreBreakdown {
  address: string;
  averageScore: number | null;
  confirmedCount: number;
  pendingCount: number;
  byStatus: Record<string, number>;
}

export function getTrustScoreBreakdown(address: string): TrustScoreBreakdown {
  const db = getDb();
  const { averageScore, confirmedCount } = getAgentTrustScore(address);

  const pendingRow = db
    .prepare(`SELECT COUNT(*) AS cnt FROM audits WHERE target_agent = ? AND status = 'Pending'`)
    .get(address) as { cnt: number };

  const statusRows = db
    .prepare(
      `SELECT status, COUNT(*) AS cnt FROM audits WHERE target_agent = ? GROUP BY status`,
    )
    .all(address) as { status: string; cnt: number }[];

  const byStatus: Record<string, number> = {};
  for (const r of statusRows) {
    byStatus[r.status] = r.cnt;
  }

  return {
    address,
    averageScore,
    confirmedCount,
    pendingCount: pendingRow.cnt,
    byStatus,
  };
}

export interface LeaderboardEntry {
  target_agent: string;
  averageScore: number;
  confirmedAuditCount: number;
}

export function getTrustLeaderboard(limit = 20): LeaderboardEntry[] {
  const db = getDb();
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 200);
  const rows = db
    .prepare(
      `SELECT target_agent,
              AVG(overall_score) AS avg_score,
              COUNT(*) AS cnt
       FROM audits
       WHERE status = 'Confirmed' AND overall_score IS NOT NULL
         AND auditor != ?
       GROUP BY target_agent
       HAVING cnt > 0
       ORDER BY avg_score DESC
       LIMIT ?`,
    )
    .all(CHALLENGE_AUDITOR, lim) as { target_agent: string; avg_score: number; cnt: number }[];

  return rows.map((r) => ({
    target_agent: r.target_agent,
    averageScore: Math.round(r.avg_score * 100) / 100,
    confirmedAuditCount: r.cnt,
  }));
}

export interface CertificationRow {
  id: number;
  agent: string;
  cert_type: string;
  issued_at: number | null;
  valid_until: number | null;
  block_number: number | null;
  tx_hash: string | null;
}

export function listCertifications(filters: { agent?: string; certType?: string }): CertificationRow[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: string[] = [];

  if (filters.agent) {
    conditions.push('agent = ?');
    params.push(filters.agent);
  }
  if (filters.certType) {
    conditions.push('cert_type = ?');
    params.push(filters.certType);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM certifications ${where} ORDER BY issued_at DESC`)
    .all(...params) as CertificationRow[];
}

export function getProtocolOverview(): {
  totalAudits: number;
  confirmedAudits: number;
  pendingAudits: number;
  disputedAudits: number;
  totalAuditors: number;
  totalCertifications: number;
  activeCertifications: number;
} {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const audits = db
    .prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'Confirmed' THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'Disputed' THEN 1 ELSE 0 END) AS disputed
    FROM audits WHERE auditor != ?`)
    .get(CHALLENGE_AUDITOR) as { total: number; confirmed: number; pending: number; disputed: number };

  const auditors = db
    .prepare('SELECT COUNT(*) AS cnt FROM auditors')
    .get() as { cnt: number };

  const certs = db
    .prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN valid_until > ? THEN 1 ELSE 0 END) AS active FROM certifications')
    .get(now) as { total: number; active: number };

  return {
    totalAudits: audits.total,
    confirmedAudits: audits.confirmed,
    pendingAudits: audits.pending,
    disputedAudits: audits.disputed,
    totalAuditors: auditors.cnt,
    totalCertifications: certs.total,
    activeCertifications: certs.active ?? 0,
  };
}

export { CHALLENGE_AUDITOR };
