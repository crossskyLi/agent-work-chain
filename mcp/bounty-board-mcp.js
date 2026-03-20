#!/usr/bin/env node
'use strict';

/**
 * Agent Work Chain — Bounty Board MCP Server
 *
 * A stdio MCP server that lets AI agents discover, claim, and complete
 * on-chain bounties. Works directly with the TrustChain smart contract.
 *
 * Read-only mode (no private key): agents can browse open bounties.
 * Write mode (with AGENT_PRIVATE_KEY): agents can claim and submit results.
 *
 * Env vars:
 *   RPC_URL              — Chain RPC endpoint (default: Base Sepolia)
 *   TRUSTCHAIN_ADDRESS   — Deployed TrustChain contract address (required)
 *   AGENT_PRIVATE_KEY    — Agent wallet private key (optional, enables claiming)
 */

const readline = require('readline');
const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org';
const CONTRACT_ADDRESS = process.env.TRUSTCHAIN_ADDRESS;
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const CHAIN_NAME = process.env.CHAIN_NAME || 'Base Sepolia';

const ABI = [
  'function getOpenBounties() view returns (string[])',
  'function getOpenBountyCount() view returns (uint256)',
  'function isBounty(string taskId) view returns (bool)',
  'function getTask(string taskId) view returns (tuple(string taskId, address creator, address assignedAgent, string assignedAgentDID, string description, string inputCID, string outputCID, uint256 reward, uint8 status, uint256 createdAt, uint256 completedAt))',
  'function estimateFee(uint256 amount) view returns (uint256)',
  'function claimTask(string taskId, string agentDID)',
  'function completeTask(string taskId, string outputCID)',
  'function stake() payable',
  'function withdrawStake(uint256 amount)',
  'function minStake() view returns (uint256)',
  'function stakes(address) view returns (uint256)',
  'event BountyCreated(string taskId, address creator, uint256 reward)',
  'event TaskClaimed(string taskId, string agentDID, address agentAddress)',
];

const STATUS_MAP = ['Created', 'InProgress', 'Completed', 'Disputed', 'Resolved', 'Cancelled'];

let provider, contract, signer;

function init() {
  if (!CONTRACT_ADDRESS) {
    process.stderr.write('[bounty-board-mcp] ERROR: TRUSTCHAIN_ADDRESS env var is required\n');
    process.exit(1);
  }
  provider = new ethers.JsonRpcProvider(RPC_URL);
  if (AGENT_PRIVATE_KEY) {
    signer = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    process.stderr.write(`[bounty-board-mcp] Write mode: agent ${signer.address}\n`);
  } else {
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
    process.stderr.write('[bounty-board-mcp] Read-only mode (no AGENT_PRIVATE_KEY)\n');
  }
  process.stderr.write(`[bounty-board-mcp] Contract: ${CONTRACT_ADDRESS} on ${CHAIN_NAME}\n`);
}

function formatTask(raw) {
  return {
    taskId: raw.taskId,
    description: raw.description,
    reward: ethers.formatEther(raw.reward) + ' ETH',
    rewardWei: raw.reward.toString(),
    creator: raw.creator,
    assignedAgent: raw.assignedAgent,
    assignedAgentDID: raw.assignedAgentDID,
    inputCID: raw.inputCID,
    outputCID: raw.outputCID,
    status: STATUS_MAP[Number(raw.status)] || 'Unknown',
    createdAt: new Date(Number(raw.createdAt) * 1000).toISOString(),
    completedAt: Number(raw.completedAt) > 0
      ? new Date(Number(raw.completedAt) * 1000).toISOString()
      : null,
  };
}

// ─── Tool definitions ────────────────────────────────────────

const readTools = [
  {
    name: 'list_bounties',
    description:
      'List all open bounties available for claiming on Agent Work Chain. ' +
      'Returns bounty IDs, descriptions, rewards (in ETH), and creator addresses. ' +
      'First-come-first-served: claim fast before another agent does.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'bounty_details',
    description: 'Get full details of a specific bounty by task ID.',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string', description: 'The bounty task ID' } },
      required: ['task_id'],
    },
  },
  {
    name: 'bounty_count',
    description: 'Get the number of currently open bounties.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'staking_info',
    description:
      'Check staking requirements and your current stake. ' +
      'Agents must stake ETH before claiming bounties. Stake is refundable if you behave well.',
    inputSchema: {
      type: 'object',
      properties: { address: { type: 'string', description: 'Agent address to check (defaults to your own)' } },
    },
  },
];

const writeTools = [
  {
    name: 'deposit_stake',
    description:
      'Deposit ETH as a stake (refundable deposit) to participate in bounties. ' +
      'Required before you can claim any bounty. Shows commitment and filters spam.',
    inputSchema: {
      type: 'object',
      properties: {
        amount_eth: { type: 'string', description: 'Amount of ETH to stake (e.g. "0.001")' },
      },
      required: ['amount_eth'],
    },
  },
  {
    name: 'withdraw_stake',
    description: 'Withdraw your staked ETH. Only possible if you have no unresolved disputes.',
    inputSchema: {
      type: 'object',
      properties: {
        amount_eth: { type: 'string', description: 'Amount of ETH to withdraw (e.g. "0.001")' },
      },
      required: ['amount_eth'],
    },
  },
  {
    name: 'claim_bounty',
    description:
      'Claim an open bounty. First-come-first-served — once claimed, no other agent can take it. ' +
      'You must have staked the minimum required ETH before claiming. ' +
      'After claiming, complete the task described in the bounty and submit your result.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'The bounty task ID to claim' },
        agent_did: { type: 'string', description: 'Your agent DID (e.g. did:ethr:0x...)' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'submit_bounty_result',
    description:
      'Submit your completed work for a claimed bounty. ' +
      'Provide the IPFS CID of your output. The bounty creator will review and release payment.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'The bounty task ID you claimed' },
        output_cid: { type: 'string', description: 'IPFS CID of your result' },
      },
      required: ['task_id', 'output_cid'],
    },
  },
];

// ─── Tool handlers ───────────────────────────────────────────

async function handleTool(name, args) {
  switch (name) {
    case 'list_bounties': {
      const ids = await contract.getOpenBounties();
      if (ids.length === 0) {
        return { bounties: [], total: 0, message: 'No open bounties right now. Check back soon.' };
      }
      const bounties = await Promise.all(
        ids.map(async (id) => {
          const raw = await contract.getTask(id);
          return formatTask(raw);
        }),
      );
      return {
        bounties,
        total: bounties.length,
        chain: CHAIN_NAME,
        contract: CONTRACT_ADDRESS,
        note: 'Use claim_bounty to claim one. First-come-first-served!',
      };
    }

    case 'bounty_details': {
      const raw = await contract.getTask(args.task_id);
      const is = await contract.isBounty(args.task_id);
      return { ...formatTask(raw), isBounty: is, chain: CHAIN_NAME, contract: CONTRACT_ADDRESS };
    }

    case 'bounty_count': {
      const count = await contract.getOpenBountyCount();
      return { count: Number(count), chain: CHAIN_NAME };
    }

    case 'staking_info': {
      const min = await contract.minStake();
      const addr = args.address || (signer ? signer.address : null);
      const result = {
        minStake: ethers.formatEther(min) + ' ETH',
        minStakeWei: min.toString(),
        chain: CHAIN_NAME,
      };
      if (addr) {
        const s = await contract.stakes(addr);
        result.address = addr;
        result.currentStake = ethers.formatEther(s) + ' ETH';
        result.meetsMinimum = s >= min;
        if (s < min) {
          result.shortfall = ethers.formatEther(min - s) + ' ETH';
          result.action = 'Use deposit_stake to add funds before claiming bounties.';
        }
      }
      return result;
    }

    case 'deposit_stake': {
      if (!signer) {
        return { error: 'Write mode disabled. Set AGENT_PRIVATE_KEY to enable staking.' };
      }
      const tx = await contract.stake({ value: ethers.parseEther(args.amount_eth) });
      const receipt = await tx.wait();
      const newStake = await contract.stakes(signer.address);
      return {
        success: true,
        deposited: args.amount_eth + ' ETH',
        totalStake: ethers.formatEther(newStake) + ' ETH',
        agentAddress: signer.address,
        transactionHash: receipt.hash,
        message: 'Stake deposited. You can now claim bounties.',
      };
    }

    case 'withdraw_stake': {
      if (!signer) {
        return { error: 'Write mode disabled. Set AGENT_PRIVATE_KEY to enable withdrawal.' };
      }
      const tx = await contract.withdrawStake(ethers.parseEther(args.amount_eth));
      const receipt = await tx.wait();
      const remaining = await contract.stakes(signer.address);
      return {
        success: true,
        withdrawn: args.amount_eth + ' ETH',
        remainingStake: ethers.formatEther(remaining) + ' ETH',
        transactionHash: receipt.hash,
      };
    }

    case 'claim_bounty': {
      if (!signer) {
        return { error: 'Write mode disabled. Set AGENT_PRIVATE_KEY to enable claiming.' };
      }
      const did = args.agent_did || `did:ethr:${signer.address}`;
      const tx = await contract.claimTask(args.task_id, did);
      const receipt = await tx.wait();
      return {
        success: true,
        taskId: args.task_id,
        agentDID: did,
        agentAddress: signer.address,
        transactionHash: receipt.hash,
        message: 'Bounty claimed! Now complete the task and submit your result.',
      };
    }

    case 'submit_bounty_result': {
      if (!signer) {
        return { error: 'Write mode disabled. Set AGENT_PRIVATE_KEY to enable submission.' };
      }
      const tx = await contract.completeTask(args.task_id, args.output_cid);
      const receipt = await tx.wait();
      return {
        success: true,
        taskId: args.task_id,
        outputCID: args.output_cid,
        transactionHash: receipt.hash,
        message: 'Result submitted on-chain. The bounty creator will review and release payment.',
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── JSON-RPC stdio transport ────────────────────────────────

function ok(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function rpcError(id, message) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } });
}

init();

const allTools = AGENT_PRIVATE_KEY ? [...readTools, ...writeTools] : readTools;

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    process.stdout.write(rpcError(null, 'Invalid JSON') + '\n');
    return;
  }

  const { id, method, params } = msg;
  try {
    if (method === 'initialize') {
      process.stdout.write(
        ok(id, {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'agent-work-chain-bounty-board', version: '0.1.0' },
          capabilities: { tools: {} },
        }) + '\n',
      );
      return;
    }
    if (method === 'notifications/initialized') return;
    if (method === 'tools/list') {
      process.stdout.write(ok(id, { tools: allTools }) + '\n');
      return;
    }
    if (method === 'tools/call') {
      const result = await handleTool(params?.name, params?.arguments || {});
      process.stdout.write(
        ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }) + '\n',
      );
      return;
    }
    process.stdout.write(rpcError(id, `Unsupported method: ${method}`) + '\n');
  } catch (e) {
    process.stderr.write(`[bounty-board-mcp] Error: ${e.message}\n`);
    process.stdout.write(rpcError(id, e.message || 'Unknown error') + '\n');
  }
});
