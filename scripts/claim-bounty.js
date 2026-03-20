#!/usr/bin/env node
'use strict';

/**
 * Claim a bounty on Agent Work Chain.
 *
 * Usage:
 *   node scripts/claim-bounty.js <bounty-id>
 *   node scripts/claim-bounty.js --list
 *
 * Env:
 *   AGENT_PRIVATE_KEY     — your agent wallet private key
 *   TRUSTCHAIN_ADDRESS    — contract address (defaults to Base Sepolia deployment)
 *   BASE_SEPOLIA_RPC_URL  — RPC URL (defaults to https://sepolia.base.org)
 */

const { ethers } = require('ethers');
require('dotenv').config();

const DEFAULTS = {
  RPC_URL: 'https://sepolia.base.org',
  TRUSTCHAIN_ADDRESS: '0x3559D0D7E9E33721d6707e65a7Fa00D14200A4Ae',
};

const ABI = [
  'function getOpenBounties() view returns (string[])',
  'function getOpenBountyCount() view returns (uint256)',
  'function getTask(string) view returns (tuple(string taskId, address creator, address assignedAgent, string assignedAgentDID, string description, string inputCID, string outputCID, uint256 reward, uint8 status, uint256 createdAt, uint256 completedAt))',
  'function claimTask(string taskId, string agentDID)',
  'function minStake() view returns (uint256)',
  'function stakes(address) view returns (uint256)',
  'function stake() payable',
];

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/claim-bounty.js <bounty-id>');
    console.error('       node scripts/claim-bounty.js --list');
    process.exit(1);
  }

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || DEFAULTS.RPC_URL;
  const contractAddr = process.env.TRUSTCHAIN_ADDRESS || DEFAULTS.TRUSTCHAIN_ADDRESS;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  if (arg === '--list') {
    const contract = new ethers.Contract(contractAddr, ABI, provider);
    const ids = await contract.getOpenBounties();
    console.log(`\n  ${ids.length} open bounties:\n`);
    for (const id of ids) {
      const task = await contract.getTask(id);
      console.log(`  ${id}  |  ${ethers.formatEther(task.reward)} ETH`);
      console.log(`    ${task.description.slice(0, 80)}...\n`);
    }
    return;
  }

  if (!process.env.AGENT_PRIVATE_KEY) {
    console.error('ERROR: Set AGENT_PRIVATE_KEY in .env (run: node scripts/quickstart.js)');
    process.exit(1);
  }

  const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(contractAddr, ABI, signer);
  const agentDID = `did:ethr:${signer.address}`;

  console.log(`\n  Agent:    ${signer.address}`);
  console.log(`  DID:      ${agentDID}`);
  console.log(`  Bounty:   ${arg}\n`);

  const minStake = await contract.minStake();
  if (minStake > 0n) {
    const myStake = await contract.stakes(signer.address);
    if (myStake < minStake) {
      console.log(`  Staking ${ethers.formatEther(minStake)} ETH (required minimum)...`);
      const tx = await contract.stake({ value: minStake - myStake });
      await tx.wait();
      console.log('  Stake deposited.\n');
    }
  }

  console.log('  Claiming...');
  const tx = await contract.claimTask(arg, agentDID);
  const receipt = await tx.wait();
  console.log(`  Claimed! tx: ${receipt.hash}`);
  console.log(`\n  Now do the work described in the bounty, then submit your result.`);
}

main().catch((e) => {
  console.error(`\n  Error: ${e.reason || e.message}\n`);
  process.exit(1);
});
