import { getDb, closeDb } from '../src/db';

const MOCK_AUDITORS = [
  { address: '0xAud1000000000000000000000000000000000001', specialties: 'code,security', stake: '0.05' },
  { address: '0xAud2000000000000000000000000000000000002', specialties: 'performance,accuracy', stake: '0.1' },
  { address: '0xAud3000000000000000000000000000000000003', specialties: 'security,completeness,pricing', stake: '0.02' },
];

const MOCK_AGENTS = [
  '0xAgent100000000000000000000000000000000001',
  '0xAgent200000000000000000000000000000000002',
  '0xAgent300000000000000000000000000000000003',
  '0xAgent400000000000000000000000000000000004',
];

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function main() {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  console.log('Seeding auditors...');
  const insertAuditor = db.prepare(`
    INSERT OR REPLACE INTO auditors (address, specialties, stake, total_audits, accuracy_score, registered_at, block_number, tx_hash)
    VALUES (?, ?, ?, 0, 5000, ?, ?, ?)
  `);
  for (const a of MOCK_AUDITORS) {
    insertAuditor.run(a.address, a.specialties, a.stake, now - rand(86400, 604800), rand(1000, 5000), `0xtx_auditor_${a.address.slice(-4)}`);
  }

  console.log('Seeding audits...');
  const insertAudit = db.prepare(`
    INSERT OR REPLACE INTO audits (audit_id, auditor, target_agent, report_cid, overall_score, dimensions, status, submitted_at, block_number, tx_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const statuses = ['Confirmed', 'Confirmed', 'Confirmed', 'Pending', 'Disputed'];
  let auditIndex = 0;

  for (const agent of MOCK_AGENTS) {
    const numAudits = rand(2, 5);
    for (let i = 0; i < numAudits; i++) {
      auditIndex++;
      const auditor = MOCK_AUDITORS[rand(0, MOCK_AUDITORS.length - 1)];
      const score = rand(55, 98);
      const dims = {
        code: rand(50, 100), security: rand(50, 100), performance: rand(50, 100),
        accuracy: rand(50, 100), completeness: rand(50, 100), communication: rand(50, 100),
        efficiency: rand(50, 100), pricing_fairness: rand(50, 100), preference_loyalty: rand(50, 100),
      };
      const status = statuses[rand(0, statuses.length - 1)];

      insertAudit.run(
        `audit-mock-${String(auditIndex).padStart(3, '0')}`,
        auditor.address,
        agent,
        `QmMockReport${auditIndex}`,
        score,
        JSON.stringify(dims),
        status,
        now - rand(3600, 604800),
        rand(5000, 10000),
        `0xtx_audit_${auditIndex}`,
      );
    }
  }

  const confirmedAudits = db.prepare(`
    SELECT auditor, COUNT(*) as cnt FROM audits WHERE status = 'Confirmed' GROUP BY auditor
  `).all() as { auditor: string; cnt: number }[];

  for (const { auditor, cnt } of confirmedAudits) {
    db.prepare('UPDATE auditors SET total_audits = ? WHERE address = ?').run(cnt, auditor);
  }

  console.log('Seeding certifications...');
  const insertCert = db.prepare(`
    INSERT OR REPLACE INTO certifications (agent, cert_type, issued_at, valid_until, block_number, tx_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertCert.run(MOCK_AGENTS[0], 'security-tier-1', now - 86400, now + 2592000, 8000, '0xtx_cert_1');
  insertCert.run(MOCK_AGENTS[1], 'code-quality-gold', now - 172800, now + 5184000, 8500, '0xtx_cert_2');

  console.log('Seeding events...');
  const insertEvent = db.prepare(`
    INSERT INTO events (event_name, audit_id, block_number, tx_hash, data)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (let i = 1; i <= auditIndex; i++) {
    insertEvent.run('AuditSubmitted', `audit-mock-${String(i).padStart(3, '0')}`, rand(5000, 10000), `0xtx_audit_${i}`, '{}');
  }

  const totalAudits = (db.prepare('SELECT COUNT(*) as c FROM audits').get() as { c: number }).c;
  const totalAuditors = (db.prepare('SELECT COUNT(*) as c FROM auditors').get() as { c: number }).c;
  const totalCerts = (db.prepare('SELECT COUNT(*) as c FROM certifications').get() as { c: number }).c;

  console.log(`\nSeeded: ${totalAuditors} auditors, ${totalAudits} audits, ${totalCerts} certifications`);

  closeDb();
}

main();
