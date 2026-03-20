// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IArbitrator {
    function createDispute(uint256 _choices, bytes calldata _extraData) external payable returns (uint256 disputeID);
    function arbitrationCost(bytes calldata _extraData) external view returns (uint256 cost);
}

interface IArbitrable {
    event Ruling(IArbitrator indexed _arbitrator, uint256 indexed _disputeID, uint256 _ruling);
    function rule(uint256 _disputeID, uint256 _ruling) external;
}

contract TrustChain is IArbitrable {
    enum TaskStatus { Created, InProgress, Completed, Disputed, Resolved, Cancelled }

    struct Task {
        string taskId;
        address creator;
        address assignedAgent;
        string assignedAgentDID;
        string description;
        string inputCID;
        string outputCID;
        uint256 reward;
        TaskStatus status;
        uint256 createdAt;
        uint256 completedAt;
    }

    IArbitrator public arbitrator;
    bytes public arbitratorExtraData;
    address public owner;
    address public feeRecipient;
    uint16 public feeBps; // 0.1% = 10 bps
    uint256 public feeCapWei;

    mapping(string => Task) public tasks;
    mapping(uint256 => string) public disputeToTask;

    // --- Bounty Board: competitive claiming ---
    string[] private _openBountyIds;
    mapping(bytes32 => uint256) private _bountyIdx; // keccak256(taskId) => 1-based index

    // --- Agent Staking: sunk cost for serious participants ---
    uint256 public minStake;
    mapping(address => uint256) public stakes;

    event TaskCreated(string taskId, address creator, uint256 reward);
    event TaskAssigned(string taskId, string agentDID, address agentAddress);
    event InputSubmitted(string taskId, string inputCID);
    event TaskCompleted(string taskId, string outputCID);
    event TaskDisputed(string taskId, uint256 disputeID);
    event RewardReleased(string taskId, address agent, uint256 amount);
    event RewardRefunded(string taskId, address creator, uint256 amount);
    event FeeConfigUpdated(address feeRecipient, uint16 feeBps, uint256 feeCapWei);
    event FeeCharged(string taskId, address recipient, uint256 feeAmount);
    event BountyCreated(string taskId, address creator, uint256 reward);
    event TaskClaimed(string taskId, string agentDID, address agentAddress);
    event BountyCancelled(string taskId, address creator, uint256 refund);
    event AgentStaked(address indexed agent, uint256 amount, uint256 total);
    event AgentWithdrew(address indexed agent, uint256 amount, uint256 remaining);
    event StakeSlashed(address indexed agent, uint256 slashed, uint256 remaining);
    event MinStakeUpdated(uint256 oldMin, uint256 newMin);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        IArbitrator _arbitrator,
        bytes memory _arbitratorExtraData,
        address _feeRecipient,
        uint16 _feeBps,
        uint256 _feeCapWei
    ) {
        arbitrator = _arbitrator;
        arbitratorExtraData = _arbitratorExtraData;
        owner = msg.sender;
        _setFeeConfig(_feeRecipient, _feeBps, _feeCapWei);
    }

    function setFeeConfig(address _feeRecipient, uint16 _feeBps, uint256 _feeCapWei) external onlyOwner {
        _setFeeConfig(_feeRecipient, _feeBps, _feeCapWei);
    }

    function estimateFee(uint256 amount) public view returns (uint256) {
        return _calculateFee(amount);
    }

    // --- Agent Staking ---

    function setMinStake(uint256 _minStake) external onlyOwner {
        uint256 old = minStake;
        minStake = _minStake;
        emit MinStakeUpdated(old, _minStake);
    }

    function stake() external payable {
        require(msg.value > 0, "Must send ETH");
        stakes[msg.sender] += msg.value;
        emit AgentStaked(msg.sender, msg.value, stakes[msg.sender]);
    }

    function withdrawStake(uint256 amount) external {
        require(stakes[msg.sender] >= amount, "Insufficient stake");
        stakes[msg.sender] -= amount;
        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");
        emit AgentWithdrew(msg.sender, amount, stakes[msg.sender]);
    }

    function slashStake(address agent, uint256 amount) external onlyOwner {
        uint256 actual = amount > stakes[agent] ? stakes[agent] : amount;
        require(actual > 0, "Nothing to slash");
        stakes[agent] -= actual;
        (bool sent,) = feeRecipient.call{value: actual}("");
        require(sent, "Transfer failed");
        emit StakeSlashed(agent, actual, stakes[agent]);
    }

    // --- Tasks ---

    function createTask(
        string memory taskId,
        string memory description,
        string memory inputCID
    ) public payable {
        require(bytes(tasks[taskId].taskId).length == 0, "Task ID already exists");
        require(msg.value > 0, "Reward must be greater than 0");

        tasks[taskId] = Task({
            taskId: taskId,
            creator: msg.sender,
            assignedAgent: address(0),
            assignedAgentDID: "",
            description: description,
            inputCID: inputCID,
            outputCID: "",
            reward: msg.value,
            status: TaskStatus.Created,
            createdAt: block.timestamp,
            completedAt: 0
        });

        emit TaskCreated(taskId, msg.sender, msg.value);
        if (bytes(inputCID).length > 0) {
            emit InputSubmitted(taskId, inputCID);
        }
    }

    function assignTask(string memory taskId, string memory agentDID, address agentAddress) public {
        Task storage task = tasks[taskId];
        require(bytes(task.taskId).length > 0, "Task not found");
        require(task.creator == msg.sender, "Not the task creator");
        require(task.status == TaskStatus.Created, "Task not in Created state");
        require(agentAddress != address(0), "Invalid agent address");

        task.assignedAgentDID = agentDID;
        task.assignedAgent = agentAddress;
        task.status = TaskStatus.InProgress;

        emit TaskAssigned(taskId, agentDID, agentAddress);
    }

    function completeTask(string memory taskId, string memory outputCID) public {
        Task storage task = tasks[taskId];
        require(bytes(task.taskId).length > 0, "Task not found");
        require(task.status == TaskStatus.InProgress, "Task not in progress");
        require(task.assignedAgent == msg.sender, "Not the assigned agent");
        require(bytes(outputCID).length > 0, "Output CID required");

        task.outputCID = outputCID;
        task.status = TaskStatus.Completed;
        task.completedAt = block.timestamp;

        emit TaskCompleted(taskId, outputCID);
    }

    function releaseReward(string memory taskId) public {
        Task storage task = tasks[taskId];
        require(bytes(task.taskId).length > 0, "Task not found");
        require(task.creator == msg.sender, "Not the task creator");
        require(task.status == TaskStatus.Completed, "Task not completed");
        require(task.assignedAgent != address(0), "No assigned agent");

        uint256 amount = task.reward;
        address agent = task.assignedAgent;
        task.reward = 0;
        task.status = TaskStatus.Resolved;
        uint256 paid = _payoutWithFee(taskId, agent, amount);
        emit RewardReleased(taskId, agent, paid);
    }

    // --- Kleros 仲裁集成 (ERC-792) ---

    function disputeTask(string memory taskId) public payable {
        Task storage task = tasks[taskId];
        require(bytes(task.taskId).length > 0, "Task not found");
        require(
            task.status == TaskStatus.InProgress || task.status == TaskStatus.Completed,
            "Task cannot be disputed"
        );
        require(
            msg.sender == task.creator || msg.sender == task.assignedAgent,
            "Not a task participant"
        );

        uint256 arbitrationCost = arbitrator.arbitrationCost(arbitratorExtraData);
        require(msg.value >= arbitrationCost, "Insufficient arbitration fee");

        task.status = TaskStatus.Disputed;
        uint256 disputeID = arbitrator.createDispute{value: arbitrationCost}(2, arbitratorExtraData);
        disputeToTask[disputeID] = taskId;

        if (msg.value > arbitrationCost) {
            (bool sent,) = msg.sender.call{value: msg.value - arbitrationCost}("");
            require(sent, "Refund failed");
        }

        emit TaskDisputed(taskId, disputeID);
    }

    function rule(uint256 _disputeID, uint256 _ruling) external override {
        require(msg.sender == address(arbitrator), "Only arbitrator can rule");
        string memory taskId = disputeToTask[_disputeID];
        require(bytes(tasks[taskId].taskId).length > 0, "Dispute not linked to task");

        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Disputed, "Task not in dispute");
        require(_ruling == 1 || _ruling == 2, "Invalid ruling");

        uint256 amount = task.reward;
        task.reward = 0;
        task.status = TaskStatus.Resolved;

        if (_ruling == 1) {
            uint256 paid = _payoutWithFee(taskId, task.assignedAgent, amount);
            emit RewardReleased(taskId, task.assignedAgent, paid);
        } else {
            uint256 refunded = _payoutWithFee(taskId, task.creator, amount);
            emit RewardRefunded(taskId, task.creator, refunded);
        }

        emit Ruling(arbitrator, _disputeID, _ruling);
    }

    // --- Bounty Board: open bounties any agent can claim ---

    function createBounty(
        string memory taskId,
        string memory description,
        string memory inputCID
    ) public payable {
        createTask(taskId, description, inputCID);
        _openBountyIds.push(taskId);
        _bountyIdx[_bountyKey(taskId)] = _openBountyIds.length;
        emit BountyCreated(taskId, msg.sender, msg.value);
    }

    function claimTask(string memory taskId, string memory agentDID) public {
        require(minStake == 0 || stakes[msg.sender] >= minStake, "Stake required");

        bytes32 key = _bountyKey(taskId);
        require(_bountyIdx[key] > 0, "Not a bounty");

        Task storage task = tasks[taskId];
        require(bytes(task.taskId).length > 0, "Task not found");
        require(task.status == TaskStatus.Created, "Not available");

        task.assignedAgentDID = agentDID;
        task.assignedAgent = msg.sender;
        task.status = TaskStatus.InProgress;

        _removeBounty(key);
        emit TaskClaimed(taskId, agentDID, msg.sender);
    }

    function cancelBounty(string memory taskId) public {
        bytes32 key = _bountyKey(taskId);
        require(_bountyIdx[key] > 0, "Not a bounty");

        Task storage task = tasks[taskId];
        require(bytes(task.taskId).length > 0, "Task not found");
        require(task.creator == msg.sender, "Not creator");
        require(task.status == TaskStatus.Created, "Cannot cancel");

        uint256 amount = task.reward;
        task.reward = 0;
        task.status = TaskStatus.Cancelled;
        _removeBounty(key);

        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Refund failed");

        emit BountyCancelled(taskId, msg.sender, amount);
    }

    function getOpenBounties() public view returns (string[] memory) {
        return _openBountyIds;
    }

    function getOpenBountyCount() public view returns (uint256) {
        return _openBountyIds.length;
    }

    function isBounty(string memory taskId) public view returns (bool) {
        return _bountyIdx[_bountyKey(taskId)] > 0;
    }

    // --- Read ---

    function getTask(string memory taskId) public view returns (Task memory) {
        require(bytes(tasks[taskId].taskId).length > 0, "Task not found");
        return tasks[taskId];
    }

    function _setFeeConfig(address _feeRecipient, uint16 _feeBps, uint256 _feeCapWei) internal {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        require(_feeBps <= 10_000, "Fee bps too high");
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
        feeCapWei = _feeCapWei;
        emit FeeConfigUpdated(_feeRecipient, _feeBps, _feeCapWei);
    }

    function _calculateFee(uint256 amount) internal view returns (uint256) {
        if (feeBps == 0 || amount == 0) return 0;
        uint256 fee = (amount * feeBps) / 10_000;
        if (feeCapWei > 0 && fee > feeCapWei) {
            fee = feeCapWei;
        }
        if (fee > amount) {
            fee = amount;
        }
        return fee;
    }

    function _bountyKey(string memory taskId) internal pure returns (bytes32) {
        return keccak256(bytes(taskId));
    }

    function _removeBounty(bytes32 key) internal {
        uint256 idx = _bountyIdx[key] - 1;
        uint256 lastIdx = _openBountyIds.length - 1;

        if (idx != lastIdx) {
            string memory lastId = _openBountyIds[lastIdx];
            _openBountyIds[idx] = lastId;
            _bountyIdx[_bountyKey(lastId)] = idx + 1;
        }

        _openBountyIds.pop();
        delete _bountyIdx[key];
    }

    function _payoutWithFee(string memory taskId, address recipient, uint256 grossAmount) internal returns (uint256) {
        require(recipient != address(0), "Invalid recipient");

        uint256 feeAmount = _calculateFee(grossAmount);
        uint256 netAmount = grossAmount - feeAmount;

        if (feeAmount > 0) {
            (bool feeSent,) = feeRecipient.call{value: feeAmount}("");
            require(feeSent, "Fee transfer failed");
            emit FeeCharged(taskId, feeRecipient, feeAmount);
        }

        (bool sent,) = recipient.call{value: netAmount}("");
        require(sent, "Transfer failed");

        return netAmount;
    }
}
