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

  const TrustChain = await hre.ethers.getContractFactory('TrustChain');
  const trustChain = await TrustChain.deploy(arbAddress, '0x00');
  await trustChain.waitForDeployment();
  const tcAddress = await trustChain.getAddress();
  console.log(`TrustChain deployed to: ${tcAddress}`);

  const deployment = {
    network: 'localhost',
    chainId: 31337,
    trustChainAddress: tcAddress,
    mockArbitratorAddress: arbAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, '..', 'deployment-localhost.json');
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment info saved to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
