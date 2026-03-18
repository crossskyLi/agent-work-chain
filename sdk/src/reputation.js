'use strict';

const { EAS, SchemaEncoder, SchemaRegistry } = require('@ethereum-attestation-service/eas-sdk');
const { ethers } = require('ethers');

const REPUTATION_SCHEMA =
  'string agentDID, uint8 completionRate, uint32 tasksCompleted, uint32 disputeWins, uint32 disputeLosses, uint32 score';

class Reputation {
  constructor({ signer, easContractAddress, easSchemaRegistryAddress, schemaUID }) {
    this._signer = signer;
    this._eas = new EAS(easContractAddress);
    this._eas.connect(signer);
    this._schemaRegistryAddress = easSchemaRegistryAddress;
    this._schemaUID = schemaUID;
    this._encoder = new SchemaEncoder(REPUTATION_SCHEMA);
  }

  async registerSchema() {
    const registry = new SchemaRegistry(this._schemaRegistryAddress);
    registry.connect(this._signer);
    const tx = await registry.register({
      schema: REPUTATION_SCHEMA,
      resolverAddress: ethers.ZeroAddress,
      revocable: true,
    });
    const receipt = await tx.wait();
    this._schemaUID = receipt;
    return this._schemaUID;
  }

  async attest({ agentDID, agentAddress, completionRate, tasksCompleted, disputeWins, disputeLosses, score }) {
    if (!this._schemaUID) {
      throw new Error('Schema UID not set. Call registerSchema() first or pass schemaUID in constructor.');
    }

    const data = this._encoder.encodeData([
      { name: 'agentDID', value: agentDID, type: 'string' },
      { name: 'completionRate', value: completionRate, type: 'uint8' },
      { name: 'tasksCompleted', value: tasksCompleted, type: 'uint32' },
      { name: 'disputeWins', value: disputeWins, type: 'uint32' },
      { name: 'disputeLosses', value: disputeLosses, type: 'uint32' },
      { name: 'score', value: score, type: 'uint32' },
    ]);

    const tx = await this._eas.attest({
      schema: this._schemaUID,
      data: {
        recipient: agentAddress,
        data,
        revocable: true,
        expirationTime: 0n,
      },
    });

    return await tx.wait();
  }

  async get(attestationUID) {
    const attestation = await this._eas.getAttestation(attestationUID);
    const decoded = this._encoder.decodeData(attestation.data);
    const result = {};
    for (const item of decoded) {
      result[item.name] = item.value;
    }
    result.recipient = attestation.recipient;
    result.attester = attestation.attester;
    result.time = attestation.time;
    return result;
  }
}

module.exports = { Reputation, REPUTATION_SCHEMA };
