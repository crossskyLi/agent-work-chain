const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer, arbitrator] = await hre.ethers.getSigners();

  console.log('Deploying on local Hardhat network...');
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Mock Arbitrator: ${arbitrator.address}`);

  const MockArbitrator = await hre.ethers.getContractFactory('MockArbitrator');
  const mockArbitrator = await MockArbitrator.deploy();
  await mockArbitrator.waitForDeployment();
  const arbAddress = await mockArbitrator.getAddress();
  console.log(`MockArbitrator deployed to: ${arbAddress}`);

  const feeRecipient = deployer.address;
  const feeBps = 10; // 0.1%
  const feeCapWei = hre.ethers.parseEther('0.001');

  const TrustChain = await hre.ethers.getContractFactory('TrustChain');
  const trustChain = await TrustChain.deploy(
    arbAddress,
    '0x00',
    feeRecipient,
    feeBps,
    feeCapWei
  );
  await trustChain.waitForDeployment();
  const tcAddress = await trustChain.getAddress();
  console.log(`TrustChain deployed to: ${tcAddress}`);

  const deployment = {
    network: 'localhost',
    chainId: 31337,
    trustChainAddress: tcAddress,
    mockArbitratorAddress: arbAddress,
    feeConfig: {
      feeRecipient,
      feeBps,
      feeCapWei: feeCapWei.toString(),
    },
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const historyDir = path.join(__dirname, '..', 'history', 'deployments');
  fs.mkdirSync(historyDir, { recursive: true });
  const outPath = path.join(historyDir, 'deployment-localhost.json');
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment info saved to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
