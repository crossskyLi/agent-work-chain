'use strict';

const { ethers } = require('ethers');
const { TRUST_CHAIN_ABI, TASK_STATUS } = require('./abi');
const { Identity } = require('./identity');
const { IPFS } = require('./ipfs');
const { Reputation } = require('./reputation');
const { Events } = require('./events');

class TrustChainAgent {
  /**
   * @param {Object} config
   * @param {string} config.privateKey - Agent wallet private key
   * @param {string} config.rpcUrl - RPC endpoint (e.g. https://sepolia.base.org)
   * @param {string} config.trustChainAddress - Deployed TrustChain contract address
   * @param {Object} [config.did] - DID configuration
   * @param {string} [config.did.registryAddress] - ERC-1056 registry address
   * @param {Object} [config.ipfs] - IPFS configuration
   * @param {string} [config.ipfs.pinataJwt] - Pinata JWT
   * @param {string} [config.ipfs.pinataGateway] - Pinata gateway domain
   * @param {Object} [config.eas] - EAS configuration
   * @param {string} [config.eas.contractAddress] - EAS contract address
   * @param {string} [config.eas.schemaRegistryAddress] - EAS schema registry
   * @param {string} [config.eas.schemaUID] - Pre-registered schema UID
   */
  constructor(config) {
    this._provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this._signer = new ethers.Wallet(config.privateKey, this._provider);
    this._contract = new ethers.Contract(config.trustChainAddress, TRUST_CHAIN_ABI, this._signer);
    this._events = new Events({ contract: this._contract });

    const chainId = config.chainId || 84532;

    if (config.did) {
      this._identity = new Identity({
        signer: this._signer,
        provider: this._provider,
        chainId,
        registryAddress: config.did.registryAddress,
      });
    }

    if (config.ipfs) {
      this._ipfs = new IPFS({
        pinataJwt: config.ipfs.pinataJwt,
        pinataGateway: config.ipfs.pinataGateway,
      });
    }

    if (config.eas) {
      this._reputation = new Reputation({
        signer: this._signer,
        easContractAddress: config.eas.contractAddress,
        easSchemaRegistryAddress: config.eas.schemaRegistryAddress,
        schemaUID: config.eas.schemaUID,
      });
    }
  }

  get address() {
    return this._signer.address;
  }

  get did() {
    return this._identity ? this._identity.did : `did:ethr:${this._signer.address}`;
  }

  get contract() {
    return this._contract;
  }

  // ========== Layer 1: Identity ==========

  async register({ capabilities = [] } = {}) {
    if (!this._identity) throw new Error('DID not configured. Pass did config to constructor.');
    return this._identity.register({ capabilities });
  }

  async resolveIdentity(did) {
    if (!this._identity) throw new Error('DID not configured.');
    return this._identity.resolve(did);
  }

  async updateCapabilities(capabilities) {
    if (!this._identity) throw new Error('DID not configured.');
    return this._identity.updateCapabilities(capabilities);
  }

  // ========== Staking ==========

  async stake(amountEth) {
    const tx = await this._contract.stake({
      value: ethers.parseEther(String(amountEth)),
    });
    const receipt = await tx.wait();
    return { transactionHash: receipt.hash };
  }

  async withdrawStake(amountEth) {
    const tx = await this._contract.withdrawStake(ethers.parseEther(String(amountEth)));
    const receipt = await tx.wait();
    return { transactionHash: receipt.hash };
  }

  async getStake(address) {
    const addr = address || this._signer.address;
    const wei = await this._contract.stakes(addr);
    return { address: addr, stakeWei: wei.toString(), stakeEth: ethers.formatEther(wei) };
  }

  async getMinStake() {
    const wei = await this._contract.minStake();
    return { minStakeWei: wei.toString(), minStakeEth: ethers.formatEther(wei) };
  }

  // ========== Layer 2: Tasks (Creator) ==========

  async createTask({ taskId, description, inputData, reward }) {
    const id = taskId || ethers.hexlify(ethers.randomBytes(16)).slice(2);
    let inputCID = '';

    if (inputData && this._ipfs) {
      inputCID = await this._ipfs.pin(inputData);
    }

    const tx = await this._contract.createTask(id, description, inputCID, {
      value: ethers.parseEther(String(reward)),
    });
    const receipt = await tx.wait();

    return { taskId: id, inputCID, transactionHash: receipt.hash };
  }

  async assignTask(taskId, agentDID, agentAddress) {
    const tx = await this._contract.assignTask(taskId, agentDID, agentAddress);
    const receipt = await tx.wait();
    return { transactionHash: receipt.hash };
  }

  // ========== Bounty Board (Creator) ==========

  async createBounty({ taskId, description, inputData, reward }) {
    const id = taskId || ethers.hexlify(ethers.randomBytes(16)).slice(2);
    let inputCID = '';

    if (inputData && this._ipfs) {
      inputCID = await this._ipfs.pin(inputData);
    }

    const tx = await this._contract.createBounty(id, description, inputCID, {
      value: ethers.parseEther(String(reward)),
    });
    const receipt = await tx.wait();

    return { taskId: id, inputCID, transactionHash: receipt.hash };
  }

  async cancelBounty(taskId) {
    const tx = await this._contract.cancelBounty(taskId);
    const receipt = await tx.wait();
    return { transactionHash: receipt.hash };
  }

  // ========== Bounty Board (Agent: competitive claiming) ==========

  async claimTask(taskId) {
    const tx = await this._contract.claimTask(taskId, this.did);
    const receipt = await tx.wait();
    return { transactionHash: receipt.hash };
  }

  async getOpenBounties() {
    return this._contract.getOpenBounties();
  }

  async getOpenBountyCount() {
    const count = await this._contract.getOpenBountyCount();
    return Number(count);
  }

  async isBounty(taskId) {
    return this._contract.isBounty(taskId);
  }

  async releaseReward(taskId) {
    const tx = await this._contract.releaseReward(taskId);
    const receipt = await tx.wait();
    return { transactionHash: receipt.hash };
  }

  async disputeTask(taskId) {
    const arbCost = await this._getArbitrationCost();
    const tx = await this._contract.disputeTask(taskId, { value: arbCost });
    const receipt = await tx.wait();
    return { transactionHash: receipt.hash };
  }

  // ========== Layer 2: Tasks (Executor) ==========

  async submitResult(taskId, resultData) {
    if (!this._ipfs) throw new Error('IPFS not configured. Pass ipfs config to constructor.');

    const outputCID = await this._ipfs.pin(resultData);
    const tx = await this._contract.completeTask(taskId, outputCID);
    const receipt = await tx.wait();

    return { outputCID, transactionHash: receipt.hash };
  }

  // ========== Layer 2: Tasks (Read) ==========

  async getTask(taskId) {
    const raw = await this._contract.getTask(taskId);
    return {
      taskId: raw.taskId,
      creator: raw.creator,
      assignedAgent: raw.assignedAgent,
      assignedAgentDID: raw.assignedAgentDID,
      description: raw.description,
      inputCID: raw.inputCID,
      outputCID: raw.outputCID,
      reward: ethers.formatEther(raw.reward),
      status: TASK_STATUS[Number(raw.status)] || 'Unknown',
      statusCode: Number(raw.status),
      createdAt: Number(raw.createdAt),
      completedAt: Number(raw.completedAt),
    };
  }

  // ========== Layer 3: Events ==========

  on(eventName, callback) {
    this._events.on(eventName, callback);
  }

  off(eventName, callback) {
    this._events.off(eventName, callback);
  }

  async queryEvents(eventName, fromBlock = 0) {
    return this._events.queryPast(eventName, fromBlock);
  }

  stopListening() {
    this._events.removeAll();
  }

  // ========== Layer 4: Data ==========

  async pinData(data) {
    if (!this._ipfs) throw new Error('IPFS not configured.');
    return this._ipfs.pin(data);
  }

  async getData(cid) {
    if (!this._ipfs) throw new Error('IPFS not configured.');
    return this._ipfs.get(cid);
  }

  async verifyData(cid, originalData) {
    if (!this._ipfs) throw new Error('IPFS not configured.');
    return this._ipfs.verify(cid, originalData);
  }

  // ========== Layer 5: Reputation ==========

  async attestReputation(opts) {
    if (!this._reputation) throw new Error('EAS not configured. Pass eas config to constructor.');
    return this._reputation.attest(opts);
  }

  async getReputation(attestationUID) {
    if (!this._reputation) throw new Error('EAS not configured.');
    return this._reputation.get(attestationUID);
  }

  async registerReputationSchema() {
    if (!this._reputation) throw new Error('EAS not configured.');
    return this._reputation.registerSchema();
  }

  // ========== Protocol Fee ==========

  async getFeeConfig() {
    const [recipient, bps, capWei] = await Promise.all([
      this._contract.feeRecipient(),
      this._contract.feeBps(),
      this._contract.feeCapWei(),
    ]);
    return {
      feeRecipient: recipient,
      feeBps: Number(bps),
      feeCapWei: capWei.toString(),
      feeCapEth: ethers.formatEther(capWei),
    };
  }

  async estimateFee(amountEth) {
    const amountWei = ethers.parseEther(String(amountEth));
    const feeWei = await this._contract.estimateFee(amountWei);
    return {
      amountEth: String(amountEth),
      feeWei: feeWei.toString(),
      feeEth: ethers.formatEther(feeWei),
      netEth: ethers.formatEther(amountWei - feeWei),
    };
  }

  // ========== Internal ==========

  async _getArbitrationCost() {
    const arbAddr = await this._contract.arbitrator();
    const arbContract = new ethers.Contract(
      arbAddr,
      ['function arbitrationCost(bytes) view returns (uint256)'],
      this._provider
    );
    const extraData = await this._contract.arbitratorExtraData();
    return arbContract.arbitrationCost(extraData);
  }
}

module.exports = { TrustChainAgent };
