// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DID {
    struct AgentIdentity {
        string did;
        address owner;
        string[] capabilities;
        uint256 createdAt;
        bool active;
    }

    mapping(string => AgentIdentity) public identities;
    mapping(address => string) public ownerToDID;

    event IdentityRegistered(string did, address owner);
    event IdentityUpdated(string did);
    event IdentityDeactivated(string did);

    function registerIdentity(string memory did, string[] memory capabilities) public {
        require(bytes(ownerToDID[msg.sender]).length == 0, "Owner already has a DID");
        require(bytes(identities[did].did).length == 0, "DID already registered");

        identities[did] = AgentIdentity({
            did: did,
            owner: msg.sender,
            capabilities: capabilities,
            createdAt: block.timestamp,
            active: true
        });
        ownerToDID[msg.sender] = did;

        emit IdentityRegistered(did, msg.sender);
    }

    function updateCapabilities(string memory did, string[] memory capabilities) public {
        require(identities[did].owner == msg.sender, "Not the DID owner");
        require(identities[did].active, "Identity is deactivated");

        identities[did].capabilities = capabilities;

        emit IdentityUpdated(did);
    }

    function deactivateIdentity(string memory did) public {
        require(identities[did].owner == msg.sender, "Not the DID owner");
        require(identities[did].active, "Already deactivated");

        identities[did].active = false;

        emit IdentityDeactivated(did);
    }

    function getIdentity(string memory did) public view returns (AgentIdentity memory) {
        require(bytes(identities[did].did).length > 0, "Identity not found");
        return identities[did];
    }
}
