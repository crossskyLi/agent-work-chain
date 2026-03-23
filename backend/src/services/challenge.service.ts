import { randomUUID } from 'crypto';
import { getDb } from '../db';
import type { AuditRow } from './audit.service';
import { CHALLENGE_AUDITOR, getAuditById } from './audit.service';

export interface ChallengeDimensions {
  kind: 'challenge';
  challengeType: string;
  prompt: string;
}

export function createChallenge(
  targetAgent: string,
  challengeType: string,
  prompt: string,
): AuditRow {
  const db = getDb();
  const auditId = `challenge-${randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  const dimensions: ChallengeDimensions = {
    kind: 'challenge',
    challengeType,
    prompt,
  };

  db.prepare(
    `INSERT INTO audits (
      audit_id, auditor, target_agent, report_cid, overall_score, dimensions, status, submitted_at
    ) VALUES (?, ?, ?, NULL, NULL, ?, 'Pending', ?)`,
  ).run(auditId, CHALLENGE_AUDITOR, targetAgent, JSON.stringify(dimensions), now);

  const row = getAuditById(auditId);
  if (!row) {
    throw new Error('failed to load challenge audit after insert');
  }
  return row;
}

export function evaluateChallenge(
  auditId: string,
  score: number,
  report: string,
): { data?: AuditRow; error?: string } {
  const db = getDb();
  const existing = getAuditById(auditId);
  if (!existing) {
    return { error: 'audit not found' };
  }
  if (existing.auditor !== CHALLENGE_AUDITOR) {
    return { error: 'only challenge audits can be evaluated via this endpoint' };
  }
  if (existing.status !== 'Pending') {
    return { error: `audit already ${existing.status}` };
  }

  const clampedScore = Math.min(Math.max(Math.round(score), 0), 100);

  db.prepare(
    `UPDATE audits
     SET overall_score = ?, report_cid = ?, status = 'Confirmed'
     WHERE audit_id = ? AND auditor = ? AND status = 'Pending'`,
  ).run(clampedScore, report, auditId, CHALLENGE_AUDITOR);

  return { data: getAuditById(auditId) };
}
