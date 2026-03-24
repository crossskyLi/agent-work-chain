const hre = require('hardhat');

const ABI = [
  'function registerAuditor(string specialties) external payable',
  'function submitAudit(string auditId, address targetAgent, string reportCID, uint8 overallScore, string dimensions) external',
  'function confirmAudit(string auditId) external',
  'function issueCertification(address agent, string certType, uint256 validUntil) external',
  'function setMinStake(uint256 newMinStake) external',
];

async function main() {
  const { ethers } = hre;
  const signers = await ethers.getSigners();
  const [owner, auditorA, auditorB, agentX, agentY] = signers;

  const deploymentFile = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'history', 'deployments', 'deployment-localhost.json'), 'utf8'
  );
  const CONTRACT = JSON.parse(deploymentFile).auditRegistryAddress;

  const registryOwner = new ethers.Contract(CONTRACT, ABI, owner);
  const registryA = new ethers.Contract(CONTRACT, ABI, auditorA);
  const registryB = new ethers.Contract(CONTRACT, ABI, auditorB);

  console.log('--- Setting min stake to 0.01 ETH ---');
  await (await registryOwner.setMinStake(ethers.parseEther('0.01'))).wait();

  console.log(`--- Registering Auditor A: ${auditorA.address} ---`);
  await (await registryA.registerAuditor('security,code-quality,performance', {
    value: ethers.parseEther('0.05'),
  })).wait();

  console.log(`--- Registering Auditor B: ${auditorB.address} ---`);
  await (await registryB.registerAuditor('compliance,behavior-analysis', {
    value: ethers.parseEther('0.02'),
  })).wait();

  const audits = [
    { id: 'audit-001', reg: registryA, agent: agentX.address, score: 92, cid: 'QmAudit001abc', dims: '{"delivery":95,"capability":90,"compliance":88}' },
    { id: 'audit-002', reg: registryA, agent: agentY.address, score: 78, cid: 'QmAudit002def', dims: '{"delivery":75,"capability":80,"compliance":79}' },
    { id: 'audit-003', reg: registryB, agent: agentX.address, score: 88, cid: 'QmAudit003ghi', dims: '{"delivery":90,"capability":85,"compliance":89}' },
    { id: 'audit-004', reg: registryA, agent: agentX.address, score: 95, cid: 'QmAudit004jkl', dims: '{"delivery":97,"capability":93,"compliance":95}' },
    { id: 'audit-005', reg: registryB, agent: agentY.address, score: 65, cid: 'QmAudit005mno', dims: '{"delivery":60,"capability":70,"compliance":65}' },
    { id: 'audit-006', reg: registryA, agent: agentY.address, score: 82, cid: 'QmAudit006pqr', dims: '{"delivery":85,"capability":80,"compliance":81}' },
  ];

  for (const a of audits) {
    console.log(`--- Submitting ${a.id} (agent=${a.agent.slice(0,8)}..., score=${a.score}) ---`);
    await (await a.reg.submitAudit(a.id, a.agent, a.cid, a.score, a.dims)).wait();
  }

  const toConfirm = ['audit-001', 'audit-002', 'audit-003', 'audit-004', 'audit-006'];
  for (const id of toConfirm) {
    console.log(`--- Confirming ${id} ---`);
    await (await registryOwner.confirmAudit(id)).wait();
  }
  console.log('--- audit-005 left as Pending ---');

  const now = Math.floor(Date.now() / 1000);
  const certs = [
    { agent: agentX.address, type: 'security-tier-1', until: now + 90 * 86400 },
    { agent: agentX.address, type: 'performance-verified', until: now + 60 * 86400 },
    { agent: agentY.address, type: 'compliance-basic', until: now + 30 * 86400 },
  ];

  for (const c of certs) {
    console.log(`--- Issuing cert "${c.type}" to ${c.agent.slice(0,8)}... ---`);
    await (await registryOwner.issueCertification(c.agent, c.type, c.until)).wait();
  }

  console.log('\n=== Done! ===');
  console.log(`Auditors: 2 (A: ${auditorA.address}, B: ${auditorB.address})`);
  console.log(`Audits: ${audits.length} (${toConfirm.length} confirmed, 1 pending)`);
  console.log(`Certifications: ${certs.length}`);
  console.log(`Agent X: ${agentX.address}`);
  console.log(`Agent Y: ${agentY.address}`);
  console.log('\nRefresh the frontend!');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exitCode = 1;
});
