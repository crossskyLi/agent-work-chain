# 架构：五层闭环信任系统

## 概述

Agent Work Chain 信任系统由五个信任层组成，共同构成 AI Agent 自主协作的闭环保障体系。

---

## Agent 信任的四个核心维度

在 Agent 经济中，一个 Agent（或服务）能否被其他 Agent 选中并持续合作，取决于四个维度：


| 维度       | 定义                                   | 对应信任层          |
| -------- | ------------------------------------ | -------------- |
| **可调用性** | 能否被其他 Agent 理解和接入——接口标准、身份可发现、能力声明清晰 | Layer 1 (身份)   |
| **可靠性**  | 反复调用时能否稳定返回正确结果——执行一致、错误率低、响应可预期     | Layer 3 (行为记录) |
| **信任度**  | 为什么优先调用你而不是别人——品牌权威、数据准确、履约稳定、链上信誉背书 | Layer 5 (信誉)   |
| **可组合性** | 能否像乐高一样被轻松拼入任意工作流——标准化接口、无状态依赖、契约明确  | Layer 2 (规则合约) |


五层信任架构正是围绕这四个维度设计的技术保障。

---

## Layer 1: 身份信任层

**目的：** 为每个 Agent 建立可验证的去中心化身份。

**区块链设施：** 使用已部署的 [ERC-1056 Ethereum DID Registry](https://github.com/uport-project/ethr-did-registry)（`did:ethr` 方法），无需部署自定义合约。

- DID 格式：`did:ethr:<address>`
- 能力声明在注册时通过 `setAttribute()` 存储链上
- 身份可通过 `revokeAttribute()` 停用
- Node.js 集成：`ethr-did` + `ethr-did-resolver` npm 包

**覆盖维度：可调用性** — 让每个 Agent 拥有全网可发现、可验证的身份。

---

## Layer 2: 规则与合约信任层

**目的：** 通过不可篡改的智能合约定义协作规则。

**区块链设施：** 自有合约 `TrustChain.sol` + `Arbitration.sol`，通过 Hardhat 部署到 Base (L2)。

`TrustChain.sol` 编码任务生命周期规则：

- 任务创建、分配、完成、争议均由合约逻辑管控
- 奖励托管（Escrow）确保完成后自动结算
- 规则不可被事后修改

`Arbitration.sol` 处理争议解决：

- 经认证的仲裁人才可裁决
- 裁决结果链上不可篡改

**覆盖维度：可组合性** — 明确的契约保证任何 Agent 可按标准规则接入协作。

---

## Layer 3: 行为与执行信任层

**目的：** 链上记录 Agent 的每一个操作。

**区块链设施：** 合约事件（Events）自动产生不可篡改的审计追踪，无需额外开发。

- 所有状态变更（Created → InProgress → Completed / Disputed）通过事件上链
- 每次状态变更附带时间戳
- 链下执行日志可哈希后存储到 IPFS，CID 记录在链上

**事件索引：** 使用 Alchemy 或 The Graph 查询历史事件。

**覆盖维度：可靠性** — 所有行为可追溯，执行结果有链上证据。

---

## Layer 4: 数据与 I/O 信任层

**目的：** 验证流入和流出 Agent 任务的数据完整性。

**区块链设施：** 使用 IPFS（通过 Pinata）实现内容寻址存储，MVP 阶段无需 Oracle。

工作流程：

```
任务输入数据 → SHA-256 哈希 → 上传 IPFS (Pinata) → CID 写入 TrustChain.sol
任务输出结果 → SHA-256 哈希 → 上传 IPFS (Pinata) → CID 写入 TrustChain.sol
验证时：重新哈希 → 与链上 CID 比对 → 确认未被篡改
```

- Pinata 免费额度：1GB 存储 + 100次/月 pinning
- `pinata` npm SDK 直接可用

**覆盖维度：可靠性 + 信任度** — 输入输出均可验证，结果不可伪造。

---

## Layer 5: 信誉与问责信任层

**目的：** 通过链上信誉建立长期问责机制。

**区块链设施：** 使用已部署的 [Ethereum Attestation Service (EAS)](https://attest.org/)，无需部署自定义合约。

链上信誉注册表追踪每个 Agent 的历史：

- 任务完成率
- 争议结果（胜 / 负）
- 仲裁历史
- 信誉分影响任务分配优先级

**实现方式：**

1. 在 EAS 注册 Schema：`agentDID string, completionRate uint8, disputeWins uint32, disputeLosses uint32, score uint32`
2. 每次任务完成/仲裁结束，后端调用 EAS 创建 Attestation
3. 查询 Agent 信誉 = 查询该 DID 的所有 Attestation 并汇总

Node.js 集成：`@ethereum-attestation-service/eas-sdk`

**覆盖维度：信任度** — 信誉链上可查，无法伪造，Agent 优先选择高信誉合作方。

---

## 数据流

```
Agent 注册 (did:ethr — ERC-1056 Registry)
        ↓
任务创建 (TrustChain.sol — Base L2)
        ↓
Agent 分配 + 执行
        ↓
结果提交 + 数据哈希上链 (IPFS + TrustChain.sol)
        ↓
任务完成 / 争议 (TrustChain.sol → Kleros)
        ↓
信誉更新 (EAS Attestation)
```

---

## 区块链设施映射（混合方案）

| 信任层 | 区块链设施 | 是否需要部署合约 |
|--------|-----------|----------------|
| Layer 1 — 身份 | ERC-1056 DID Registry (`ethr-did`) | ❌ 已部署 |
| Layer 2 — 任务 | `TrustChain.sol`（唯一自有合约） | ✅ Hardhat → Base |
| Layer 2 — 仲裁 | Kleros (ERC-792，合约实现 `IArbitrable`) | ❌ 已部署 |
| Layer 3 — 行为 | TrustChain Events 自动产生 | ❌ 自动覆盖 |
| Layer 4 — 数据 | IPFS (Pinata) + 链上 CID | ❌ SaaS |
| Layer 5 — 信誉 | EAS (Ethereum Attestation Service) | ❌ 已部署 |

**合约文件：** 仅 `contracts/TrustChain.sol`（已删除 `DID.sol` 和 `Arbitration.sol`）


---

## 技术选型


| 组件   | 选择                            | 理由                  |
| ---- | ----------------------------- | ------------------- |
| 部署网络 | Base Sepolia (测试) → Base (生产) | 以太坊 L2，Gas 极低，生态完善  |
| 合约工具 | Hardhat                       | Node.js 原生，和项目技术栈一致 |
| 链交互  | ethers.js v6                  | 标准库                 |
| DID  | ethr-did + resolver           | 不用部署合约              |
| 数据存储 | Pinata (IPFS)                 | 免费额度够 MVP           |
| 信誉   | EAS SDK                       | 不用部署合约              |
| 事件查询 | Alchemy / The Graph           | 免费额度够               |


---

## 后端 API

Node.js 后端提供 REST API，抽象区块链交互细节，让 Agent 和客户端无需直接调用智能合约。详见 [api.md](api.md)。

区块链集成的详细实施方案见 [blockchain-integration.md](blockchain-integration.md)。