const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('AuditRegistry', function () {
  it('registers auditor, submits and confirms audit, updates trust score, issues certification', async function () {
    const [deployer, auditor, target] = await ethers.getSigners();

    const AuditRegistry = await ethers.getContractFactory('AuditRegistry');
    const registry = await AuditRegistry.deploy();
    await registry.waitForDeployment();

    await registry.connect(deployer).setMinStake(ethers.parseEther('0.01'));

    await expect(
      registry.connect(auditor).registerAuditor('code,security', { value: ethers.parseEther('0.1') }),
    ).to.emit(registry, 'AuditorRegistered');

    const auditId = 'audit-test-001';
    await expect(
      registry
        .connect(auditor)
        .submitAudit(auditId, target.address, 'QmReport', 88, '{"a":1}'),
    ).to.emit(registry, 'AuditSubmitted');

    let [avg0, count0] = await registry.getTrustScore(target.address);
    expect(Number(avg0)).to.equal(0);
    expect(Number(count0)).to.equal(0);

    await expect(registry.connect(deployer).confirmAudit(auditId)).to.emit(registry, 'AuditConfirmed');

    const [avg1, count1] = await registry.getTrustScore(target.address);
    expect(Number(avg1)).to.equal(88);
    expect(Number(count1)).to.equal(1);

    const block = await ethers.provider.getBlock('latest');
    const validUntil = BigInt(block.timestamp) + 365n * 24n * 3600n;

    await expect(
      registry.connect(deployer).issueCertification(target.address, 'security-tier-1', validUntil),
    ).to.emit(registry, 'CertificationIssued');

    const [valid, issuedAt, vu] = await registry.getCertification(target.address, 'security-tier-1');
    expect(valid).to.equal(true);
    expect(issuedAt).to.be.gt(0n);
    expect(vu).to.equal(validUntil);
  });
});
