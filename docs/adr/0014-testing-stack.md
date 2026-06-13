# 测试技术栈

Forge 测试采用 Vitest + Playwright。Vitest 覆盖 `packages/core` 纯逻辑、Hono API integration、前端关键组件和 `forgecli` 命令行为；Playwright 覆盖端到端流程，例如 Project 创建、Requirement 到 Task Draft、Task 运行、SSE 状态更新和 Control Room 展示。数据库集成测试至少覆盖 SQLite，Postgres/MySQL 通过 CI service 或 docker compose 逐步加入。
