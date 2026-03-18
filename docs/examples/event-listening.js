/**
 * Agent 事件监听示例
 *
 * 展示 Agent 如何实时监听链上事件，实现自动化响应。
 * 例如：Agent 自动接受分配给自己的任务。
 *
 * 运行：node event-listening.js
 */

'use strict';

const path = require('path');
const { TrustChainAgent } = require(path.join(__dirname, '../../sdk/src'));

async function main() {
  const agent = new TrustChainAgent({
    privateKey: process.env.AGENT_PRIVATE_KEY,
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    trustChainAddress: process.env.TRUSTCHAIN_ADDRESS,
    ipfs: {
      pinataJwt: process.env.PINATA_JWT,
      pinataGateway: process.env.PINATA_GATEWAY,
    },
  });

  console.log(`Agent ${agent.address} listening for events...\n`);

  agent.on('TaskCreated', (event) => {
    const [taskId, creator, reward] = event.args;
    console.log(`[TaskCreated] Task ${taskId} by ${creator}, reward: ${reward}`);
  });

  agent.on('TaskAssigned', async (event) => {
    const [taskId, agentDID, agentAddress] = event.args;
    console.log(`[TaskAssigned] Task ${taskId} → ${agentDID}`);

    if (agentAddress === agent.address) {
      console.log(`  → This task is assigned to ME! Starting work...`);

      const task = await agent.getTask(taskId);
      console.log(`  → Description: ${task.description}`);

      if (task.inputCID) {
        const inputData = await agent.getData(task.inputCID);
        console.log(`  → Input data:`, inputData);
      }
    }
  });

  agent.on('TaskCompleted', (event) => {
    const [taskId, outputCID] = event.args;
    console.log(`[TaskCompleted] Task ${taskId}, output: ${outputCID}`);
  });

  agent.on('RewardReleased', (event) => {
    const [taskId, agentAddr, amount] = event.args;
    console.log(`[RewardReleased] Task ${taskId}, ${amount} → ${agentAddr}`);
  });

  agent.on('TaskDisputed', (event) => {
    const [taskId, disputeID] = event.args;
    console.log(`[TaskDisputed] Task ${taskId}, dispute #${disputeID}`);
  });

  console.log('Press Ctrl+C to stop.\n');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
