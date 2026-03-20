'use strict';

/**
 * Create the first batch of bounties on TrustChain.
 *
 * Usage:
 *   node scripts/create-first-bounties.js [--network local|sepolia]
 *
 * Env:
 *   TRUSTCHAIN_ADDRESS     — deployed contract address
 *   DEPLOYER_PRIVATE_KEY   — wallet with ETH to fund bounties
 *   BASE_SEPOLIA_RPC_URL   — RPC URL (default: https://sepolia.base.org)
 */

const { ethers } = require('ethers');
require('dotenv').config();

const ABI = [
  'function createBounty(string taskId, string description, string inputCID) payable',
  'function getOpenBounties() view returns (string[])',
  'function getOpenBountyCount() view returns (uint256)',
  'event BountyCreated(string taskId, address creator, uint256 reward)',
];

const BOUNTIES = [
  {
    id: 'bounty-security-review-001',
    description:
      'Security Review: Analyze TrustChain.sol for reentrancy, access control, and integer overflow vulnerabilities. ' +
      'Submit a structured report with severity ratings (Critical/High/Medium/Low) for each finding. ' +
      'Repository: https://github.com/anthropics/agent-work-chain — file: contracts/TrustChain.sol',
    reward: '0.00002',
  },
  {
    id: 'bounty-sdk-docs-001',
    description:
      'Documentation: Generate comprehensive API documentation for the Agent Work Chain SDK. ' +
      'Cover all public methods of TrustChainAgent class with parameter types, return values, and usage examples. ' +
      'Output format: Markdown. Repository: https://github.com/anthropics/agent-work-chain — file: sdk/src/agent.js',
    reward: '0.00002',
  },
  {
    id: 'bounty-translate-readme-ja-001',
    description:
      'Translation: Translate the Agent Work Chain README.md from English/Chinese to Japanese. ' +
      'Maintain all code blocks, links, and formatting. Submit the translated markdown content.',
    reward: '0.00001',
  },
  {
    id: 'bounty-test-bounty-board-001',
    description:
      'Testing: Write Hardhat test cases for the new Bounty Board functions (createBounty, claimTask, cancelBounty). ' +
      'Cover: happy path, double-claim prevention, non-bounty claim rejection, cancel refund. ' +
      'Output: JavaScript test file compatible with Hardhat + ethers v6.',
    reward: '0.00002',
  },
  {
    id: 'bounty-architecture-diagram-001',
    description:
      'Design: Create a Mermaid diagram showing the full Agent Work Chain trust flow — ' +
      'from DID registration through task creation, bounty claiming, result submission, ' +
      'reward release, and reputation attestation. Include all 5 trust layers.',
    reward: '0.00001',
  },
];

async function main() {
  const isLocal = process.argv.includes('--network') && process.argv.includes('local');
  const rpcUrl = isLocal
    ? 'http://127.0.0.1:8545'
    : process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

  const contractAddr = process.env.TRUSTCHAIN_ADDRESS;
  if (!contractAddr) {
    console.error('ERROR: Set TRUSTCHAIN_ADDRESS in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let signer;
  if (isLocal) {
    signer = await provider.getSigner(0);
  } else {
    if (!process.env.DEPLOYER_PRIVATE_KEY) {
      console.error('ERROR: Set DEPLOYER_PRIVATE_KEY in .env');
      process.exit(1);
    }
    signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  }

  const contract = new ethers.Contract(contractAddr, ABI, signer);
  const network = isLocal ? 'localhost' : 'Base Sepolia';

  console.log(`\n  Bounty Board — First Batch`);
  console.log(`  Network:  ${network}`);
  console.log(`  Contract: ${contractAddr}`);
  console.log(`  Creator:  ${signer.address || (await signer.getAddress())}`);
  console.log(`  Bounties:  ${BOUNTIES.length}\n`);

  const totalEth = BOUNTIES.reduce((sum, b) => sum + parseFloat(b.reward), 0);
  console.log(`  Total reward pool: ${totalEth} ETH\n`);

  for (const bounty of BOUNTIES) {
    try {
      const tx = await contract.createBounty(bounty.id, bounty.description, '', {
        value: ethers.parseEther(bounty.reward),
      });
      const receipt = await tx.wait();
      console.log(`  ✓ ${bounty.id}`);
      console.log(`    Reward: ${bounty.reward} ETH | tx: ${receipt.hash}\n`);
    } catch (e) {
      console.error(`  ✗ ${bounty.id}: ${e.message}\n`);
    }
  }

  const count = await contract.getOpenBountyCount();
  console.log(`\n  Open bounties on-chain: ${count}`);

  const ids = await contract.getOpenBounties();
  ids.forEach((id) => console.log(`    • ${id}`));

  console.log(`\n  Agents can discover these bounties via:`);
  console.log(`    1. MCP Server:  TRUSTCHAIN_ADDRESS=${contractAddr} node mcp/bounty-board-mcp.js`);
  console.log(`    2. Chain query: contract.getOpenBounties() on ${network}`);
  console.log(`    3. Indexer API: GET /v1/tasks?status=Created\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
