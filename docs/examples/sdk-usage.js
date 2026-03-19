/**
 * Agent Work Chain SDK 使用示例
 *
 * 演示两个 Agent 的完整协作流程：
 * Agent A（任务发布者）创建任务 → 分配给 Agent B
 * Agent B（任务执行者）完成任务 → Agent A 释放奖励
 *
 * 运行：node sdk-usage.js
 */

'use strict';

const path = require('path');
const { TrustChainAgent } = require(path.join(__dirname, '../../sdk/src'));

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
const TRUSTCHAIN_ADDRESS = process.env.TRUSTCHAIN_ADDRESS;

async function main() {
  if (!TRUSTCHAIN_ADDRESS) {
    console.error('Set TRUSTCHAIN_ADDRESS environment variable');
    process.exit(1);
  }

  const sdkConfig = {
    rpcUrl: RPC_URL,
    trustChainAddress: TRUSTCHAIN_ADDRESS,
    did: {
      registryAddress: '0xd1D374DDE031075157fDb64536eF5cC13Ae75000',
    },
    ipfs: {
      pinataJwt: process.env.PINATA_JWT,
      pinataGateway: process.env.PINATA_GATEWAY,
    },
  };

  // ========== Agent A: 任务发布者 ==========

  const agentA = new TrustChainAgent({
    ...sdkConfig,
    privateKey: process.env.AGENT_A_PRIVATE_KEY,
  });

  console.log('=== 协议手续费配置 ===');
  console.log(await agentA.getFeeConfig());
  console.log('0.01 ETH 手续费预估:', await agentA.estimateFee('0.01'));

  console.log('=== Agent A: 注册身份 ===');
  const didA = await agentA.register({
    capabilities: ['task-management'],
  });
  console.log(`Agent A DID: ${didA}`);

  console.log('\n=== Agent A: 创建任务 ===');
  const { taskId, inputCID } = await agentA.createTask({
    description: 'Summarize this research paper',
    inputData: {
      title: 'Attention Is All You Need',
      text: 'We propose a new simple network architecture...',
    },
    reward: '0.01',
  });
  console.log(`Task created: ${taskId}`);
  console.log(`Input pinned to IPFS: ${inputCID}`);

  // ========== Agent B: 任务执行者 ==========

  const agentB = new TrustChainAgent({
    ...sdkConfig,
    privateKey: process.env.AGENT_B_PRIVATE_KEY,
  });

  console.log('\n=== Agent B: 注册身份 ===');
  const didB = await agentB.register({
    capabilities: ['text-generation', 'summarization'],
  });
  console.log(`Agent B DID: ${didB}`);

  // Agent A 分配任务给 Agent B
  console.log('\n=== Agent A: 分配任务 ===');
  await agentA.assignTask(taskId, agentB.did, agentB.address);
  console.log(`Task assigned to ${agentB.address}`);

  // 查看任务状态
  const taskInProgress = await agentB.getTask(taskId);
  console.log(`Task status: ${taskInProgress.status}`);

  // Agent B 完成任务
  console.log('\n=== Agent B: 提交结果 ===');
  const { outputCID } = await agentB.submitResult(taskId, {
    summary: 'The paper introduces the Transformer model...',
    confidence: 0.95,
  });
  console.log(`Result pinned to IPFS: ${outputCID}`);

  // Agent A 确认并释放奖励
  console.log('\n=== Agent A: 释放奖励 ===');
  await agentA.releaseReward(taskId);

  const taskFinal = await agentA.getTask(taskId);
  console.log(`Final status: ${taskFinal.status}`);
  console.log(`Reward: ${taskFinal.reward} ETH`);

  console.log('\n=== 完成 ===');

  agentA.stopListening();
  agentB.stopListening();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
