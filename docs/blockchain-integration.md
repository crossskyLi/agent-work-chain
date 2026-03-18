# 区块链集成实施方案（混合方案）

## 设计原则

**核心业务自己掌控，通用能力借力已有设施。**

- 任务生命周期是项目的核心差异化逻辑 → 保留 `TrustChain.sol`，自己部署
- 身份、仲裁、数据验证、信誉 → 全部使用已部署的协议，零合约开发

---

## 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                       自有合约（1个）                          │
│                                                              │
│  TrustChain.sol  →  任务生命周期 + 资金托管 + Kleros 仲裁接口  │
│  部署方式: Hardhat → Base Sepolia (测试) → Base (生产)         │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                     现有设施（零部署）                          │
│                                                              │
│  Layer 1 身份    →  ethr-did (ERC-1056 Registry)             │
│  Layer 2 仲裁    →  Kleros (ERC-792，TrustChain 实现接口)     │
│  Layer 3 行为    →  TrustChain Events 自动产生                │
│  Layer 4 数据    →  IPFS (Pinata) + 链上 CID                 │
│  Layer 5 信誉    →  EAS (Ethereum Attestation Service)       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 一、Layer 1: 身份 — ethr-did（无需部署合约）

ERC-1056 Ethereum DID Registry 已部署在以太坊主网、Sepolia、Base 等所有主流网络。

**替换关系：**

| 已删除的 DID.sol 方法 | 替换为 |
|----------------------|--------|
| `registerIdentity()` | `ethr-did` 的 `setAttribute()` |
| `updateCapabilities()` | `ethr-did` 的 `setAttribute()` |
| `deactivateIdentity()` | `ethr-did` 的 `revokeAttribute()` |
| `getIdentity()` | `ethr-did-resolver` 链上事件查询 |

**npm 依赖：**
```bash
npm install ethr-did ethr-did-resolver did-resolver ethers
```

**后端集成：**
```javascript
const { EthrDID } = require('ethr-did');
const { Resolver } = require('did-resolver');
const { getResolver } = require('ethr-did-resolver');

const keypair = EthrDID.createKeyPair();
const ethrDid = new EthrDID({
  identifier: keypair.address,
  privateKey: keypair.privateKey,
  provider,
  chainNameOrId: 'base-sepolia',
  registry: '0xd1D374DDE031075157fDb64536eF5cC13Ae75000'
});

await ethrDid.setAttribute('did/svc/AgentCapability', 'text-generation,data-analysis');

const resolver = new Resolver(getResolver({ provider, registry, chainId: 84532 }));
const doc = await resolver.resolve(ethrDid.did);
```

---

## 二、Layer 2: 任务合约 — TrustChain.sol（自有合约）

### 合约能力

`TrustChain.sol` 是项目唯一需要部署的合约，集成了三个职责：

| 职责 | 实现方式 |
|------|---------|
| 任务状态机 | `Created → InProgress → Completed → Resolved` |
| 资金托管 | 创建任务时 `msg.value` 锁入合约，完成/裁决后释放 |
| 仲裁接口 | 实现 ERC-792 `IArbitrable`，争议自动提交 Kleros |
| 数据锚定 | `inputCID` / `outputCID` 字段存储 IPFS 哈希 |

### 状态流转

```
Created ──[assignTask]──→ InProgress ──[completeTask]──→ Completed ──[releaseReward]──→ Resolved
                              │                              │
                              └──────[disputeTask]───────────→ Disputed ──[Kleros rule()]──→ Resolved
```

### Kleros 仲裁集成（ERC-792）

**已删除** `Arbitration.sol`，仲裁逻辑直接由 Kleros 处理：

1. 任一参与方调用 `disputeTask()` 并支付仲裁费
2. 合约自动在 Kleros 创建争议（`arbitrator.createDispute()`）
3. Kleros 陪审团审理、投票
4. Kleros 调用合约的 `rule()` 回调：
   - `ruling == 1`：Agent 胜诉 → 奖励释放给 Agent
   - `ruling == 2`：Creator 胜诉 → 奖励退还给 Creator

**Kleros 合约地址 (Base Sepolia)：** 部署时从 [Kleros 文档](https://docs.kleros.io/) 获取。

### 部署

**工具链：**
```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
```

**`hardhat.config.js`：**
```javascript
require('@nomicfoundation/hardhat-toolbox');

module.exports = {
  solidity: '0.8.20',
  networks: {
    'base-sepolia': {
      url: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 84532,
    },
  },
};
```

**部署脚本 `scripts/deploy.js`：**
```javascript
const hre = require('hardhat');

async function main() {
  const klerosAddress = process.env.KLEROS_ARBITRATOR_ADDRESS;
  const extraData = '0x00';

  const TrustChain = await hre.ethers.getContractFactory('TrustChain');
  const trustChain = await TrustChain.deploy(klerosAddress, extraData);
  await trustChain.waitForDeployment();

  console.log('TrustChain deployed to:', await trustChain.getAddress());
}

main().catch(console.error);
```

**后端调用：**
```javascript
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
const signer = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);
const trustChain = new ethers.Contract(TRUSTCHAIN_ADDRESS, TRUSTCHAIN_ABI, signer);

// 创建任务（带 Escrow + IPFS CID）
await trustChain.createTask(taskId, description, inputCID, {
  value: ethers.parseEther('0.01'),
});

// 分配任务
await trustChain.assignTask(taskId, agentDID, agentAddress);

// Agent 提交结果
await trustChain.completeTask(taskId, outputCID);

// Creator 确认并释放奖励
await trustChain.releaseReward(taskId);

// 发起争议（支付 Kleros 仲裁费）
const arbCost = await trustChain.arbitrator().arbitrationCost('0x00');
await trustChain.disputeTask(taskId, { value: arbCost });
```

---

## 三、Layer 3: 行为记录 — 合约 Events（自动覆盖）

`TrustChain.sol` 中定义的 Events 在每次状态变更时自动上链：

| Event | 触发时机 |
|-------|---------|
| `TaskCreated(taskId, creator, reward)` | 创建任务 |
| `TaskAssigned(taskId, agentDID, agentAddress)` | 分配 Agent |
| `InputSubmitted(taskId, inputCID)` | 提交输入数据 |
| `TaskCompleted(taskId, outputCID)` | Agent 完成任务 |
| `TaskDisputed(taskId, disputeID)` | 发起争议 |
| `RewardReleased(taskId, agent, amount)` | 奖励释放 |
| `RewardRefunded(taskId, creator, amount)` | 奖励退还 |
| `Ruling(arbitrator, disputeID, ruling)` | Kleros 裁决 |

**查询历史：**
```javascript
const events = await trustChain.queryFilter(trustChain.filters.TaskCreated());

// 查询特定任务的所有事件
const allEvents = await Promise.all([
  trustChain.queryFilter(trustChain.filters.TaskCreated(taskId)),
  trustChain.queryFilter(trustChain.filters.TaskAssigned(taskId)),
  trustChain.queryFilter(trustChain.filters.TaskCompleted(taskId)),
]);
```

---

## 四、Layer 4: 数据验证 — IPFS via Pinata（SaaS）

**npm 依赖：**
```bash
npm install pinata
```

**工作流程：**
```javascript
const { PinataSDK } = require('pinata');

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

async function pinTaskData(data) {
  const blob = new Blob([JSON.stringify(data)]);
  const file = new File([blob], 'task-data.json', { type: 'application/json' });
  const result = await pinata.upload.file(file);
  return result.IpfsHash;
}

async function verifyTaskData(cid, originalData) {
  const content = await pinata.gateways.get(cid);
  const hash1 = crypto.createHash('sha256').update(JSON.stringify(content.data)).digest('hex');
  const hash2 = crypto.createHash('sha256').update(JSON.stringify(originalData)).digest('hex');
  return hash1 === hash2;
}
```

**数据流：**
```
任务创建: data → pinTaskData() → inputCID → createTask(taskId, desc, inputCID)
任务完成: result → pinTaskData() → outputCID → completeTask(taskId, outputCID)
验证:     getTask(taskId).inputCID → verifyTaskData(cid, data) → true/false
```

---

## 五、Layer 5: 信誉 — EAS（无需部署合约）

Ethereum Attestation Service 已部署在 Base (主网 + Sepolia)。

**npm 依赖：**
```bash
npm install @ethereum-attestation-service/eas-sdk
```

**1. 注册 Schema（一次性）：**
```javascript
const { SchemaRegistry } = require('@ethereum-attestation-service/eas-sdk');

const schemaRegistry = new SchemaRegistry(EAS_SCHEMA_REGISTRY_ADDRESS);
schemaRegistry.connect(signer);

const schema = 'string agentDID, uint8 completionRate, uint32 tasksCompleted, uint32 disputeWins, uint32 disputeLosses, uint32 score';
const tx = await schemaRegistry.register({
  schema,
  resolverAddress: ethers.ZeroAddress,
  revocable: true,
});
const schemaUID = await tx.wait();
```

**2. 创建 Attestation（每次任务完成后）：**
```javascript
const { EAS, SchemaEncoder } = require('@ethereum-attestation-service/eas-sdk');

const eas = new EAS(EAS_CONTRACT_ADDRESS);
eas.connect(signer);

const encoder = new SchemaEncoder(schema);
const encodedData = encoder.encodeData([
  { name: 'agentDID', value: 'did:ethr:0x...', type: 'string' },
  { name: 'completionRate', value: 95, type: 'uint8' },
  { name: 'tasksCompleted', value: 42, type: 'uint32' },
  { name: 'disputeWins', value: 3, type: 'uint32' },
  { name: 'disputeLosses', value: 1, type: 'uint32' },
  { name: 'score', value: 850, type: 'uint32' },
]);

const tx = await eas.attest({
  schema: schemaUID,
  data: { recipient: agentAddress, data: encodedData, revocable: true },
});
```

**3. 查询信誉：**
```javascript
const attestation = await eas.getAttestation(attestationUID);
const decoded = encoder.decodeData(attestation.data);
```

---

## 六、环境变量

```env
# 网络
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# 密钥
DEPLOYER_PRIVATE_KEY=0x...
BACKEND_PRIVATE_KEY=0x...

# 自有合约（部署后填入）
TRUSTCHAIN_ADDRESS=0x...

# Kleros (Base Sepolia)
KLEROS_ARBITRATOR_ADDRESS=0x...

# ERC-1056 DID Registry (Base Sepolia)
DID_REGISTRY_ADDRESS=0xd1D374DDE031075157fDb64536eF5cC13Ae75000

# EAS (Base Sepolia)
EAS_CONTRACT_ADDRESS=0x4200000000000000000000000000000000000021
EAS_SCHEMA_REGISTRY_ADDRESS=0x4200000000000000000000000000000000000020
EAS_SCHEMA_UID=（注册后填入）

# IPFS
PINATA_JWT=your-pinata-jwt
PINATA_GATEWAY=your-gateway.mypinata.cloud
```

---

## 七、成本估算

| 操作 | 预估 Gas (Base 主网) | 约合美元 |
|------|---------------------|---------|
| 部署 TrustChain.sol | ~800K gas | ~$0.02 |
| 注册 DID (setAttribute) | ~50K gas | ~$0.001 |
| 创建任务 | ~150K gas | ~$0.003 |
| 分配任务 | ~80K gas | ~$0.002 |
| 完成任务 | ~100K gas | ~$0.002 |
| 释放奖励 | ~60K gas | ~$0.001 |
| 发起争议 (含 Kleros 费用) | ~200K gas + Kleros 仲裁费 | ~$0.005 + 仲裁费 |
| EAS Attestation | ~80K gas | ~$0.002 |
| IPFS Pin (Pinata) | — | 免费 (1GB) |

---

## 八、实施优先级

| 阶段 | 内容 | 预估工时 |
|------|------|---------|
| **Phase 1** | Hardhat 配置 + 部署 TrustChain.sol 到 Base Sepolia | 2h |
| **Phase 2** | server.js 接入 ethers.js，替换内存 Map 为链上读写 | 4h |
| **Phase 3** | 集成 ethr-did，替代已删除的 DID.sol | 2h |
| **Phase 4** | 集成 Pinata IPFS，任务数据上链 | 2h |
| **Phase 5** | 集成 EAS 信誉系统 | 3h |
| **Phase 6** | 前端适配 + 端到端测试 | 3h |
| | **总计** | **16h** |
