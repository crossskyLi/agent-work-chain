// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Arbitration {
    enum DisputeStatus { Pending, InArbitration, Resolved, Rejected }

    struct Dispute {
        string disputeId;
        string taskId;
        address initiator;
        string reason;
        DisputeStatus status;
        address arbitrator;
        string resolution;
        uint256 createdAt;
    }

    mapping(string => Dispute) public disputes;
    mapping(address => bool) public certifiedArbitrators;

    address public owner;

    event DisputeSubmitted(string disputeId, string taskId);
    event DisputeResolved(string disputeId, string resolution);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    modifier onlyArbitrator() {
        require(certifiedArbitrators[msg.sender], "Not a certified arbitrator");
        _;
    }

    function submitDispute(
        string memory disputeId,
        string memory taskId,
        string memory reason
    ) public {
        require(bytes(disputes[disputeId].disputeId).length == 0, "Dispute ID already exists");

        disputes[disputeId] = Dispute({
            disputeId: disputeId,
            taskId: taskId,
            initiator: msg.sender,
            reason: reason,
            status: DisputeStatus.Pending,
            arbitrator: address(0),
            resolution: "",
            createdAt: block.timestamp
        });

        emit DisputeSubmitted(disputeId, taskId);
    }

    function resolveDispute(string memory disputeId, string memory resolution) public onlyArbitrator {
        require(bytes(disputes[disputeId].disputeId).length > 0, "Dispute not found");
        require(
            disputes[disputeId].status == DisputeStatus.Pending ||
            disputes[disputeId].status == DisputeStatus.InArbitration,
            "Dispute already resolved or rejected"
        );

        disputes[disputeId].status = DisputeStatus.Resolved;
        disputes[disputeId].resolution = resolution;
        disputes[disputeId].arbitrator = msg.sender;

        emit DisputeResolved(disputeId, resolution);
    }

    function certifyArbitrator(address arbitrator) public onlyOwner {
        certifiedArbitrators[arbitrator] = true;
    }

    function revokeArbitrator(address arbitrator) public onlyOwner {
        certifiedArbitrators[arbitrator] = false;
    }
}
