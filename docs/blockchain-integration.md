# Blockchain Integration — Audit Swarm

## AuditRegistry Contract

Deployed on Base L2 (Sepolia testnet for development).

### Core Functions

#### Auditor Management
- `registerAuditor(string specialties)` payable — register with stake
- `getAuditor(address)` — query auditor profile
- `setMinStake(uint256)` — owner sets minimum stake

#### Audit Lifecycle
- `submitAudit(auditId, targetAgent, reportCID, overallScore, dimensions)` — submit audit
- `confirmAudit(auditId)` — owner confirms (updates trust score)
- `disputeAudit(auditId, reason)` — owner disputes

#### Trust & Certification
- `getTrustScore(address agent)` — average score from confirmed audits
- `issueCertification(agent, certType, validUntil)` — owner issues certification
- `getCertification(agent, certType)` — check certification validity

### Events

- `AuditorRegistered(address auditor, string specialties, uint256 stake)`
- `AuditSubmitted(string auditId, address auditor, address targetAgent, uint8 overallScore)`
- `AuditConfirmed(string auditId)`
- `AuditDisputeRaised(string auditId, string reason)`
- `CertificationIssued(address agent, string certType, uint256 validUntil)`

### ERC-8004 Compatibility

The AuditRegistry is designed to be compatible with ERC-8004 registries:
- Identity Registry: auditor registration maps to identity validation
- Reputation Registry: trust scores feed into reputation attestations
- Validation Registry: certifications align with validation records

## SDK Usage

```typescript
import { AuditWriter } from '@agent-work-chain/sdk';
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const writer = new AuditWriter(AUDIT_REGISTRY_ADDRESS, signer);

// Register as auditor
await writer.registerAuditor('code,security,performance', '0.01');

// Submit audit
await writer.submitAudit(
  'audit-001',
  TARGET_AGENT_ADDRESS,
  'QmReportCID',
  85,
  { code: 90, security: 80, performance: 85 },
);

// Query trust score
const score = await writer.getTrustScore(TARGET_AGENT_ADDRESS);
console.log(score); // { agent: '0x...', avgScore: 85, auditCount: 1 }
```
