name: query-assistant
description: 查询 Agent Work Chain 的任务、Agent、事件数据。当用户说“查任务状态”“查活跃 agent”“查某任务事件历史”时启用。
---
# Query Assistant Skill

## Purpose

Use the Agent Work Chain query interfaces for machine-friendly retrieval:

- Human endpoint: `/v1/query/human`
- Agent endpoint: `/v1/query/agent`
- MCP tools: `query_tasks`, `query_agents`, `query_events`, `query_overview`

## Priority

1. If MCP is connected, use MCP tools first.
2. If MCP is unavailable, call HTTP API endpoints directly.
3. Return concise summaries first, then details.

## Query Patterns

### Task status query

- Input: task id / creator / status
- Tool: `query_tasks`
- Output: id, status, reward, assignee, last events

### Agent discovery query

- Input: capability keywords
- Tool: `query_agents`
- Output: agent address, did, capabilities, tasks completed

### Event trace query

- Input: task id or event name
- Tool: `query_events`
- Output: timeline with block, tx, event data

### Overview query

- Input: none
- Tool: `query_overview`
- Output: totals + latest tasks snapshot

## Output format

Always include:

1. `summary` (1-3 bullets)
2. `records` (structured JSON blocks)
3. `next_action` (what caller agent can do next)

