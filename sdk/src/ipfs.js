'use strict';

const crypto = require('crypto');

class IPFS {
  constructor({ pinataJwt, pinataGateway }) {
    this._jwt = pinataJwt;
    this._gateway = pinataGateway;
    this._pinata = null;
  }

  async _ensurePinata() {
    if (!this._pinata) {
      const { PinataSDK } = await import('pinata');
      this._pinata = new PinataSDK({
        pinataJwt: this._jwt,
        pinataGateway: this._gateway,
      });
    }
    return this._pinata;
  }

  async pin(data) {
    const pinata = await this._ensurePinata();
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], `data-${Date.now()}.json`, { type: 'application/json' });
    const result = await pinata.upload.file(file);
    return result.IpfsHash;
  }

  async get(cid) {
    const pinata = await this._ensurePinata();
    const result = await pinata.gateways.get(cid);
    return result.data;
  }

  async verify(cid, originalData) {
    const stored = await this.get(cid);
    const hash1 = crypto.createHash('sha256').update(JSON.stringify(stored)).digest('hex');
    const hash2 = crypto.createHash('sha256').update(JSON.stringify(originalData)).digest('hex');
    return hash1 === hash2;
  }
}

module.exports = { IPFS };
