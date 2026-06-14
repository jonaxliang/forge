# 0018 Agent Binding 注册与管理最小链路

## Type

AFK

## What to build

实现 Agent Binding 的最小可管理链路。用户可以在 Forge 中把本地或远端 agent 注册为 Hosted Agent，并在 Project 范围内查看其名称、Connector 类型、能力摘要和当前状态。

## Acceptance criteria

- [ ] Project 可以拥有多个 Agent Binding。
- [ ] Server 提供 Agent Binding 的创建、列表和基础更新 API。
- [ ] Web 提供 Agents 或 Settings 入口，能注册和查看 Agent Binding。
- [ ] Agent Binding 至少包含 `id`、`project_id`、`name`、`connector_type`、`capabilities[]`、`status`。
- [ ] SDK 暴露对应类型和 API helper。
- [ ] 测试覆盖注册、列表、无效 connector type 和 UI 展示。

## Blocked by

- [0002 Project 创建与数据库策略选择](./0002-project-creation-db-strategy.md)

