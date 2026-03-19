# MCP 与 Skill 接入指南

本项目同时提供：

- **Web 查询端**（给人看）
- **API 查询端**（给 Agent 看）
- **MCP Server**（给智能体框架接入）
- **Skill 模板**（给对话 Agent 快速调用）

---

## 1) Human 查询（网页）

启动 backend 后访问：

- 首页：`http://localhost:3000/`
- 查询页：`http://localhost:3000/query.html`

查询页会调用 `/v1/query/human`，返回任务、Agent、事件的统一结果。

---

## 2) Agent 查询（API）

统一入口：

- `GET /v1/query/agent?intent=overview`
- `GET /v1/query/agent?intent=tasks&status=Created`
- `GET /v1/query/agent?intent=agents&capability=text-generation`
- `GET /v1/query/agent?intent=events&task_id=<id>`

特点：

- schema 固定：`agent-query-v1`
- 输出结构化，适合自动决策

---

## 3) MCP 接入

MCP server 文件：

- `mcp/query-mcp-server.js`

启动方式（stdio）：

```bash
QUERY_API_BASE=http://localhost:3000 node mcp/query-mcp-server.js
```

提供工具：

- `query_tasks`
- `query_agents`
- `query_events`
- `query_overview`

---

## 4) Skill 接入

Skill 文件：

- `skills/query-assistant/SKILL.md`

触发场景：

- “查任务状态”
- “查某个 Agent 是否靠谱”
- “查某个任务的链上事件”

Skill 内部优先走 MCP，其次走 HTTP API。

