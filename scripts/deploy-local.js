const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying on local Hardhat network...');
  console.log(`Deployer: ${deployer.address}`);

  const AuditRegistry = await hre.ethers.getContractFactory('AuditRegistry');
  const registry = await AuditRegistry.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`AuditRegistry deployed to: ${address}`);

  const MockAuditTarget = await hre.ethers.getContractFactory('MockAuditTarget');
  const mockTarget = await MockAuditTarget.deploy('TestAgent');
  await mockTarget.waitForDeployment();
  console.log(`MockAuditTarget deployed to: ${await mockTarget.getAddress()}`);

  const deployment = {
    network: 'localhost',
    chainId: 31337,
    auditRegistryAddress: address,
    mockTargetAddress: await mockTarget.getAddress(),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const historyDir = path.join(__dirname, '..', 'history', 'deployments');
  fs.mkdirSync(historyDir, { recursive: true });
  fs.writeFileSync(path.join(historyDir, 'deployment-localhost.json'), JSON.stringify(deployment, null, 2));
  console.log('Deployment info saved');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
