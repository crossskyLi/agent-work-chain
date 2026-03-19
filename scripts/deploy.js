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
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  const feeBps = Number(process.env.FEE_BPS || 10); // default 0.1%
  const feeCapEth = process.env.FEE_CAP_ETH || '0.001';
  const feeCapWei = hre.ethers.parseEther(feeCapEth);

  if (feeBps < 0 || feeBps > 10_000) {
    throw new Error('FEE_BPS must be between 0 and 10000');
  }

  const TrustChain = await hre.ethers.getContractFactory('TrustChain');
  const trustChain = await TrustChain.deploy(
    klerosAddress,
    extraData,
    feeRecipient,
    feeBps,
    feeCapWei
  );
  await trustChain.waitForDeployment();

  const address = await trustChain.getAddress();
  console.log(`TrustChain deployed to: ${address}`);

  const deployment = {
    network,
    chainId: hre.network.config.chainId,
    trustChainAddress: address,
    klerosArbitratorAddress: klerosAddress,
    feeConfig: {
      feeRecipient,
      feeBps,
      feeCapEth,
      feeCapWei: feeCapWei.toString(),
    },
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const historyDir = path.join(__dirname, '..', 'history', 'deployments');
  fs.mkdirSync(historyDir, { recursive: true });
  const outPath = path.join(historyDir, `deployment-${network}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment info saved to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
