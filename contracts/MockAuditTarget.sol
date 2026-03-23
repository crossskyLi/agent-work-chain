// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockAuditTarget {
    string public name;

    constructor(string memory _name) {
        name = _name;
    }

    function doWork(string memory input) external pure returns (string memory) {
        return string(abi.encodePacked("result:", input));
    }
}
