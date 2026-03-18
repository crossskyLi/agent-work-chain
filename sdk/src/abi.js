'use strict';

const TRUST_CHAIN_ABI = [
  'constructor(address _arbitrator, bytes memory _arbitratorExtraData)',

  'function createTask(string taskId, string description, string inputCID) payable',
  'function assignTask(string taskId, string agentDID, address agentAddress)',
  'function completeTask(string taskId, string outputCID)',
  'function releaseReward(string taskId)',
  'function disputeTask(string taskId) payable',
  'function getTask(string taskId) view returns (tuple(string taskId, address creator, address assignedAgent, string assignedAgentDID, string description, string inputCID, string outputCID, uint256 reward, uint8 status, uint256 createdAt, uint256 completedAt))',
  'function arbitrator() view returns (address)',
  'function arbitratorExtraData() view returns (bytes)',
  'function disputeToTask(uint256) view returns (string)',

  'event TaskCreated(string taskId, address creator, uint256 reward)',
  'event TaskAssigned(string taskId, string agentDID, address agentAddress)',
  'event InputSubmitted(string taskId, string inputCID)',
  'event TaskCompleted(string taskId, string outputCID)',
  'event TaskDisputed(string taskId, uint256 disputeID)',
  'event RewardReleased(string taskId, address agent, uint256 amount)',
  'event RewardRefunded(string taskId, address creator, uint256 amount)',
  'event Ruling(address indexed _arbitrator, uint256 indexed _disputeID, uint256 _ruling)',
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
