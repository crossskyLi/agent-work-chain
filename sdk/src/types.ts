export interface AuditReport {
  auditId: string;
  auditor: string;
  targetAgent: string;
  reportCID: string;
  overallScore: number;
  dimensions: Record<string, number>;
  status: 'Pending' | 'Confirmed' | 'Disputed';
  submittedAt: number;
}

export interface TrustScore {
  agent: string;
  avgScore: number;
  auditCount: number;
}

export interface AuditorInfo {
  address: string;
  specialties: string[];
  stake: string;
  totalAudits: number;
  accuracyScore: number;
  registeredAt: number;
}

export interface Certification {
  agent: string;
  certType: string;
  valid: boolean;
  issuedAt: number;
  validUntil: number;
}
