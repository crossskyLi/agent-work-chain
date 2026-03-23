# 审计蜂群落地执行方案

> 2026-03-20 | 基于竞品分析 + 经济学推导 + 现有资产盘点

---

## 核心定位（一句话）

**Agent 经济的独立审计基础设施。** 不做铁路（AEP/MoltBazaar 在做），做铁路上的质检站。

---

## 为什么审计蜂群是结构性必需品

1. **科斯定理坍缩**：交易成本→0 后，公司边界消失，Agent 集群替代传统组织。但内部审计 ≠ 独立审计——平台不能审计自己
2. **管理成本 = 算力成本**：模型对齐、架构仲裁、Evals 验证三层管理全部转化为算力。但"谁来审计算力本身"没人回答
3. **三个无人覆盖的审计场景**：
   - 无预谋算法合谋检测（多 Agent 通过相似 RL 规则收敛到合谋定价）
   - 偏好真实性审计（Agent 是否真正服务用户，还是暗中服务平台利益）
   - Evals 审计（评估 Agent 和执行 Agent 来自同一提供商时的可信度问题）
4. **竞品空白**：AEP 做市场、A.R.E.S 做评分（5 维度），无人做独立第三方审计 + 多模型交叉验证

---

## 审计蜂群架构

```
Queen (Coordinator)
 ├── Output Auditor ×3    — Claude / GPT / Gemini 交叉验证，2/3 共识
 ├── Behavior Auditor     — Action log 分析 + 规则引擎
 ├── Financial Auditor    — 链上 tx vs 链下 task 对账
 ├── Reputation Auditor   — 统计异常检测（刷分、Sybil）
 └── Compliance Auditor   — 内容安全 + 合规规则

拓扑: Hierarchical | 共识: 2/3 多数 | 接口: MCP + REST
```

### 审计九维度品质框架（v2，含新增维度）

```
Agent Trust Score = Σ (维度得分 × 权重)

维度                    权重    验证方式                          竞品覆盖
────────────────────────────────────────────────────────────────────────
1. 能力真实性           12%     Skill Challenge                   A.R.E.S ✓
2. 交付正确性           18%     多模型交叉审计 + spec-vs-delivery  A.R.E.S 部分
3. 行为合规性           12%     Action log + 规则引擎             无
4. 财务完整性            8%     链上 tx vs 链下 task 对账         无
5. 安全性                8%     安全扫描 + 注入测试               无
6. 信誉真实性            8%     统计异常检测 + 跨平台验证         A.R.E.S ✓
7. 性能可靠性            8%     性能基准 + SLA 达标率             A.R.E.S ✓
8. 协作品质              5%     协作日志 + 合作方反馈             无
9. 合规性                5%     规则引擎 + 内容安全扫描           无
10. 定价行为公正性 [新增] 8%     合谋检测 + 价格歧视识别          无 ← 独占
11. 偏好忠诚度 [新增]    8%     用户指令 vs 实际执行比对          无 ← 独占
```

---

## 立刻要做的事情

### Week 1-2：Output Audit v0（最小闭环）

**目标**：agent-finder 上有 10 个任务跑通自动审计，结果可查

#### 1.1 审计脚本（Node.js）

在 `agent-finder/packages/server/src/services/` 新增 `audit.service.ts`：

```
输入：一个 DELIVERED 状态的 Task（包含 task.description + task.deliveryContent）
处理：
  1. 调 Claude API → 评分 (0-100) + 评语
  2. 调 GPT API → 评分 (0-100) + 评语
  3. 取两个评分的中位数作为最终分
  4. 如果两个评分差距 > 20 分 → 标记为"需人工复核"
输出：{ auditScore, auditorResults[], consensus, needsReview }
```

技术要点：
- 用 `packages/shared` 定义 `AuditResult` 类型
- 审计 prompt 固定模板，包含：任务要求、交付内容、评分标准（正确性/完整性/质量）
- 两个 LLM 独立调用，不共享上下文 — 这是交叉验证的核心

#### 1.2 审计触发

- Task 状态变为 DELIVERED 时自动触发
- `POST /v1/tasks/:id/audit` 手动触发
- 审计结果写入 Task 记录的 `auditScore` / `auditReport` 字段

#### 1.3 DB Schema 变更

```sql
ALTER TABLE tasks ADD COLUMN audit_score INTEGER;
ALTER TABLE tasks ADD COLUMN audit_report TEXT;  -- JSON
ALTER TABLE tasks ADD COLUMN audit_status TEXT DEFAULT 'pending';
  -- pending | auditing | passed | failed | needs_review
```

#### 1.4 验收标准

- [ ] 10 个 DELIVERED 任务有审计分数
- [ ] 两个 LLM 独立评分，展示一致性
- [ ] 审计报告可通过 API 查询

---

### Week 2-3：Skill Challenge v0

**目标**：5 个 Agent 通过技能认证，结果写入 Agent 记录

#### 2.1 Challenge 生成器

在 `agent-finder/packages/server/src/services/` 新增 `challenge.service.ts`：

```
输入：Agent 注册信息（self-reported skills, capabilities）
处理：
  1. 根据 Agent 声称的技能生成 1-3 道测试题
  2. 题目由 LLM 生成，难度中等偏上
  3. Agent 提交答案
  4. 由另一个 LLM 评分（不用生成题目的同一个）
  5. 通过率 >= 85% → 标记 verified
输出：{ passed, score, challengeDetails[], validUntil }
```

#### 2.2 API

- `POST /v1/agents/:address/challenge` — 发起技能挑战
- `POST /v1/agents/:address/challenge/:id/submit` — Agent 提交答案
- `GET /v1/agents/:address/certifications` — 查看认证状态

#### 2.3 Agent 记录变更

```sql
ALTER TABLE agents ADD COLUMN verified BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN verification_score INTEGER;
ALTER TABLE agents ADD COLUMN verified_at TEXT;
ALTER TABLE agents ADD COLUMN verification_expires_at TEXT;  -- 90 天有效期
```

#### 2.4 验收标准

- [ ] 5 个 Agent 完成 Skill Challenge
- [ ] 通过/未通过有明确分界
- [ ] 验证结果有有效期（90 天）
- [ ] 前端展示 verified 标记

---

### Week 3-4：ERC-8004 接入 + 审计结果上链

**目标**：审计结果写入 ERC-8004 Reputation Registry，可链上查询

#### 3.1 ERC-8004 合约交互

合约地址（Base Sepolia）: `0x8004A818BFB912233c491871b3d84c89A494BD9e`

```typescript
// 核心交互
import { ethers } from 'ethers';

// 1. 注册 Agent 到 Identity Registry
const agentId = await identityRegistry.register(agentURI);

// 2. 审计完成后，写入 Reputation Registry
await reputationRegistry.giveFeedback(
  agentId,           // 被审计的 Agent
  auditScore,        // int128: 审计总分 0-100
  0,                 // valueDecimals
  "audit-trust-score", // tag1: 标识来源
  "v1",              // tag2: 框架版本
  "",                // endpoint
  reportIPFS,        // feedbackURI: IPFS 审计报告全文
  reportHash         // feedbackHash
);

// 3. 技能认证写入 Validation Registry
const requestHash = ethers.keccak256(certPayload);
await validationRegistry.validationRequest(
  auditSwarmAddress,
  agentId,
  certURI,
  requestHash
);
// 认证通过后
await validationRegistry.validationResponse(
  requestHash,
  challengeScore,  // 0-100
  certReportURI,
  certReportHash,
  "skill-challenge"
);
```

#### 3.2 SDK 封装

在 `sdk/` 下新增 `erc8004.ts`：

```typescript
export class AuditChainWriter {
  constructor(privateKey: string, rpcUrl: string);

  // 写审计结果到 Reputation Registry
  async submitAuditFeedback(agentId: number, score: number, reportCID: string): Promise<string>;

  // 写技能认证到 Validation Registry
  async submitCertification(agentId: number, skill: string, score: number, validDays: number): Promise<string>;

  // 读取 Agent 审计历史
  async getAuditHistory(agentId: number): Promise<AuditRecord[]>;
}
```

#### 3.3 验收标准

- [ ] 在 Base Sepolia 上注册 1 个 Agent 到 ERC-8004
- [ ] 1 条审计结果成功写入 Reputation Registry
- [ ] 1 条技能认证成功写入 Validation Registry
- [ ] 链上记录可通过 SDK 读回

---

### Week 4-5：Audit MCP 工具

**目标**：外部 AI 客户端可通过 MCP 调用审计能力

#### 4.1 MCP Server

文件：`mcp/audit-mcp-server.js`

工具列表：

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `verify_output` | 审计一个 Agent 的交付物 | taskSpec, deliveryContent |
| `challenge_skill` | 对 Agent 发起技能挑战 | agentId, claimedSkills |
| `get_trust_score` | 查询 Agent 信任评分 | agentId |
| `check_behavior` | 检查 Agent 行为日志合规性 | agentId, actionLog |
| `detect_collusion` | 检测一组 Agent 是否存在定价合谋 | agentIds[], priceHistory[] |

#### 4.2 npm 发布

```json
{
  "name": "@agent-work-chain/audit-mcp",
  "version": "0.1.0",
  "description": "MCP server for independent AI agent auditing"
}
```

#### 4.3 验收标准

- [ ] MCP server 在 Claude Desktop / Cursor 中可用
- [ ] `verify_output` 返回结构化审计报告
- [ ] `get_trust_score` 能查链上数据

---

## 合约层改造：从 TrustChain 到 AuditRegistry

### 砍掉

- `createTask` / `assignTask` / `completeTask` / `releaseReward` — 市场功能，让 AEP/MoltBazaar 做
- `createBounty` / `claimTask` / `cancelBounty` — Bounty Board，同上
- `string assignedAgentDID` — ethr-did，被 ERC-8004 替代

### 保留

- `stake` / `withdrawStake` / `slashStake` — 改为审计者质押（审计者作恶可被 slash）
- `IArbitrable` / Kleros 集成 — 审计结果有争议时的仲裁通道
- Fee 机制 — 审计服务收费

### 新增

```solidity
contract AuditRegistry {
    // 审计者注册（需质押）
    function registerAuditor(uint256 erc8004AgentId) external payable;

    // 提交审计结果
    function submitAudit(
        uint256 targetAgentId,      // 被审计 Agent 的 ERC-8004 ID
        bytes32 taskHash,           // 任务标识
        uint8 overallScore,         // 总分 0-100
        string calldata reportCID   // IPFS 审计报告
    ) external;

    // 对审计结果发起争议（触发 Kleros）
    function disputeAudit(bytes32 auditHash) external payable;

    // 查询审计记录
    function getAuditsByAgent(uint256 agentId) external view returns (bytes32[] memory);
}
```

---

## 现有资产盘点（不造轮子）

| 资产 | 位置 | 用途 |
|------|------|------|
| agent-finder Task 生命周期 | `packages/server/src/services/task.service.ts` | 审计触发点（DELIVERED 状态） |
| agent-finder Agent 注册 | `packages/server/src/services/agent.service.ts` | Skill Challenge 触发点 |
| TrustChain.sol Staking | `contracts/TrustChain.sol:100-121` | 复用为审计者质押 |
| TrustChain.sol Kleros 集成 | `contracts/TrustChain.sol:196-247` | 复用为审计争议仲裁 |
| Bounty Board MCP | `mcp/bounty-board-mcp.js` | 参考结构，新建 audit-mcp |
| Query MCP | `mcp/query-mcp-server.js` | 参考结构 |
| SDK TrustChainAgent | `sdk/` | 扩展 ERC-8004 交互方法 |
| claude-flow hierarchical | `agent-work-chain` 依赖 | 蜂群编排引擎 |
| verification-quality SKILL | `.claude/skills/verification-quality/` | truth scoring 算法 |

---

## 关键决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| 身份标准 | ERC-8004 替代 ethr-did | 2.4 万 Agent 已注册，MetaMask+Google+Coinbase 联合提出，事实标准 |
| 审计结果存储 | ERC-8004 Reputation + Validation Registry | 融入生态而非自建标准 |
| 市场功能 | 砍掉 | AEP/MoltBazaar 已上线 Base Mainnet，不与铁路竞争 |
| Token | 不发 | 市场已拥挤（AGT/BAZAAR/ARES），审计服务以 ETH/USDC 计费 |
| 审计模型 | 多模型交叉（Claude+GPT+Gemini）| 单模型审计可信度不足，交叉验证是核心差异化 |
| 先做 Service 还是 Protocol | Service first | 先有能跑的审计，再有标准 |

---

## 风险与对策

| 风险 | 概率 | 对策 |
|------|------|------|
| AEP/MoltBazaar 自建审计 | 中 | 独立第三方永远 > 平台自审；先落地占位 |
| A.R.E.S 扩展到全维度 | 中 | 速度竞争：先发布九维度框架开放标准 |
| Agent 经济泡沫继续挤出 | 高 | 自有平台（agent-finder）先用；审计需求随监管推进会反弹 |
| 审计 API 调用成本高 | 高 | 简单任务用小模型（Haiku），复杂任务才上大模型；缓存相似审计 |
| 一个人做不完 | 高 | Phase 0 只做 Output Audit + Skill Challenge，用 Agent 扩展自己 |
| ERC-8004 标准变更 | 低 | 已有多个项目采纳，变更概率低；接入层做适配器模式 |

---

## 时间线总览

```
Week 1-2  ████████  Output Audit v0（agent-finder 内闭环）
Week 2-3  ████████  Skill Challenge v0
Week 3-4  ████████  ERC-8004 接入（Base Sepolia）
Week 4-5  ████████  Audit MCP 工具
Week 5-6  ████████  合约层改造（TrustChain → AuditRegistry）
Week 6-8  ████████  审计蜂群 v0（claude-flow hierarchical, 3 模型交叉）

里程碑 M1 (Week 2): 10 个任务有审计分数
里程碑 M2 (Week 3): 5 个 Agent 通过 Skill Challenge
里程碑 M3 (Week 4): 审计结果首次写入 ERC-8004 (Sepolia)
里程碑 M4 (Week 5): Audit MCP 可被外部 AI 客户端调用
里程碑 M5 (Week 8): 蜂群并行审计 3 个交付物，2/3 共识
```

---

## 成功的定义

8 周后，如果以下全部为真，则方向正确：

1. agent-finder 上每个 DELIVERED 任务自动产出审计报告
2. 至少 5 个 Agent 有链上可查的 ERC-8004 信誉记录
3. 外部开发者可通过 `npx @agent-work-chain/audit-mcp` 一行命令接入审计
4. 审计蜂群能用 3 个不同 LLM 交叉验证同一交付物，输出共识分数
5. 整个流程中人类只需要做一件事：定义"什么算好的"（损失函数）

如果 8 周后以上条件不满足，说明方向需要再次修正。不自欺。

---

## 附录：Week 6-8 蜂群编排参考笔记

> 来源：[OpenClaw 上下文工程/记忆系统全解析](https://mp.weixin.qq.com/s/UNh7rzsxcKWfS7Ff1N0t5Q)（叶小钗）

### A. 子 Agent 上下文隔离

OpenClaw 对主 Agent 和子 Agent 采用不同的上下文模式：

- **完整模式（full）**：主 Agent 使用，加载全部 Bootstrap 文件（AGENTS.md、TOOLS.md、MEMORY.md、SOUL.md 等）、完整工具列表、Skills 列表、记忆召回指令
- **精简模式（lightweight）**：子 Agent 使用，只保留工具列表、工作区信息和运行时元数据，不加载完整项目背景
- **无模式（none）**：只保留基础身份声明，用于最简单的场景

**子 Agent 生命周期管理接口**：

```
ContextEngine {
  prepareSubagentSpawn()  — 主 Agent 准备生成子 Agent 时调用，为子 Agent 准备隔离的上下文环境
  onSubagentEnded()       — 子 Agent 结束时调用，聚合结果并清理状态
}
```

**对审计蜂群的映射**：

| OpenClaw 概念 | 审计蜂群对应 |
|---------------|-------------|
| 主 Agent（full 模式） | Queen Coordinator — 持有完整任务上下文、审计策略、历史记录 |
| 子 Agent（lightweight 模式） | Output/Behavior/Financial Auditor — 只接收最小化的审计输入（task spec + delivery content），不共享彼此上下文 |
| prepareSubagentSpawn | Queen 分发审计任务时，为每个 Auditor 构造独立 prompt（不同 LLM、不同随机种子） |
| onSubagentEnded | Queen 收集所有 Auditor 结果，执行 2/3 共识投票 |

**关键设计原则**：子 Agent 之间不共享上下文，这正是交叉验证可信度的基础——如果 3 个 LLM Auditor 共享了评分标准以外的信息，交叉验证就失去了意义。

---

### B. Token 预算保护

OpenClaw 的 Token 预算管理机制：

**1. 上下文窗口确定（四级优先级）**：
1. 配置文件明确指定（最高优先级）
2. 模型元数据自动发现
3. 默认值 200,000 tokens
4. 全局配置上限（防止误配过大窗口）

**2. 保护检查阈值**：
- **硬性最小值 16,000 tokens**：低于此值直接阻止运行，因为无法支持有意义的对话
- **警告阈值 32,000 tokens**：低于此值记录警告但不阻止

**3. Bootstrap 文件大小限制**：
- 单个文件上限：20,000 字符，超出截断
- 所有文件总上限：150,000 字符，超出停止加载新文件

**4. Skills/工具加载的降级策略**：
- 先尝试完整格式（名称 + 描述 + 路径）
- 超出 token 预算 → 切换到紧凑格式（只有名称 + 路径）
- 还是超 → 截断，只保留前面的

**5. 上下文压缩（三级策略）**：
- **摘要压缩**：用 LLM 生成早期消息的摘要，保留关键信息（任务、决策、文件名等），默认压到预算 80%
- **截断压缩**：直接丢弃早期消息，速度快但丢信息
- **混合压缩**：早期用摘要、中期截断、最近完整保留

**6. 压缩触发条件**：
- 自动：API 返回上下文溢出错误
- 自动：当前大小超过预算 90%
- 手动：用户发送 `/compact` 命令

**对审计蜂群的映射**：

| 机制 | 审计蜂群应用 |
|------|-------------|
| 保护检查阈值 | 审计 prompt 模板设最小/最大 token 限制，防止过短（审计无意义）或过长（成本爆炸） |
| Bootstrap 文件大小限制 | 审计标准文档、评分维度描述设字符上限，超长交付物做截断或分段审计 |
| Skills 降级策略 | 九维度框架按优先级加载：核心维度（交付正确性 18%、能力真实性 12%）先加载，次要维度（协作品质 5%、合规性 5%）在 token 紧张时降级为简要描述 |
| 摘要压缩 | 审计历史记录过多时，对早期审计结果做摘要（保留分数 + 关键问题），丢弃过程细节 |
| 成本控制 | 简单任务用小模型（Haiku），复杂/争议任务才上大模型（Sonnet/Opus）；缓存相似审计结果 |
