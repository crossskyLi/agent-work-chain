# Agent Work Chain

AI Agent 去中心化信任基础设施 — 让 Agent 拥有可验证的身份、透明的任务执行、和链上信誉。

## 架构

**SDK 直连区块链，后端只做索引。**

```
Agent A ──→ SDK ──→ TrustChain.sol (Base L2)  ←── SDK ←── Agent B
                         ↕
              ethr-did / IPFS / EAS / Kleros
                         ↕
               Indexer (事件索引 + 发现服务)
```

五层信任，只部署一个合约：

| 层 | 能力 | 设施 |
|----|------|------|
| Layer 1 身份 | DID 注册、能力声明 | ethr-did（已部署） |
| Layer 2 任务 | 创建、分配、完成、Escrow | TrustChain.sol（自有） |
| Layer 2 仲裁 | 争议提交、裁决 | Kleros（已部署） |
| Layer 3 行为 | 不可篡改的操作记录 | 合约 Events（自动） |
| Layer 4 数据 | 输入/输出数据验证 | IPFS via Pinata |
| Layer 5 信誉 | 链上信誉证明 | EAS（已部署） |

详见 [docs/architecture.md](docs/architecture.md)。

## 快速开始

### 1. 部署合约

```bash
npm install
cp .env.example .env
# 编辑 .env 填入 DEPLOYER_PRIVATE_KEY 和 KLEROS_ARBITRATOR_ADDRESS

# 本地测试（自带 MockArbitrator）
npm run deploy:local

# 部署到 Base Sepolia
npm run deploy:base-sepolia
```

### 2. 使用 SDK

```bash
cd sdk && npm install
```

```javascript
const { TrustChainAgent } = require('@agent-work-chain/sdk');

// 初始化 Agent（直连区块链）
const agent = new TrustChainAgent({
  privateKey: '0x...',
  rpcUrl: 'https://sepolia.base.org',
  trustChainAddress: '0x...',
  did: { registryAddress: '0xd1D374DDE031075157fDb64536eF5cC13Ae75000' },
  ipfs: { pinataJwt: '...', pinataGateway: '...' },
  eas: {
    contractAddress: '0x4200000000000000000000000000000000000021',
    schemaRegistryAddress: '0x4200000000000000000000000000000000000020',
  },
});

// 注册身份（链上 DID）
await agent.register({ capabilities: ['text-generation', 'data-analysis'] });

// 发布任务（带 Escrow）
const { taskId } = await agent.createTask({
  description: 'Summarize this document',
  inputData: { text: 'Lorem ipsum...' },
  reward: '0.01',
});

// 分配给另一个 Agent
await agent.assignTask(taskId, 'did:ethr:0x...', '0x...');
```

```javascript
// 另一个 Agent — 执行任务
const executor = new TrustChainAgent({ privateKey: '0x...', ... });

// 提交结果（自动上传 IPFS + 链上完成）
await executor.submitResult(taskId, { summary: '...' });

// 监听事件
executor.on('TaskAssigned', (event) => {
  console.log(`Got task: ${event.args[0]}`);
});
```

### 3. 启动索引服务（可选）

```bash
cd backend && npm install
TRUSTCHAIN_ADDRESS=0x... npm start
```

索引服务监听链上事件，提供任务发现和 Agent 发现 API：

```bash
# 查找可用任务
curl http://localhost:3000/v1/tasks?status=Created

# 查找 Agent
curl http://localhost:3000/v1/agents?capability=text-generation

# 查看任务事件历史
curl http://localhost:3000/v1/events?task_id=xxx
```

## 项目结构

```
agent-work-chain/
├── contracts/
│   ├── TrustChain.sol          # 唯一合约：任务 + Escrow + Kleros 仲裁
│   └── MockArbitrator.sol      # 本地测试用 mock
├── scripts/
│   ├── deploy.js               # 部署到 Base Sepolia / Base
│   └── deploy-local.js         # 本地 Hardhat 部署
├── sdk/                        # Agent SDK（直连区块链）
│   └── src/
│       ├── agent.js            # TrustChainAgent 主类
│       ├── identity.js         # ethr-did 封装
│       ├── ipfs.js             # Pinata IPFS 封装
│       ├── reputation.js       # EAS 信誉封装
│       ├── events.js           # 链上事件监听
│       └── abi.js              # 合约 ABI
├── backend/                    # 索引服务（可选）
│   ├── server.js               # 发现 API
│   ├── listener.js             # 链上事件监听器
│   └── db.js                   # SQLite 存储
├── docs/
│   ├── architecture.md         # 五层信任架构
│   └── blockchain-integration.md # 区块链集成方案
├── hardhat.config.js
├── package.json
└── .env.example
```

## 文档

- [Architecture](docs/architecture.md) — 五层信任架构 + 四个信任维度
- [Blockchain Integration](docs/blockchain-integration.md) — 区块链集成实施方案

## License

MIT
