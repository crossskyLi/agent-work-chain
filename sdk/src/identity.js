'use strict';

const { EthrDID } = require('ethr-did');
const { Resolver } = require('did-resolver');
const { getResolver } = require('ethr-did-resolver');

class Identity {
  constructor({ signer, provider, chainId, registryAddress }) {
    this._signer = signer;
    this._provider = provider;
    this._chainId = chainId;
    this._registryAddress = registryAddress;
    this._ethrDid = null;
    this._resolver = null;
  }

  _ensureResolver() {
    if (!this._resolver) {
      this._resolver = new Resolver(
        getResolver({
          networks: [{
            name: `chain-${this._chainId}`,
            provider: this._provider,
            registry: this._registryAddress,
            chainId: this._chainId,
          }],
        })
      );
    }
    return this._resolver;
  }

  _ensureEthrDid() {
    if (!this._ethrDid) {
      this._ethrDid = new EthrDID({
        identifier: this._signer.address,
        provider: this._provider,
        chainNameOrId: this._chainId,
        registry: this._registryAddress,
        txSigner: this._signer,
      });
    }
    return this._ethrDid;
  }

  get did() {
    return `did:ethr:${this._signer.address}`;
  }

  async register({ capabilities = [] }) {
    const ethrDid = this._ensureEthrDid();
    const capStr = capabilities.join(',');
    if (capStr) {
      await ethrDid.setAttribute(
        'did/svc/AgentCapability',
        capStr,
        86400 * 365 * 10 // 10 years
      );
    }
    return this.did;
  }

  async resolve(did) {
    const resolver = this._ensureResolver();
    const result = await resolver.resolve(did);
    return result.didDocument;
  }

  async updateCapabilities(capabilities) {
    const ethrDid = this._ensureEthrDid();
    await ethrDid.setAttribute(
      'did/svc/AgentCapability',
      capabilities.join(','),
      86400 * 365 * 10
    );
  }

  async deactivate() {
    const ethrDid = this._ensureEthrDid();
    await ethrDid.revokeAttribute('did/svc/AgentCapability', '');
  }
}

module.exports = { Identity };
