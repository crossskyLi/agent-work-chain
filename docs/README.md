# Docs 导航

本目录存放对协作开发者公开的项目文档。  
目标是让新成员先“快速跑通”，再“按主题深入”。

## 新手必看（4 个入口）

1. `../README.md`  
   项目总览、快速开始与目录结构。
2. `../DEVELOPMENT.md`  
   日常开发命令、联调路径、排障与协作约定。
3. `architecture.md`  
   五层信任架构与关键技术选型。
4. `api.md`  
   Indexer/Query API 的查询参数与返回结构。

## 进阶文档

- `blockchain-integration.md`：链上组件与集成实现细节
- `deployment.md`：部署流程与环境变量配置
- `mcp-and-skill.md`：MCP 与 Skill 接入方式
- `decisions/README.md`：架构与策略决策（ADR）
- `playbooks/README.md`：可执行操作手册（SOP / Runbook）

## 文档分层规则

- 共享文档：放在 `docs/`，纳入版本管理。
- 本地私有文档：放在 `docs/internal/`（`.gitignore` 已忽略）。
- 非共享的经济/运营草稿：放在 `docs/economics/`（本地保留，不纳入版本管理）。

## 更新建议

- 涉及接口变化：同步更新 `api.md` 与示例调用。
- 涉及架构变化：同步更新 `architecture.md` 或补充 `decisions/`。
- 涉及流程变化：同步更新 `playbooks/`。

