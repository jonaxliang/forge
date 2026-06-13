# 0002 Project 创建与数据库策略选择

## Type

AFK

## What to build

实现第一个可持久化的端到端业务切片：用户可以在 Web 中创建 Project，并选择 Artifact Storage Mode 与数据库策略。Server 使用 Drizzle 持久化 Project，Web 展示 Project 列表和创建结果。

## Acceptance criteria

- [ ] `packages/db` 定义 Project schema，兼容 SQLite/Postgres/MySQL 设计约束。
- [ ] 本地默认使用 SQLite。
- [ ] Server 提供创建 Project 和查询 Project 列表 API。
- [ ] Web 提供 Project 创建表单。
- [ ] 表单允许选择 `local-only` 或 `cloud` Artifact Storage Mode。
- [ ] 初始化配置中预留 `sqlite`、`postgres`、`mysql` DB strategy 字段。
- [ ] 创建成功后 Project 出现在 Project 列表。
- [ ] Vitest 覆盖 Project API 与 DB 持久化。

## Blocked by

- [0001 初始化 monorepo 与本地开发闭环](./0001-bootstrap-monorepo.md)

## User stories covered

- 1. 创建 Project
- 2. 选择 Project Artifact 存储模式

## Expected artifacts

- Project schema
- Project API
- Project 创建 UI
- SQLite 集成测试
