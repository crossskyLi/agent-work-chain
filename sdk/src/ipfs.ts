import * as crypto from 'node:crypto';

export class IPFS {
  private _jwt: string;
  private _gateway: string;
  private _pinata: unknown;

  constructor({ pinataJwt, pinataGateway }: { pinataJwt: string; pinataGateway: string }) {
    this._jwt = pinataJwt;
    this._gateway = pinataGateway;
    this._pinata = null;
  }

  private async _ensurePinata() {
    if (!this._pinata) {
      const { PinataSDK } = await import('pinata');
      this._pinata = new PinataSDK({ pinataJwt: this._jwt, pinataGateway: this._gateway });
    }
    return this._pinata as {
      upload: { file: (f: File) => Promise<{ IpfsHash: string }> };
      gateways: { get: (cid: string) => Promise<{ data: unknown }> };
    };
  }

  async pin(data: unknown): Promise<string> {
    const pinata = await this._ensurePinata();
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], `data-${Date.now()}.json`, { type: 'application/json' });
    const result = await pinata.upload.file(file);
    return result.IpfsHash;
  }

  async get(cid: string): Promise<unknown> {
    const pinata = await this._ensurePinata();
    const result = await pinata.gateways.get(cid);
    return result.data;
  }

  async verify(cid: string, originalData: unknown): Promise<boolean> {
    const stored = await this.get(cid);
    const hash1 = crypto.createHash('sha256').update(JSON.stringify(stored)).digest('hex');
    const hash2 = crypto.createHash('sha256').update(JSON.stringify(originalData)).digest('hex');
    return hash1 === hash2;
  }
}
