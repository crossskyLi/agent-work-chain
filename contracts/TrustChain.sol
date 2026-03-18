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

    mapping(string => Task) public tasks;
    mapping(uint256 => string) public disputeToTask;

    event TaskCreated(string taskId, address creator, uint256 reward);
    event TaskAssigned(string taskId, string agentDID, address agentAddress);
    event InputSubmitted(string taskId, string inputCID);
    event TaskCompleted(string taskId, string outputCID);
    event TaskDisputed(string taskId, uint256 disputeID);
    event RewardReleased(string taskId, address agent, uint256 amount);
    event RewardRefunded(string taskId, address creator, uint256 amount);

    constructor(IArbitrator _arbitrator, bytes memory _arbitratorExtraData) {
        arbitrator = _arbitrator;
        arbitratorExtraData = _arbitratorExtraData;
    }

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

        uint256 amount = task.reward;
        address agent = task.assignedAgent;
        task.reward = 0;
        task.status = TaskStatus.Resolved;

        (bool sent,) = agent.call{value: amount}("");
        require(sent, "Transfer failed");

        emit RewardReleased(taskId, agent, amount);
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

        uint256 amount = task.reward;
        task.reward = 0;
        task.status = TaskStatus.Resolved;

        if (_ruling == 1) {
            (bool sent,) = task.assignedAgent.call{value: amount}("");
            require(sent, "Transfer failed");
            emit RewardReleased(taskId, task.assignedAgent, amount);
        } else {
            (bool sent,) = task.creator.call{value: amount}("");
            require(sent, "Refund failed");
            emit RewardRefunded(taskId, task.creator, amount);
        }

        emit Ruling(arbitrator, _disputeID, _ruling);
    }

    function getTask(string memory taskId) public view returns (Task memory) {
        require(bytes(tasks[taskId].taskId).length > 0, "Task not found");
        return tasks[taskId];
    }
}
