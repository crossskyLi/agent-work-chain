const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('TrustChain E2E Local Workflow', function () {
  it('simulates two agents completing a task with protocol fee cap', async function () {
    const [deployer, creator, agentRunner, feeWallet] = await ethers.getSigners();

    const MockArbitrator = await ethers.getContractFactory('MockArbitrator');
    const mockArb = await MockArbitrator.connect(deployer).deploy();
    await mockArb.waitForDeployment();

    const TrustChain = await ethers.getContractFactory('TrustChain');
    const feeBps = 10; // 0.1%
    const feeCapWei = ethers.parseEther('0.0005');
    const trust = await TrustChain.connect(deployer).deploy(
      await mockArb.getAddress(),
      '0x00',
      feeWallet.address,
      feeBps,
      feeCapWei
    );
    await trust.waitForDeployment();

    const taskId = 'task-local-e2e-001';
    const reward = ethers.parseEther('1.0');

    // 1) Creator creates task with escrow
    await trust.connect(creator).createTask(taskId, 'Summarize a document', 'QmInputHash', {
      value: reward,
    });

    // 2) Creator assigns task to agent
    await trust.connect(creator).assignTask(taskId, `did:ethr:${agentRunner.address}`, agentRunner.address);

    // 3) Agent completes task
    await trust.connect(agentRunner).completeTask(taskId, 'QmOutputHash');

    // 4) Creator releases reward
    const feeBefore = await ethers.provider.getBalance(feeWallet.address);
    const agentBefore = await ethers.provider.getBalance(agentRunner.address);

    const tx = await trust.connect(creator).releaseReward(taskId);
    await tx.wait();

    const feeAfter = await ethers.provider.getBalance(feeWallet.address);
    const agentAfter = await ethers.provider.getBalance(agentRunner.address);

    // fee should be min(1 ETH * 0.1%, cap) = min(0.001, 0.0005) = 0.0005 ETH
    const expectedFee = feeCapWei;
    const expectedAgentNet = reward - expectedFee;

    expect(feeAfter - feeBefore).to.equal(expectedFee);
    expect(agentAfter - agentBefore).to.equal(expectedAgentNet);

    // 5) Task should be resolved and escrow emptied
    const task = await trust.getTask(taskId);
    expect(Number(task.status)).to.equal(4); // Resolved
    expect(task.reward).to.equal(0n);
    expect(await ethers.provider.getBalance(await trust.getAddress())).to.equal(0n);

  });
});
