# 0007 SSE 驱动的 Control Room 实时状态

## Type

AFK

## What to build

实现 Workflow Run 事件流。Server 在 Node Run 状态变化、日志追加、Artifact 创建和运行完成时发送 SSE 事件，Web 订阅事件并更新 Task Detail。

## Acceptance criteria

- [ ] Server 提供 `GET /api/runs/:id/events` SSE endpoint。
- [ ] 支持事件：`node.status.changed`、`log.chunk`、`artifact.created`、`run.completed`。
- [ ] Web 在 Task Detail 订阅 Workflow Run events。
- [ ] SSE 事件能更新 TanStack Query cache 或本地 run state。
- [ ] 连接断开后能重连并恢复当前状态。
- [ ] 测试覆盖 SSE event 生成。
- [ ] Playwright 或集成测试验证 UI 状态会随事件更新。

## Blocked by

- [0006 Workflow Run 与 Node Run 状态机闭环](./0006-workflow-run-node-state-machine.md)

## User stories covered

- 15. 展示工作流进度
- 18. 每个节点显示状态、日志、Artifact、重试和阻塞原因

## Expected artifacts

- SSE API
- Frontend run event subscription
- SSE integration tests
