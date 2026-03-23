import { ethers } from 'ethers';
import { AUDIT_REGISTRY_ABI } from './abi';
import type { TrustScore, AuditorInfo } from './types';

export class AuditWriter {
  private contract: ethers.Contract;

  constructor(contractAddress: string, signer: ethers.Signer) {
    this.contract = new ethers.Contract(contractAddress, [...AUDIT_REGISTRY_ABI], signer);
  }

  async registerAuditor(specialties: string, stakeEth: string): Promise<ethers.ContractTransactionResponse> {
    return this.contract.registerAuditor(specialties, {
      value: ethers.parseEther(stakeEth),
    });
  }

  async submitAudit(
    auditId: string,
    targetAgent: string,
    reportCID: string,
    overallScore: number,
    dimensions: Record<string, number>,
  ): Promise<ethers.ContractTransactionResponse> {
    if (!Number.isInteger(overallScore) || overallScore < 0 || overallScore > 100) {
      throw new RangeError('overallScore must be an integer between 0 and 100');
    }
    return this.contract.submitAudit(
      auditId,
      targetAgent,
      reportCID,
      overallScore,
      JSON.stringify(dimensions),
    );
  }

  async confirmAudit(auditId: string): Promise<ethers.ContractTransactionResponse> {
    return this.contract.confirmAudit(auditId);
  }

  async getTrustScore(agent: string): Promise<TrustScore> {
    const [avgScore, auditCount] = await this.contract.getTrustScore(agent);
    return { agent, avgScore: Number(avgScore), auditCount: Number(auditCount) };
  }

  async getAuditor(address: string): Promise<AuditorInfo> {
    const a = await this.contract.getAuditor(address);
    const spec = String(a.specialties ?? '');
    return {
      address,
      specialties: spec
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean),
      stake: ethers.formatEther(a.stake),
      totalAudits: Number(a.totalAudits),
      accuracyScore: Number(a.accuracyScore),
      registeredAt: Number(a.registeredAt),
    };
  }
}
