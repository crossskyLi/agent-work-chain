# 后端工程化 Roadmap — 从 MVP 到生产级

> 当前状态：TypeScript + Express + SQLite 单机 Indexer
> 目标状态：可水平扩展、高可用、可观测的企业级服务

---

## 一、进程守护与部署 [优先级: P0]

### 1.1 进程管理器 (PM2) ✅ 已实现

| 项目 | 说明 |
|------|------|
| PM2 cluster mode | 利用多核 CPU，自动 fork N 个 worker 进程 |
| 自动重启 | 进程异常退出后自动拉起 |
| 零停机重载 | `pm2 reload` 滚动更新，不中断请求 |
| 日志管理 | 结构化日志 + 日志轮转 |
| 内存阈值 | 内存超限自动重启，防止 OOM |

### 1.2 容器化

| 项目 | 说明 | 状态 |
|------|------|------|
| Dockerfile | 多阶段构建，最小化镜像体积 | 待实现 |
| docker-compose.yml | 本地开发一键启动（backend + db + redis） | 待实现 |
| K8s manifests | Deployment + Service + HPA + PDB | 远期 |
| 健康探针 | `livenessProbe` + `readinessProbe` + `startupProbe` | 待实现 |

### 1.3 CI/CD

| 项目 | 说明 | 状态 |
|------|------|------|
| GitHub Actions | lint → test → build → deploy | 待实现 |
| 蓝绿/金丝雀部署 | 渐进式发布，快速回滚 | 远期 |
| 环境管理 | dev → staging → production 三套环境 | 待实现 |

---

## 二、限流与防护 [优先级: P0]

### 2.1 API 限流 ✅ 已实现

| 层级 | 策略 | 说明 |
|------|------|------|
| 全局限流 | 100 req/min per IP | 防止滥用 |
| 端点级限流 | 针对高消耗端点单独配置 | 如 `/v1/query/*` 更低 |
| 慢速限流 | sliding window | 平滑请求峰值 |

### 2.2 安全防护 ✅ 已实现

| 项目 | 说明 |
|------|------|
| Helmet | 设置安全 HTTP 头（CSP, HSTS, X-Frame-Options 等） |
| CORS 白名单 | 生产环境限制允许的 origin |
| 请求体大小限制 | 防止大 payload 攻击 |
| 参数校验 | Zod schema 校验（已实现） |

### 2.3 进一步安全加固（待实现）

| 项目 | 说明 | 优先级 |
|------|------|--------|
| API Key 认证 | 非公开端点需要 API Key | P1 |
| IP 黑名单 | 自动封禁异常 IP | P2 |
| WAF | Web 应用防火墙（Cloudflare / AWS WAF） | P2 |
| DDoS 防护 | CDN 层面的 DDoS 缓解 | P2 |

---

## 三、数据库演进 [优先级: P1]

### 3.1 从 SQLite 迁移到 PostgreSQL

> SQLite 是单文件数据库，适合 MVP 但不支持并发写入、网络访问和水平扩展。

| 阶段 | 说明 |
|------|------|
| 迁移方案 | SQLite → PostgreSQL，使用 Drizzle ORM 或 Prisma 做 migration |
| 连接池 | `pg-pool` 或 Drizzle 内置连接池，避免连接风暴 |
| 准备好的语句 | PostgreSQL prepared statements 提升查询性能 |

### 3.2 分表策略

| 策略 | 适用场景 | 说明 |
|------|----------|------|
| 按时间分区 | `events`, `settlements` | 按月/按季分区，历史数据归档 |
| 按状态分区 | `tasks` | 活跃任务 vs 已完成任务分开存储 |
| 按地址分片 | `agents` | 当 agent 数量达到百万级时 |

```sql
-- PostgreSQL 分区示例：events 按月分区
CREATE TABLE events (
    id BIGSERIAL,
    event_name TEXT NOT NULL,
    task_id TEXT,
    block_number INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_q1 PARTITION OF events
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE events_2026_q2 PARTITION OF events
    FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
```

### 3.3 读写分离

| 组件 | 说明 |
|------|------|
| 主库（Writer） | 处理所有写操作（event listener 写入） |
| 只读副本（Reader） | 处理所有 API 查询请求，可水平扩展多个副本 |
| 连接路由 | 在 service 层根据操作类型选择连接 |

```
                    ┌──────────────┐
                    │  Event       │
                    │  Listener    │
                    └──────┬───────┘
                           │ WRITE
                    ┌──────▼───────┐
                    │  PostgreSQL  │
                    │  Primary     │──── streaming replication
                    └──────────────┘         │
                                    ┌───────▼────────┐
         API Queries ──────────────►│  PostgreSQL     │
         (read-only)                │  Replica × N    │
                                    └─────────────────┘
```

### 3.4 数据库运维

| 项目 | 说明 | 优先级 |
|------|------|--------|
| Migration 工具 | Drizzle Kit / Prisma Migrate | P1 |
| 自动备份 | pg_dump cron + S3 存储 | P1 |
| 慢查询监控 | pg_stat_statements + 告警 | P1 |
| 连接池监控 | 连接数、等待队列、超时告警 | P2 |

---

## 四、缓存层 [优先级: P1]

### 4.1 Redis 缓存

| 场景 | Key 模式 | TTL | 说明 |
|------|----------|-----|------|
| 任务列表 | `tasks:list:{hash(params)}` | 10s | 高频查询，短 TTL |
| Agent 详情 | `agent:{address}` | 60s | 变化不频繁 |
| 统计概览 | `overview:summary` | 30s | 避免频繁 COUNT 查询 |
| 账单摘要 | `billing:summary` | 60s | 聚合查询开销大 |

### 4.2 缓存策略

| 策略 | 说明 |
|------|------|
| Cache-Aside | 读时检查缓存，miss 时查 DB 并回填 |
| Write-Through | 写入 DB 时同步更新/失效缓存 |
| 缓存穿透防护 | 对不存在的 key 缓存空值（短 TTL） |
| 缓存雪崩防护 | TTL 加随机抖动，避免大量 key 同时过期 |

### 4.3 HTTP 缓存

| Header | 说明 |
|--------|------|
| `ETag` | 基于内容哈希的条件请求 |
| `Cache-Control` | 客户端/CDN 缓存策略 |
| `Last-Modified` | 基于时间戳的条件请求 |

---

## 五、高可用架构 [优先级: P2]

### 5.1 水平扩展

```
                    ┌─────────────────┐
                    │   Load Balancer  │
                    │   (Nginx / ALB)  │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Backend  │  │ Backend  │  │ Backend  │
        │ Node 1   │  │ Node 2   │  │ Node 3   │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │              │              │
        ┌────▼──────────────▼──────────────▼────┐
        │              Redis Cluster             │
        └────────────────────┬───────────────────┘
                             │
        ┌────────────────────▼───────────────────┐
        │         PostgreSQL (Primary + Replicas) │
        └─────────────────────────────────────────┘
```

### 5.2 无状态设计

| 要点 | 说明 |
|------|------|
| Session 外置 | 认证状态不存内存，用 JWT 或 Redis session |
| 配置外置 | 环境变量 + 配置中心，不依赖本地文件 |
| 文件存储外置 | SQLite → PostgreSQL，本地文件 → S3/MinIO |

### 5.3 Event Listener 高可用

> 当前 Event Listener 内嵌在 backend 进程中，多实例部署会导致重复处理事件。

| 方案 | 说明 |
|------|------|
| 单独部署 | Listener 独立为微服务，单实例运行 |
| 分布式锁 | Redis SETNX 保证只有一个 listener 处理事件 |
| 消息队列 | 链上事件 → MQ → 多 consumer 幂等处理 |
| Checkpoint | 记录已处理区块号，重启后从断点续扫 |

### 5.4 容错与降级

| 项目 | 说明 | 优先级 |
|------|------|--------|
| 熔断器 | RPC 调用失败率达阈值时快速失败（opossum） | P2 |
| 重试策略 | 指数退避 + 抖动，避免重试风暴 | P2 |
| 降级策略 | 缓存不可用时直接查 DB，DB 不可用返回缓存 | P2 |
| 超时控制 | 每个外部调用设置超时上限 | P1 |

---

## 六、可观测性 [优先级: P1]

### 6.1 日志

| 层级 | 说明 | 状态 |
|------|------|------|
| 请求日志 | method, path, status, duration | ✅ 已实现 |
| 结构化日志 | JSON 格式，支持 ELK/Datadog 采集 | ✅ pino 已实现 |
| Request ID | 每请求唯一 ID，贯穿全链路 | ✅ 已实现 |
| 日志级别 | error > warn > info > debug，按环境配置 | 待实现 |

### 6.2 指标 (Metrics)

| 指标 | 说明 | 工具 |
|------|------|------|
| QPS / Latency | 请求量和延迟分布（p50, p95, p99） | prom-client + Grafana |
| Error Rate | 4xx / 5xx 比例 | Prometheus |
| DB 性能 | 查询耗时、连接池使用率 | 自定义 metrics |
| 业务指标 | 任务创建率、Agent 活跃度 | 自定义 metrics |

### 6.3 链路追踪

| 项目 | 说明 |
|------|------|
| OpenTelemetry | 分布式链路追踪标准 |
| Trace ID 传递 | 请求 → service → DB → RPC 全链路关联 |
| Span 粒度 | HTTP handler → service → DB query 分层 |

### 6.4 告警

| 告警规则 | 阈值 | 通道 |
|----------|------|------|
| 5xx 错误率 > 1% | 5 分钟窗口 | Slack / PagerDuty |
| P99 延迟 > 2s | 5 分钟窗口 | Slack |
| DB 连接池耗尽 | 可用连接 < 5 | PagerDuty |
| Event Listener 断连 | 超过 1 分钟无新事件 | PagerDuty |

---

## 七、消息队列 [优先级: P2]

### 7.1 场景

| 场景 | 说明 |
|------|------|
| 链上事件处理 | Listener → MQ → Consumer，解耦写入 |
| Worker 任务分发 | 替代当前的轮询模式 |
| Webhook 通知 | 任务状态变更时异步通知订阅方 |
| 定时任务 | 数据聚合、报表生成 |

### 7.2 技术选型

| 方案 | 适用规模 | 说明 |
|------|----------|------|
| BullMQ (Redis) | 中小规模 | 简单可靠，与现有技术栈匹配 |
| RabbitMQ | 中大规模 | 成熟的消息中间件 |
| Kafka | 大规模 | 高吞吐，适合事件流处理 |

---

## 八、API 网关 [优先级: P2]

| 项目 | 说明 |
|------|------|
| 统一入口 | 所有 API 经过网关路由 |
| 认证鉴权 | 网关层统一处理 JWT / API Key 验证 |
| 流量控制 | 网关层限流、熔断、降级 |
| API 版本管理 | `/v1/`, `/v2/` 路由拆分 |
| 请求/响应转换 | 网关层做 DTO 映射 |
| 文档生成 | OpenAPI/Swagger 自动生成 |

---

## 九、测试体系 [优先级: P1]

| 层级 | 工具 | 覆盖范围 |
|------|------|----------|
| 单元测试 | vitest | service 函数、工具函数 |
| 集成测试 | vitest + supertest | API 端点、中间件 |
| E2E 测试 | 现有 hardhat test | 合约 + 全链路 |
| 压测 | k6 / autocannon | 并发性能基准 |
| 契约测试 | pact | 前后端接口一致性 |

---

## 十、实施路线图

### 阶段 1：生产就绪（1-2 周）

- [x] TypeScript 全量迁移
- [x] 分层架构（routes / services / middleware）
- [x] 全局错误处理 + asyncHandler
- [x] Zod 参数校验
- [x] CORS
- [x] 请求日志
- [x] 优雅关闭
- [x] 限流
- [x] 安全头 (Helmet)
- [x] 响应压缩
- [x] PM2 进程管理
- [x] Dockerfile + docker-compose
- [x] 单元测试（核心 service）
- [x] OpenAPI 文档

### 阶段 2：可扩展（2-4 周）

- [x] PostgreSQL 接入骨架（reader/writer pool + schema bootstrap）
- [x] Tasks 热点路径缓存（Redis 优先，内存兜底）+ HTTP Cache-Control
- [x] Prometheus `/metrics` 基础指标（QPS/耗时基础盘）
- [ ] SQLite → PostgreSQL 迁移
- [ ] Redis 缓存层
- [ ] 读写分离
- [x] 结构化日志（pino + request ID）
- [ ] Prometheus metrics
- [ ] Event Listener 独立部署
- [ ] BullMQ 任务队列

### 阶段 3：高可用（1-2 月）

- [ ] K8s 部署 + HPA
- [ ] 数据库分区（events 按时间）
- [ ] 分布式链路追踪（OpenTelemetry）
- [ ] 熔断器 + 降级策略
- [ ] 告警体系
- [ ] CI/CD 流水线
- [ ] 蓝绿部署

### 阶段 4：规模化（3-6 月）

- [ ] 消息队列（Kafka / RabbitMQ）
- [ ] API 网关
- [ ] 数据库水平分片
- [ ] CDN + 边缘缓存
- [ ] 多区域部署
- [ ] 压测 + 性能调优
