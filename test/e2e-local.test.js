const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Audit Swarm E2E (local)', function () {
  it('deploys registry + mock target, full audit and certification flow', async function () {
    const [deployer, auditor] = await ethers.getSigners();

    const AuditRegistry = await ethers.getContractFactory('AuditRegistry');
    const registry = await AuditRegistry.deploy();
    await registry.waitForDeployment();

    const MockAuditTarget = await ethers.getContractFactory('MockAuditTarget');
    const mockTarget = await MockAuditTarget.deploy('TestAgent');
    await mockTarget.waitForDeployment();
    const targetAddr = await mockTarget.getAddress();

    expect(await mockTarget.name()).to.equal('TestAgent');

    await registry.connect(deployer).setMinStake(0n);
    await registry.connect(auditor).registerAuditor('performance,ethics', { value: ethers.parseEther('0.05') });

    const auditId = 'e2e-audit-001';
    const overallScore = 92;
    await registry
      .connect(auditor)
      .submitAudit(auditId, targetAddr, 'QmE2EReport', overallScore, '{"latency":90}');

    await registry.connect(deployer).confirmAudit(auditId);

    const [avgScore, auditCount] = await registry.getTrustScore(targetAddr);
    expect(Number(avgScore)).to.equal(overallScore);
    expect(Number(auditCount)).to.equal(1);

    const latest = await ethers.provider.getBlock('latest');
    const validUntil = BigInt(latest.timestamp) + 86400n * 30n;
    await registry.connect(deployer).issueCertification(targetAddr, 'audit-pass', validUntil);

    const [certValid, , until] = await registry.getCertification(targetAddr, 'audit-pass');
    expect(certValid).to.equal(true);
    expect(until).to.equal(validUntil);
  });
});
