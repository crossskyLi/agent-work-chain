'use strict';

/**
 * Protocol Transparency Dashboard
 *
 * Queries on-chain data and prints a full financial overview.
 *
 * Usage:
 *   node scripts/protocol-status.js [--network sepolia|base]
 *
 * Env:
 *   TRUSTCHAIN_ADDRESS   — deployed contract address
 *   BASE_SEPOLIA_RPC_URL — RPC endpoint (default: https://sepolia.base.org)
 */

const { ethers } = require('ethers');
require('dotenv').config();

const ABI = [
  'function owner() view returns (address)',
  'function feeRecipient() view returns (address)',
  'function feeBps() view returns (uint16)',
  'function feeCapWei() view returns (uint256)',
  'function minStake() view returns (uint256)',
  'function stakes(address) view returns (uint256)',
  'function getOpenBounties() view returns (string[])',
  'function getOpenBountyCount() view returns (uint256)',
  'function getTask(string taskId) view returns (tuple(string taskId, address creator, address assignedAgent, string assignedAgentDID, string description, string inputCID, string outputCID, uint256 reward, uint8 status, uint256 createdAt, uint256 completedAt))',
  'event BountyCreated(string taskId, address creator, uint256 reward)',
  'event TaskClaimed(string taskId, string agentDID, address agentAddress)',
  'event FeeCharged(string taskId, address recipient, uint256 feeAmount)',
  'event AgentStaked(address indexed agent, uint256 amount, uint256 total)',
  'event StakeSlashed(address indexed agent, uint256 slashed, uint256 remaining)',
  'event RewardReleased(string taskId, address agent, uint256 amount)',
];

async function main() {
  const isMainnet = process.argv.includes('base') && !process.argv.includes('sepolia');
  const rpcUrl = isMainnet
    ? process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    : process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  const networkName = isMainnet ? 'Base Mainnet' : 'Base Sepolia';
  const explorerBase = isMainnet
    ? 'https://basescan.org'
    : 'https://sepolia.basescan.org';

  const contractAddr = process.env.TRUSTCHAIN_ADDRESS;
  if (!contractAddr) {
    console.error('ERROR: Set TRUSTCHAIN_ADDRESS in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddr, ABI, provider);

  const [
    owner,
    feeRecipient,
    feeBps,
    feeCapWei,
    minStake,
    contractBalance,
    feeRecipientBalance,
    openBountyCount,
    openBountyIds,
  ] = await Promise.all([
    contract.owner(),
    contract.feeRecipient(),
    contract.feeBps(),
    contract.feeCapWei(),
    contract.minStake(),
    provider.getBalance(contractAddr),
    contract.feeRecipient().then((addr) => provider.getBalance(addr)),
    contract.getOpenBountyCount(),
    contract.getOpenBounties(),
  ]);

  let totalBountyPool = 0n;
  for (const id of openBountyIds) {
    try {
      const task = await contract.getTask(id);
      totalBountyPool += task.reward;
    } catch { /* skip */ }
  }

  const feeEvents = await contract.queryFilter(contract.filters.FeeCharged());
  let totalFeesCollected = 0n;
  for (const ev of feeEvents) {
    totalFeesCollected += ev.args[2];
  }

  const stakeEvents = await contract.queryFilter(contract.filters.AgentStaked());
  const uniqueStakers = new Set(stakeEvents.map((e) => e.args[0]));

  const rewardEvents = await contract.queryFilter(contract.filters.RewardReleased());
  let totalRewardsPaid = 0n;
  for (const ev of rewardEvents) {
    totalRewardsPaid += ev.args[2];
  }

  const slashEvents = await contract.queryFilter(contract.filters.StakeSlashed());
  let totalSlashed = 0n;
  for (const ev of slashEvents) {
    totalSlashed += ev.args[1];
  }

  const line = '─'.repeat(60);

  console.log(`\n${line}`);
  console.log(`  Agent Work Chain — Protocol Transparency`);
  console.log(`  Network: ${networkName}`);
  console.log(`  Queried: ${new Date().toISOString()}`);
  console.log(line);

  console.log(`\n  Contract`);
  console.log(`    Address:      ${contractAddr}`);
  console.log(`    Explorer:     ${explorerBase}/address/${contractAddr}`);
  console.log(`    Balance:      ${ethers.formatEther(contractBalance)} ETH`);
  console.log(`    Owner:        ${owner}`);

  console.log(`\n  Treasury (Fee Recipient)`);
  console.log(`    Address:      ${feeRecipient}`);
  console.log(`    Explorer:     ${explorerBase}/address/${feeRecipient}`);
  console.log(`    Balance:      ${ethers.formatEther(feeRecipientBalance)} ETH`);

  console.log(`\n  Fee Configuration`);
  console.log(`    Fee Rate:     ${Number(feeBps) / 100}%  (${feeBps} bps)`);
  console.log(`    Fee Cap:      ${ethers.formatEther(feeCapWei)} ETH`);

  console.log(`\n  Staking`);
  console.log(`    Min Stake:    ${ethers.formatEther(minStake)} ETH`);
  console.log(`    Unique Stakers (all-time): ${uniqueStakers.size}`);

  console.log(`\n  Bounty Board`);
  console.log(`    Open Bounties: ${openBountyCount}`);
  console.log(`    Total Pool:    ${ethers.formatEther(totalBountyPool)} ETH`);

  console.log(`\n  Cumulative Stats`);
  console.log(`    Rewards Paid:  ${ethers.formatEther(totalRewardsPaid)} ETH`);
  console.log(`    Fees Collected: ${ethers.formatEther(totalFeesCollected)} ETH`);
  console.log(`    Stakes Slashed: ${ethers.formatEther(totalSlashed)} ETH`);

  console.log(`\n${line}`);
  console.log(`  All data is read directly from on-chain state.`);
  console.log(`  Verify yourself: ${explorerBase}/address/${contractAddr}`);
  console.log(`${line}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
