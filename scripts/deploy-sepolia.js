const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log(`Deploying on ${network} with account: ${deployer.address}`);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error('Deployer has 0 balance — fund the wallet first');
  }

  // 1. Deploy MockArbitrator (no real Kleros on Base Sepolia)
  console.log('\n[1/2] Deploying MockArbitrator...');
  const MockArbitrator = await hre.ethers.getContractFactory('MockArbitrator');
  const mockArbitrator = await MockArbitrator.deploy();
  await mockArbitrator.waitForDeployment();
  const arbAddress = await mockArbitrator.getAddress();
  console.log(`MockArbitrator deployed to: ${arbAddress}`);

  // 2. Deploy TrustChain
  console.log('\n[2/2] Deploying TrustChain...');
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  const feeBps = Number(process.env.FEE_BPS || 10);
  const feeCapEth = process.env.FEE_CAP_ETH || '0.001';
  const feeCapWei = hre.ethers.parseEther(feeCapEth);

  const TrustChain = await hre.ethers.getContractFactory('TrustChain');
  const trustChain = await TrustChain.deploy(
    arbAddress,
    '0x00',
    feeRecipient,
    feeBps,
    feeCapWei,
  );
  await trustChain.waitForDeployment();
  const tcAddress = await trustChain.getAddress();
  console.log(`TrustChain deployed to: ${tcAddress}`);

  // Save deployment info
  const deployment = {
    network,
    chainId: hre.network.config.chainId,
    trustChainAddress: tcAddress,
    mockArbitratorAddress: arbAddress,
    feeConfig: { feeRecipient, feeBps, feeCapEth, feeCapWei: feeCapWei.toString() },
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const historyDir = path.join(__dirname, '..', 'history', 'deployments');
  fs.mkdirSync(historyDir, { recursive: true });
  const outPath = path.join(historyDir, `deployment-${network}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));

  console.log(`\nDeployment info saved to ${outPath}`);
  console.log('\n=== Summary ===');
  console.log(`  TrustChain:     ${tcAddress}`);
  console.log(`  MockArbitrator: ${arbAddress}`);
  console.log(`  Fee Recipient:  ${feeRecipient}`);
  console.log(`  Fee Rate:       ${feeBps / 100}%`);
  console.log(`  Explorer:       https://sepolia.basescan.org/address/${tcAddress}`);
  console.log('\nUpdate your .env:');
  console.log(`  TRUSTCHAIN_ADDRESS=${tcAddress}`);
  console.log(`  KLEROS_ARBITRATOR_ADDRESS=${arbAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
