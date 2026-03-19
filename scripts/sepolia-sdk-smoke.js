'use strict';

require('dotenv').config();
const path = require('path');
const { TrustChainAgent } = require(path.join(__dirname, '..', 'sdk', 'src'));

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  const trustChainAddress = requireEnv('TRUSTCHAIN_ADDRESS');
  const didRegistry = process.env.DID_REGISTRY_ADDRESS || '0xd1D374DDE031075157fDb64536eF5cC13Ae75000';

  const common = {
    rpcUrl,
    trustChainAddress,
    did: { registryAddress: didRegistry },
    ipfs: {
      pinataJwt: requireEnv('PINATA_JWT'),
      pinataGateway: requireEnv('PINATA_GATEWAY'),
    },
    eas: {
      contractAddress: process.env.EAS_CONTRACT_ADDRESS || '0x4200000000000000000000000000000000000021',
      schemaRegistryAddress: process.env.EAS_SCHEMA_REGISTRY_ADDRESS || '0x4200000000000000000000000000000000000020',
      schemaUID: process.env.EAS_SCHEMA_UID,
    },
  };

  const creator = new TrustChainAgent({
    ...common,
    privateKey: requireEnv('AGENT_A_PRIVATE_KEY'),
  });
  const worker = new TrustChainAgent({
    ...common,
    privateKey: requireEnv('AGENT_B_PRIVATE_KEY'),
  });

  console.log('--- Base Sepolia SDK Smoke Test ---');
  console.log(`Creator: ${creator.address}`);
  console.log(`Worker : ${worker.address}`);

  const feeConfig = await creator.getFeeConfig();
  console.log('Fee config:', feeConfig);
  console.log('Fee quote for 0.01 ETH:', await creator.estimateFee('0.01'));

  console.log('\n1) Register agents');
  await creator.register({ capabilities: ['task-publisher'] });
  await worker.register({ capabilities: ['summarization', 'text-generation'] });

  console.log('\n2) Create task');
  const created = await creator.createTask({
    description: 'Summarize the protocol note',
    inputData: {
      title: 'Protocol Note',
      content: 'Agent Work Chain enables trustable machine collaboration.',
    },
    reward: '0.001',
  });
  console.log(created);

  console.log('\n3) Assign task');
  await creator.assignTask(created.taskId, worker.did, worker.address);

  console.log('\n4) Submit result');
  const result = await worker.submitResult(created.taskId, {
    summary: 'Agent Work Chain provides DID identity, on-chain tasks, and verifiable settlement.',
    confidence: 0.96,
  });
  console.log(result);

  console.log('\n5) Release reward');
  const released = await creator.releaseReward(created.taskId);
  console.log(released);

  const finalTask = await creator.getTask(created.taskId);
  console.log('\nFinal task:', finalTask);
  console.log('\nSmoke test completed.');
}

main().catch((error) => {
  console.error('Smoke test failed:', error.message);
  process.exit(1);
});
