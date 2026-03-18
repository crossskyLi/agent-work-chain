// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IArbitrable {
    function rule(uint256 _disputeID, uint256 _ruling) external;
}

contract MockArbitrator {
    uint256 public nextDisputeID;
    uint256 public fixedCost = 0.001 ether;

    mapping(uint256 => address) public disputeToArbitrable;

    function arbitrationCost(bytes calldata) external view returns (uint256) {
        return fixedCost;
    }

    function createDispute(uint256, bytes calldata) external payable returns (uint256 disputeID) {
        require(msg.value >= fixedCost, "Insufficient fee");
        disputeID = nextDisputeID++;
        disputeToArbitrable[disputeID] = msg.sender;
        return disputeID;
    }

    function giveRuling(uint256 _disputeID, uint256 _ruling) external {
        address arbitrable = disputeToArbitrable[_disputeID];
        require(arbitrable != address(0), "Dispute not found");
        IArbitrable(arbitrable).rule(_disputeID, _ruling);
    }
}
