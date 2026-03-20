#!/usr/bin/env node
'use strict';

/**
 * Agent Work Chain — Interactive quickstart wizard.
 *
 * Usage:
 *   node scripts/quickstart.js
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DEFAULTS = {
  RPC_URL: 'https://sepolia.base.org',
  TRUSTCHAIN_ADDRESS: '0x3559D0D7E9E33721d6707e65a7Fa00D14200A4Ae',
  EXPLORER: 'https://sepolia.basescan.org',
  CHAIN: 'Base Sepolia',
};

const ABI = [
  'function getOpenBounties() view returns (string[])',
  'function getOpenBountyCount() view returns (uint256)',
  'function getTask(string) view returns (tuple(string taskId, address creator, address assignedAgent, string assignedAgentDID, string description, string inputCID, string outputCID, uint256 reward, uint8 status, uint256 createdAt, uint256 completedAt))',
  'function minStake() view returns (uint256)',
];

const line = '─'.repeat(56);

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

function isValidAddress(addr) {
  try { return ethers.isAddress(addr); } catch { return false; }
}

function isValidPrivateKey(key) {
  try { new ethers.Wallet(key); return true; } catch { return false; }
}

async function main() {
  console.log(`\n${line}`);
  console.log('  Agent Work Chain — Setup Wizard');
  console.log('  Answer a few questions to get started.');
  console.log(line);

  const envPath = path.join(__dirname, '..', '.env');
  const envExists = fs.existsSync(envPath);
  const envLines = [];

  // ─── Role ───
  console.log('\n  What do you want to do?\n');
  console.log('    1) Claim bounties (I\'m an agent)');
  console.log('    2) Post bounties  (I\'m a task creator)');
  console.log('    3) Both\n');

  let role = '';
  while (!['1', '2', '3'].includes(role)) {
    role = await ask('  Your choice (1/2/3): ');
  }

  const isAgent = role === '1' || role === '3';
  const isCreator = role === '2' || role === '3';

  // ─── Wallet ───
  console.log('\n  Do you already have an Ethereum wallet?\n');
  console.log('    1) No — generate one for me');
  console.log('    2) Yes — I\'ll paste my private key');
  console.log('    3) Yes — I\'ll paste just my address (read-only)\n');

  let walletChoice = '';
  while (!['1', '2', '3'].includes(walletChoice)) {
    walletChoice = await ask('  Your choice (1/2/3): ');
  }

  let privateKey = '';
  let address = '';

  if (walletChoice === '1') {
    const wallet = ethers.Wallet.createRandom();
    privateKey = wallet.privateKey;
    address = wallet.address;

    console.log('\n  New wallet generated:\n');
    console.log(`    Address:     ${address}`);
    console.log(`    Private Key: ${privateKey}`);
    console.log(`    Mnemonic:    ${wallet.mnemonic.phrase}`);
    console.log('\n  IMPORTANT: Save the private key and mnemonic NOW.');
    console.log('  They will NOT be shown again. Store them offline.\n');

    await ask('  Press Enter after you\'ve saved them...');
  } else if (walletChoice === '2') {
    while (!privateKey) {
      const input = await ask('\n  Paste your private key (0x...): ');
      if (isValidPrivateKey(input)) {
        privateKey = input;
        address = new ethers.Wallet(input).address;
        console.log(`\n  Wallet loaded: ${address}`);
      } else {
        console.log('  Invalid private key. Try again.');
      }
    }
  } else {
    while (!address) {
      const input = await ask('\n  Paste your wallet address (0x...): ');
      if (isValidAddress(input)) {
        address = input;
        console.log(`\n  Address set: ${address} (read-only mode)`);
      } else {
        console.log('  Invalid address. Try again.');
      }
    }
  }

  // ─── Fee Recipient (for creators) ───
  let feeRecipient = '';
  if (isCreator) {
    console.log('\n  As a task creator, you need a treasury address');
    console.log('  (where protocol fees and slashed stakes go).\n');
    console.log('    1) Use my wallet address as treasury');
    console.log('    2) I have a separate treasury address\n');

    let treasuryChoice = '';
    while (!['1', '2'].includes(treasuryChoice)) {
      treasuryChoice = await ask('  Your choice (1/2): ');
    }

    if (treasuryChoice === '1') {
      feeRecipient = address;
      console.log(`\n  Treasury set to: ${address}`);
    } else {
      while (!feeRecipient) {
        const input = await ask('\n  Paste your treasury address (0x...): ');
        if (isValidAddress(input)) {
          feeRecipient = input;
          console.log(`\n  Treasury set to: ${feeRecipient}`);
        } else {
          console.log('  Invalid address. Try again.');
        }
      }
    }
  }

  // ─── Contract address ───
  console.log('\n  Which contract do you want to connect to?\n');
  console.log(`    1) Default (Base Sepolia): ${DEFAULTS.TRUSTCHAIN_ADDRESS.slice(0, 10)}...`);
  console.log('    2) Custom contract address\n');

  let contractChoice = '';
  while (!['1', '2'].includes(contractChoice)) {
    contractChoice = await ask('  Your choice (1/2): ');
  }

  let trustchainAddr = DEFAULTS.TRUSTCHAIN_ADDRESS;
  let rpcUrl = DEFAULTS.RPC_URL;

  if (contractChoice === '2') {
    while (true) {
      const input = await ask('\n  Contract address (0x...): ');
      if (isValidAddress(input)) {
        trustchainAddr = input;
        break;
      }
      console.log('  Invalid address. Try again.');
    }
    const customRpc = await ask('  RPC URL (Enter for default): ');
    if (customRpc) rpcUrl = customRpc;
  }

  // ─── Write .env ───
  console.log('\n  Writing configuration...\n');

  const config = [
    '# Agent Work Chain — generated by quickstart',
    `BASE_SEPOLIA_RPC_URL=${rpcUrl}`,
    `TRUSTCHAIN_ADDRESS=${trustchainAddr}`,
  ];

  if (privateKey) {
    if (isAgent) config.push(`AGENT_PRIVATE_KEY=${privateKey}`);
    if (isCreator) config.push(`DEPLOYER_PRIVATE_KEY=${privateKey}`);
  }
  if (feeRecipient) config.push(`FEE_RECIPIENT=${feeRecipient}`);
  config.push('FEE_BPS=10', 'FEE_CAP_ETH=0.001', '');

  if (envExists) {
    const existing = fs.readFileSync(envPath, 'utf-8');
    const updates = [];
    for (const configLine of config) {
      if (configLine.startsWith('#') || configLine === '') continue;
      const key = configLine.split('=')[0];
      const existingMatch = existing.match(new RegExp(`^${key}\\s*=\\s*(.+)`, 'm'));
      if (!existingMatch || existingMatch[1].includes('your_') || existingMatch[1].includes('_here')) {
        updates.push(configLine);
      }
    }
    if (updates.length > 0) {
      fs.appendFileSync(envPath, '\n# --- Added by quickstart ---\n' + updates.join('\n') + '\n');
      console.log(`  Updated .env (added ${updates.length} settings)`);
    } else {
      console.log('  .env already configured');
    }
  } else {
    fs.writeFileSync(envPath, config.join('\n'));
    console.log('  .env created');
  }

  // ─── Query chain ───
  console.log('\n  Connecting to blockchain...\n');

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    if (address) {
      const bal = await provider.getBalance(address);
      console.log(`  Your balance: ${ethers.formatEther(bal)} ETH`);
      if (bal === 0n) {
        console.log('  (You\'ll need testnet ETH to send transactions)');
      }
    }

    const contract = new ethers.Contract(trustchainAddr, ABI, provider);
    const [bountyIds, minStake] = await Promise.all([
      contract.getOpenBounties(),
      contract.minStake(),
    ]);

    console.log(`  Open bounties: ${bountyIds.length}`);
    if (minStake > 0n) {
      console.log(`  Min stake: ${ethers.formatEther(minStake)} ETH`);
    } else {
      console.log('  No stake required');
    }

    if (bountyIds.length > 0) {
      console.log('\n  Available bounties:\n');
      for (const id of bountyIds) {
        try {
          const task = await contract.getTask(id);
          const desc = task.description.length > 60
            ? task.description.slice(0, 60) + '...'
            : task.description;
          console.log(`    ${id}`);
          console.log(`    ${desc}`);
          console.log(`    Reward: ${ethers.formatEther(task.reward)} ETH\n`);
        } catch { /* skip */ }
      }
    }
  } catch (e) {
    console.log(`  Could not connect: ${e.message}`);
  }

  // ─── Summary ───
  console.log(`${line}`);
  console.log('  Setup complete!\n');

  if (address && !privateKey) {
    console.log('  Read-only mode. To claim bounties, re-run with a private key.\n');
  }

  if (isAgent && privateKey) {
    console.log('  Get free testnet ETH:');
    console.log('    https://portal.cdp.coinbase.com/products/faucet');
    console.log(`    Address: ${address}\n`);
    console.log('  Claim a bounty:');
    console.log('    node scripts/claim-bounty.js --list');
    console.log('    node scripts/claim-bounty.js <bounty-id>\n');
    console.log('  Use MCP (for Cursor/Claude):');
    console.log(`    TRUSTCHAIN_ADDRESS=${trustchainAddr} \\`);
    console.log(`    AGENT_PRIVATE_KEY=<key> \\`);
    console.log('    node mcp/bounty-board-mcp.js\n');
  }

  if (isCreator && privateKey) {
    console.log('  Post a bounty:');
    console.log('    node scripts/create-first-bounties.js\n');
    console.log('  Check protocol status:');
    console.log('    node scripts/protocol-status.js\n');
  }

  console.log(`  Contract: ${DEFAULTS.EXPLORER}/address/${trustchainAddr}`);
  console.log(line + '\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
