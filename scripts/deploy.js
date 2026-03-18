const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log(`Deploying TrustChain on ${network} with account: ${deployer.address}`);
  console.log(`Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`);

  const klerosAddress = process.env.KLEROS_ARBITRATOR_ADDRESS;
  if (!klerosAddress) {
    throw new Error('KLEROS_ARBITRATOR_ADDRESS not set in .env');
  }

  const extraData = '0x00';

  const TrustChain = await hre.ethers.getContractFactory('TrustChain');
  const trustChain = await TrustChain.deploy(klerosAddress, extraData);
  await trustChain.waitForDeployment();

  const address = await trustChain.getAddress();
  console.log(`TrustChain deployed to: ${address}`);

  const deployment = {
    network,
    chainId: hre.network.config.chainId,
    trustChainAddress: address,
    klerosArbitratorAddress: klerosAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const outPath = path.join(__dirname, '..', `deployment-${network}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment info saved to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
