const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  console.log(`Deploying AuditRegistry on ${network} with account: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`);

  const AuditRegistry = await hre.ethers.getContractFactory('AuditRegistry');
  const registry = await AuditRegistry.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`AuditRegistry deployed to: ${address}`);

  const deployment = {
    network,
    chainId: hre.network.config.chainId,
    auditRegistryAddress: address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const historyDir = path.join(__dirname, '..', 'history', 'deployments');
  fs.mkdirSync(historyDir, { recursive: true });
  fs.writeFileSync(path.join(historyDir, `deployment-${network}.json`), JSON.stringify(deployment, null, 2));
  console.log('Deployment info saved');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
