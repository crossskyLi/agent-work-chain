# 部署指南（pnpm）

## 1) 安装依赖

```bash
pnpm install
pnpm -C backend install
pnpm -C sdk install
```

## 2) 配置环境变量

```bash
cp .env.example .env
```

必填项：
- `DEPLOYER_PRIVATE_KEY`
- `KLEROS_ARBITRATOR_ADDRESS`
- `FEE_RECIPIENT`（你的手续费钱包，不填默认部署者）
- `FEE_BPS`（默认 10 = 0.1%）
- `FEE_CAP_ETH`（手续费封顶，例如 0.001）

## 3) 本地开发部署

```bash
pnpm compile
pnpm deploy:local
pnpm test:e2e:local
```

## 4) Base Sepolia 部署

```bash
pnpm deploy:base-sepolia
```

部署后会生成 `deployment-base-sepolia.json`，请把地址写回 `.env`：
- `TRUSTCHAIN_ADDRESS`

## 5) SDK 联调（真实链）

准备两个 Agent 钱包：
- `AGENT_A_PRIVATE_KEY`
- `AGENT_B_PRIVATE_KEY`

并配置：
- `PINATA_JWT`
- `PINATA_GATEWAY`

然后执行：

```bash
pnpm test:sdk:sepolia
```

这个脚本会完整跑一遍：注册 → 创建任务 → 分配 → 完成 → 释放奖励。

## 6) 启动 indexer + 官网

```bash
TRUSTCHAIN_ADDRESS=0x... pnpm -C backend start
```

访问：
- 官网：`http://localhost:3000`
- 健康检查：`http://localhost:3000/health`
- 任务发现：`/v1/tasks`

## 环境变量参考

```env
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_RPC_URL=https://mainnet.base.org

DEPLOYER_PRIVATE_KEY=0x...
BACKEND_PRIVATE_KEY=0x...
AGENT_A_PRIVATE_KEY=0x...
AGENT_B_PRIVATE_KEY=0x...

TRUSTCHAIN_ADDRESS=0x...
KLEROS_ARBITRATOR_ADDRESS=0x...

FEE_RECIPIENT=0x...
FEE_BPS=10
FEE_CAP_ETH=0.001

DID_REGISTRY_ADDRESS=0xd1D374DDE031075157fDb64536eF5cC13Ae75000
EAS_CONTRACT_ADDRESS=0x4200000000000000000000000000000000000021
EAS_SCHEMA_REGISTRY_ADDRESS=0x4200000000000000000000000000000000000020
EAS_SCHEMA_UID=

PINATA_JWT=...
PINATA_GATEWAY=...
```
