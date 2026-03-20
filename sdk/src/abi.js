'use strict';

const TRUST_CHAIN_ABI = [
  'constructor(address _arbitrator, bytes _arbitratorExtraData, address _feeRecipient, uint16 _feeBps, uint256 _feeCapWei)',

  'function createTask(string taskId, string description, string inputCID) payable',
  'function assignTask(string taskId, string agentDID, address agentAddress)',
  'function completeTask(string taskId, string outputCID)',
  'function releaseReward(string taskId)',
  'function disputeTask(string taskId) payable',
  'function getTask(string taskId) view returns (tuple(string taskId, address creator, address assignedAgent, string assignedAgentDID, string description, string inputCID, string outputCID, uint256 reward, uint8 status, uint256 createdAt, uint256 completedAt))',
  'function arbitrator() view returns (address)',
  'function arbitratorExtraData() view returns (bytes)',
  'function disputeToTask(uint256) view returns (string)',
  'function owner() view returns (address)',
  'function feeRecipient() view returns (address)',
  'function feeBps() view returns (uint16)',
  'function feeCapWei() view returns (uint256)',
  'function estimateFee(uint256 amount) view returns (uint256)',
  'function setFeeConfig(address _feeRecipient, uint16 _feeBps, uint256 _feeCapWei)',

  // Bounty Board
  'function createBounty(string taskId, string description, string inputCID) payable',
  'function claimTask(string taskId, string agentDID)',
  'function cancelBounty(string taskId)',
  'function getOpenBounties() view returns (string[])',
  'function getOpenBountyCount() view returns (uint256)',
  'function isBounty(string taskId) view returns (bool)',

  // Agent Staking
  'function stake() payable',
  'function withdrawStake(uint256 amount)',
  'function slashStake(address agent, uint256 amount)',
  'function setMinStake(uint256 _minStake)',
  'function minStake() view returns (uint256)',
  'function stakes(address) view returns (uint256)',

  'event TaskCreated(string taskId, address creator, uint256 reward)',
  'event TaskAssigned(string taskId, string agentDID, address agentAddress)',
  'event InputSubmitted(string taskId, string inputCID)',
  'event TaskCompleted(string taskId, string outputCID)',
  'event TaskDisputed(string taskId, uint256 disputeID)',
  'event RewardReleased(string taskId, address agent, uint256 amount)',
  'event RewardRefunded(string taskId, address creator, uint256 amount)',
  'event FeeConfigUpdated(address feeRecipient, uint16 feeBps, uint256 feeCapWei)',
  'event FeeCharged(string taskId, address recipient, uint256 feeAmount)',
  'event Ruling(address indexed _arbitrator, uint256 indexed _disputeID, uint256 _ruling)',
  'event BountyCreated(string taskId, address creator, uint256 reward)',
  'event TaskClaimed(string taskId, string agentDID, address agentAddress)',
  'event BountyCancelled(string taskId, address creator, uint256 refund)',
  'event AgentStaked(address indexed agent, uint256 amount, uint256 total)',
  'event AgentWithdrew(address indexed agent, uint256 amount, uint256 remaining)',
  'event StakeSlashed(address indexed agent, uint256 slashed, uint256 remaining)',
  'event MinStakeUpdated(uint256 oldMin, uint256 newMin)',
];

const TASK_STATUS = {
  0: 'Created',
  1: 'InProgress',
  2: 'Completed',
  3: 'Disputed',
  4: 'Resolved',
  5: 'Cancelled',
};

module.exports = { TRUST_CHAIN_ABI, TASK_STATUS };
