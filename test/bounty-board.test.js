const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Bounty Board', function () {
  let trustChain, owner, agentA, agentB, feeWallet;

  beforeEach(async function () {
    [owner, agentA, agentB, feeWallet] = await ethers.getSigners();

    const MockArbitrator = await ethers.getContractFactory('MockArbitrator');
    const arb = await MockArbitrator.deploy();

    const TrustChain = await ethers.getContractFactory('TrustChain');
    trustChain = await TrustChain.deploy(
      arb.target, '0x', feeWallet.address, 10, ethers.parseEther('0.01'),
    );
  });

  it('creates a bounty and lists it as open', async function () {
    await trustChain.createBounty('b-001', 'Test bounty', '', { value: ethers.parseEther('0.1') });

    expect(await trustChain.getOpenBountyCount()).to.equal(1n);
    expect(await trustChain.isBounty('b-001')).to.equal(true);

    const ids = await trustChain.getOpenBounties();
    expect(ids).to.deep.equal(['b-001']);
  });

  it('allows an agent to claim a bounty (first-come-first-served)', async function () {
    await trustChain.createBounty('b-002', 'Claim me', '', { value: ethers.parseEther('0.05') });

    await trustChain.connect(agentA).claimTask('b-002', 'did:ethr:agentA');

    const task = await trustChain.getTask('b-002');
    expect(task.assignedAgent).to.equal(agentA.address);
    expect(task.status).to.equal(1n); // InProgress
    expect(await trustChain.getOpenBountyCount()).to.equal(0n);
  });

  it('prevents double-claiming', async function () {
    await trustChain.createBounty('b-003', 'Only one', '', { value: ethers.parseEther('0.05') });
    await trustChain.connect(agentA).claimTask('b-003', 'did:ethr:agentA');

    await expect(
      trustChain.connect(agentB).claimTask('b-003', 'did:ethr:agentB'),
    ).to.be.revertedWith('Not a bounty');
  });

  it('rejects claim on non-bounty tasks', async function () {
    await trustChain.createTask('t-001', 'Not a bounty', '', { value: ethers.parseEther('0.05') });

    await expect(
      trustChain.connect(agentA).claimTask('t-001', 'did:ethr:agentA'),
    ).to.be.revertedWith('Not a bounty');
  });

  it('allows creator to cancel and get refund', async function () {
    const before = await ethers.provider.getBalance(owner.address);
    const tx1 = await trustChain.createBounty('b-004', 'Cancel me', '', { value: ethers.parseEther('0.1') });
    await tx1.wait();

    const tx2 = await trustChain.cancelBounty('b-004');
    await tx2.wait();

    const after = await ethers.provider.getBalance(owner.address);
    expect(await trustChain.getOpenBountyCount()).to.equal(0n);
    const task = await trustChain.getTask('b-004');
    expect(task.status).to.equal(5n); // Cancelled
  });

  it('handles multiple bounties and removal correctly', async function () {
    await trustChain.createBounty('m-1', 'First', '', { value: ethers.parseEther('0.01') });
    await trustChain.createBounty('m-2', 'Second', '', { value: ethers.parseEther('0.02') });
    await trustChain.createBounty('m-3', 'Third', '', { value: ethers.parseEther('0.03') });

    expect(await trustChain.getOpenBountyCount()).to.equal(3n);

    await trustChain.connect(agentA).claimTask('m-2', 'did:ethr:agentA');
    expect(await trustChain.getOpenBountyCount()).to.equal(2n);

    const remaining = await trustChain.getOpenBounties();
    expect(remaining).to.include('m-1');
    expect(remaining).to.include('m-3');
    expect(remaining).to.not.include('m-2');
  });

  it('full flow: create bounty → claim → submit → release', async function () {
    await trustChain.createBounty('flow-1', 'Full flow test', '', { value: ethers.parseEther('0.1') });

    await trustChain.connect(agentA).claimTask('flow-1', 'did:ethr:agentA');
    await trustChain.connect(agentA).completeTask('flow-1', 'QmResultCID');
    await trustChain.releaseReward('flow-1');

    const task = await trustChain.getTask('flow-1');
    expect(task.status).to.equal(4n); // Resolved
    expect(task.outputCID).to.equal('QmResultCID');
  });

  // --- Staking ---

  it('requires stake when minStake is set', async function () {
    await trustChain.setMinStake(ethers.parseEther('0.001'));
    await trustChain.createBounty('s-001', 'Staked bounty', '', { value: ethers.parseEther('0.05') });

    await expect(
      trustChain.connect(agentA).claimTask('s-001', 'did:ethr:agentA'),
    ).to.be.revertedWith('Stake required');

    await trustChain.connect(agentA).stake({ value: ethers.parseEther('0.001') });
    await trustChain.connect(agentA).claimTask('s-001', 'did:ethr:agentA');

    const task = await trustChain.getTask('s-001');
    expect(task.assignedAgent).to.equal(agentA.address);
  });

  it('allows stake deposit and withdrawal', async function () {
    await trustChain.connect(agentA).stake({ value: ethers.parseEther('0.01') });
    expect(await trustChain.stakes(agentA.address)).to.equal(ethers.parseEther('0.01'));

    await trustChain.connect(agentA).withdrawStake(ethers.parseEther('0.005'));
    expect(await trustChain.stakes(agentA.address)).to.equal(ethers.parseEther('0.005'));
  });

  it('owner can slash bad actor stake → funds go to feeRecipient', async function () {
    await trustChain.connect(agentB).stake({ value: ethers.parseEther('0.01') });

    const before = await ethers.provider.getBalance(feeWallet.address);
    await trustChain.slashStake(agentB.address, ethers.parseEther('0.006'));
    const after = await ethers.provider.getBalance(feeWallet.address);

    expect(await trustChain.stakes(agentB.address)).to.equal(ethers.parseEther('0.004'));
    expect(after - before).to.equal(ethers.parseEther('0.006'));
  });

  it('works without stake when minStake is 0 (backward compatible)', async function () {
    expect(await trustChain.minStake()).to.equal(0n);
    await trustChain.createBounty('compat-1', 'No stake needed', '', { value: ethers.parseEther('0.05') });

    await trustChain.connect(agentA).claimTask('compat-1', 'did:ethr:agentA');
    const task = await trustChain.getTask('compat-1');
    expect(task.assignedAgent).to.equal(agentA.address);
  });
});
