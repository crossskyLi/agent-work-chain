# Audit Swarm

Independent third-party audit and certification infrastructure for AI agents on Base L2.

## What This Does

Audit Swarm is a protocol that provides verifiable trust infrastructure for the AI agent economy:

- **Multi-Model Audit Engine** — Nine-dimension quality assessment with multi-LLM consensus
- **On-Chain Trust Scores** — Verifiable reputation backed by audit evidence on Base blockchain
- **Skill Challenges** — Live capability verification through adversarial testing
- **ERC-8004 Compatible** — Pluggable identity, reputation, and validation registries

## Architecture

```
┌────────────────────────────────────────────────┐
│  Frontend (Next.js)                            │
│  Dashboard / Trust Scores / Certifications     │
└────────────────┬───────────────────────────────┘
                 │ REST API
┌────────────────▼───────────────────────────────┐
│  Backend Indexer (Express + SQLite)            │
│  Routes: /v1/audits, /trust-score, /challenges │
│  Services: audit, challenge, swarm             │
│  Listener: AuditRegistry events                │
└────────────────┬───────────────────────────────┘
                 │ ethers.js
┌────────────────▼───────────────────────────────┐
│  AuditRegistry.sol (Base L2)                   │
│  Auditor registration, audit submission,       │
│  confirmation/dispute, trust scores,           │
│  certifications                                │
└────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Compile contracts
pnpm compile

# Run contract tests
pnpm test:contracts

# Deploy locally
pnpm hardhat:node        # terminal 1
pnpm deploy:local        # terminal 2

# Start indexer
cd backend && pnpm dev   # terminal 3

# Start frontend
pnpm web:dev             # terminal 4
```

## Project Structure

```
contracts/          AuditRegistry.sol, MockAuditTarget.sol
backend/src/
  routes/           audit, challenge, trust-score, auditors
  services/         audit.service, challenge.service
  listener.ts       AuditRegistry event indexer
  db.ts             SQLite schema (auditors, audits, certifications)
sdk/src/
  abi.ts            AuditRegistry ABI
  audit-writer.ts   SDK for contract interaction
  ipfs.ts           IPFS/Pinata integration
  types.ts          TypeScript types
mcp/
  audit-mcp-server.js  MCP tools for AI agent queries
frontend-next/app/
  page.tsx           Landing page
  dashboard/         Audit dashboard
  trust-scores/      Agent trust score leaderboard
  certifications/    Certification lookup
  transparency/      On-chain data viewer
scripts/
  deploy.js          Deploy to Base Sepolia / mainnet
  deploy-local.js    Deploy to local Hardhat
test/
  audit-registry.test.js   Contract unit tests
  e2e-local.test.js        End-to-end local test
```

## Nine-Dimension Quality Framework

1. **Code Quality** — Structure, maintainability, best practices
2. **Security** — Vulnerability assessment, input validation
3. **Performance** — Latency, throughput, resource usage
4. **Accuracy** — Output correctness, factual reliability
5. **Completeness** — Requirement coverage, edge case handling
6. **Communication** — Response clarity, error messaging
7. **Efficiency** — Token/resource usage, cost optimization
8. **Pricing Fairness** — Billing transparency, competitive pricing
9. **Preference Loyalty** — User interest alignment, no manipulation

## Environment Variables

```env
# Blockchain
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
AUDIT_REGISTRY_ADDRESS=0x...
DEPLOYER_PRIVATE_KEY=0x...

# Backend
PORT=3000

# Frontend
NEXT_PUBLIC_API_BASE=http://localhost:3000
NEXT_PUBLIC_AUDIT_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_EXPLORER_URL=https://sepolia.basescan.org

# IPFS
PINATA_JWT=...
PINATA_GATEWAY=...
```

## Deploy to Base Sepolia

```bash
# Set env vars
export DEPLOYER_PRIVATE_KEY=0x...
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Deploy
pnpm deploy:base-sepolia
```

## MCP Server

For AI agent integration:

```bash
AUDIT_INDEXER_BASE=http://localhost:3000 node mcp/audit-mcp-server.js
```

Tools: `query_audits`, `query_trust_score`, `query_auditors`, `query_certifications`, `query_overview`

## License

MIT
