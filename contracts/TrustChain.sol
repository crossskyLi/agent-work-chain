// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TrustChain {
    enum TaskStatus { Created, InProgress, Completed, Disputed, Cancelled }

    struct Task {
        string taskId;
        address creator;
        string assignedAgentDID;
        string description;
        uint256 reward;
        TaskStatus status;
        uint256 createdAt;
        uint256 completedAt;
    }

    mapping(string => Task) public tasks;

    event TaskCreated(string taskId, address creator, uint256 reward);
    event TaskAssigned(string taskId, string agentDID);
    event TaskCompleted(string taskId);
    event TaskDisputed(string taskId);

    function createTask(string memory taskId, string memory description) public payable {
        require(bytes(tasks[taskId].taskId).length == 0, "Task ID already exists");

        tasks[taskId] = Task({
            taskId: taskId,
            creator: msg.sender,
            assignedAgentDID: "",
            description: description,
            reward: msg.value,
            status: TaskStatus.Created,
            createdAt: block.timestamp,
            completedAt: 0
        });

        emit TaskCreated(taskId, msg.sender, msg.value);
    }

    function assignTask(string memory taskId, string memory agentDID) public {
        require(bytes(tasks[taskId].taskId).length > 0, "Task not found");
        require(tasks[taskId].creator == msg.sender, "Not the task creator");
        require(tasks[taskId].status == TaskStatus.Created, "Task not in Created state");

        tasks[taskId].assignedAgentDID = agentDID;
        tasks[taskId].status = TaskStatus.InProgress;

        emit TaskAssigned(taskId, agentDID);
    }

    function completeTask(string memory taskId) public {
        require(bytes(tasks[taskId].taskId).length > 0, "Task not found");
        require(tasks[taskId].status == TaskStatus.InProgress, "Task not in progress");

        tasks[taskId].status = TaskStatus.Completed;
        tasks[taskId].completedAt = block.timestamp;

        emit TaskCompleted(taskId);
    }

    function disputeTask(string memory taskId) public {
        require(bytes(tasks[taskId].taskId).length > 0, "Task not found");
        require(
            tasks[taskId].status == TaskStatus.InProgress ||
            tasks[taskId].status == TaskStatus.Completed,
            "Task cannot be disputed in current state"
        );

        tasks[taskId].status = TaskStatus.Disputed;

        emit TaskDisputed(taskId);
    }
}
