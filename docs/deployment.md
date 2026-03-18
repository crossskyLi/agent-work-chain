# Deployment Guide

## Docker (Recommended)

### Prerequisites

- Docker >= 20.10
- Docker Compose >= 2.0

### Start the stack

```bash
# From the repository root
docker-compose -f docker/docker-compose.yml up -d
```

This starts:
- `api` — Node.js REST API on port 3000
- `mongodb` — MongoDB on port 27017

### Stop the stack

```bash
docker-compose -f docker/docker-compose.yml down
```

### View logs

```bash
docker-compose -f docker/docker-compose.yml logs -f api
```

---

## Local Development

### Backend

```bash
cd backend
npm install
npm run dev   # uses nodemon for hot reload
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
PORT=3000
JWT_SECRET=your-secret-key-here
BLOCKCHAIN_NETWORK=localhost
RPC_URL=http://localhost:8545
DATABASE_URL=mongodb://localhost:27017/agent-trustchain
NODE_ENV=development
```

---

## Production Deployment

### Environment Variables (required in production)

| Variable | Description |
|---|---|
| `PORT` | API server port (default: 3000) |
| `JWT_SECRET` | Secret for JWT signing — **must be changed** — generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `BLOCKCHAIN_NETWORK` | Target blockchain network |
| `RPC_URL` | Blockchain RPC endpoint |
| `DATABASE_URL` | MongoDB connection string |
| `NODE_ENV` | Set to `production` |

### Health Check

```bash
curl http://localhost:3000/health
```

### Smart Contract Deployment

Deploy contracts to your target network using Hardhat or Truffle:

```bash
npx hardhat run scripts/deploy.js --network mainnet
```

Update `backend/config/default.js` with deployed contract addresses.

---

## Python SDK Installation

```bash
cd agent-sdk/python
pip install -e .
```

Or from PyPI:

```bash
pip install agent-trustchain
```

## JavaScript SDK Installation

```bash
cd agent-sdk/javascript
npm install
```

Or from npm:

```bash
npm install agent-trustchain
```
