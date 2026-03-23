# Deployment Guide — Audit Swarm

## Prerequisites

- Node.js 18+
- pnpm
- A Base Sepolia wallet with testnet ETH

## Local Development

```bash
# Terminal 1: Start local Hardhat node
pnpm hardhat:node

# Terminal 2: Deploy contracts
pnpm deploy:local

# Terminal 3: Start backend indexer
cd backend && pnpm dev

# Terminal 4: Start frontend
pnpm web:dev
```

## Deploy to Base Sepolia

```bash
# Set environment variables
export DEPLOYER_PRIVATE_KEY=0x...
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Deploy
pnpm deploy:base-sepolia
```

The deployment script saves the contract address to `history/deployments/deployment-base-sepolia.json`.

## Environment Variables

```env
# Required for deployment
DEPLOYER_PRIVATE_KEY=0x...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# Required for indexer
AUDIT_REGISTRY_ADDRESS=0x...
PORT=3000

# Required for frontend
NEXT_PUBLIC_API_BASE=http://localhost:3000
NEXT_PUBLIC_AUDIT_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org

# Optional: IPFS
PINATA_JWT=...
PINATA_GATEWAY=...
```

## MCP Server

```bash
AUDIT_INDEXER_BASE=http://localhost:3000 node mcp/audit-mcp-server.js
```
