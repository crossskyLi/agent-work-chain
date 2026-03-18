# 部署指南

## 一、部署合约

### 前置条件

- Node.js >= 18
- 一个有 ETH 余额的钱包（用于支付部署 Gas）

### 本地部署（开发测试）

```bash
# 安装依赖
npm install

# 本地部署（自带 MockArbitrator，无需外部服务）
npm run deploy:local
```

部署信息保存在 `deployment-localhost.json`。

### 部署到 Base Sepolia（测试网）

```bash
# 复制环境变量模板
cp .env.example .env
```

编辑 `.env`，填入：
- `DEPLOYER_PRIVATE_KEY` — 部署钱包私钥
- `KLEROS_ARBITRATOR_ADDRESS` — Kleros 仲裁合约地址

```bash
npm run deploy:base-sepolia
```

部署信息保存在 `deployment-base-sepolia.json`。

### 部署到 Base 主网

```bash
npm run deploy:base
```

### 获取测试 ETH

Base Sepolia 测试网 ETH 可通过以下水龙头获取：
- https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- https://faucet.quicknode.com/base/sepolia

---

## 二、安装 SDK

```bash
cd sdk
npm install
```

SDK 可在任何 Node.js 项目中使用：

```javascript
const { TrustChainAgent } = require('@agent-work-chain/sdk');

const agent = new TrustChainAgent({
  privateKey: process.env.AGENT_PRIVATE_KEY,
  rpcUrl: 'https://sepolia.base.org',
  trustChainAddress: '0x...', // 从 deployment-*.json 获取
  did: {
    registryAddress: '0xd1D374DDE031075157fDb64536eF5cC13Ae75000',
  },
  ipfs: {
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY,
  },
  eas: {
    contractAddress: '0x4200000000000000000000000000000000000021',
    schemaRegistryAddress: '0x4200000000000000000000000000000000000020',
  },
});
```

---

## 三、启动索引服务（可选）

索引服务监听链上事件，提供任务发现和 Agent 发现 API。

```bash
cd backend
npm install
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | API 端口 | 3000 |
| `BASE_SEPOLIA_RPC_URL` | RPC 端点 | https://sepolia.base.org |
| `TRUSTCHAIN_ADDRESS` | 已部署的 TrustChain 地址 | **必填** |
| `DB_PATH` | SQLite 数据库路径 | ./indexer.db |

### 启动

```bash
TRUSTCHAIN_ADDRESS=0x... npm start
```

### 健康检查

```bash
curl http://localhost:3000/health
```

---

## 四、环境变量一览

```env
# 网络
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_RPC_URL=https://mainnet.base.org

# 密钥（不要提交到 Git）
DEPLOYER_PRIVATE_KEY=0x...
BACKEND_PRIVATE_KEY=0x...

# 合约地址（部署后填入）
TRUSTCHAIN_ADDRESS=0x...
KLEROS_ARBITRATOR_ADDRESS=0x...

# ERC-1056 DID Registry
DID_REGISTRY_ADDRESS=0xd1D374DDE031075157fDb64536eF5cC13Ae75000

# EAS (Base Sepolia)
EAS_CONTRACT_ADDRESS=0x4200000000000000000000000000000000000021
EAS_SCHEMA_REGISTRY_ADDRESS=0x4200000000000000000000000000000000000020
EAS_SCHEMA_UID=

# IPFS
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY=your-gateway.mypinata.cloud
```

---

## 五、架构说明

```
Agent ──→ SDK ──→ TrustChain.sol (Base L2)
                       ↕
            ethr-did / IPFS / EAS / Kleros

Indexer ← 监听链上事件 → SQLite → REST API（发现服务）
```

- **SDK 直连区块链**：所有业务操作（创建/完成/仲裁）通过 SDK 直接调用链上合约
- **索引服务可选**：仅提供搜索/发现能力，不参与业务逻辑
- **无数据库依赖**：链上即真相，索引服务使用 SQLite（可丢弃重建）
