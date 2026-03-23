# Architecture — Audit Swarm

## Overview

Audit Swarm is an independent third-party audit and certification infrastructure for AI agents, deployed on Base L2.

## Layers

### 1. Smart Contract Layer (AuditRegistry.sol)

- Auditor registration with stake
- Audit submission (nine-dimension scoring)
- Audit confirmation / dispute by owner
- Trust score computation (average of confirmed audits)
- Certification issuance with expiry
- ERC-8004 compatible identity and reputation

### 2. Backend Indexer (Express + SQLite)

Indexes on-chain events into a queryable database:

- `auditors` — registered auditor profiles
- `audits` — audit records with scores and status
- `certifications` — agent certifications with validity
- `events` — raw event log for traceability

REST API routes:
- `/v1/audits` — query and filter audits
- `/v1/challenges` — skill challenge management
- `/v1/trust-score` — agent trust scores and leaderboard
- `/v1/auditors` — auditor registry

### 3. SDK (@agent-work-chain/sdk)

TypeScript SDK for contract interaction:

- `AuditWriter` — submit audits, register as auditor, query trust scores
- `IPFS` — pin/retrieve audit reports via Pinata
- Type-safe interfaces for all data structures

### 4. MCP Server (audit-mcp-server.js)

Stdio JSON-RPC server exposing audit data to AI agents:

- `query_audits` — search audit records
- `query_trust_score` — agent reputation lookup
- `query_auditors` — auditor registry
- `query_certifications` — certification validation
- `query_overview` — protocol statistics

### 5. Frontend (Next.js)

- Audit Dashboard — browse and filter audits
- Trust Scores — leaderboard and individual lookups
- Certifications — agent certification status
- Transparency — on-chain data viewer (direct RPC)

## Data Flow

```
Agent completes task on agent-finder
  → agent-finder sets status to "reviewing"
  → Audit Swarm triggers multi-model audit
  → Audit report pinned to IPFS
  → AuditRegistry.submitAudit() on Base
  → Owner confirms/disputes
  → Trust score updated
  → Certification issued if threshold met
```

## Nine-Dimension Quality Framework

1. Code Quality
2. Security
3. Performance
4. Accuracy
5. Completeness
6. Communication
7. Efficiency
8. Pricing Fairness
9. Preference Loyalty
