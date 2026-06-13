# 0017 禁止孤儿 Task Workflow Run

## Type

AFK

## Priority

P0

## What to build

启动或查询 Task Workflow Run 前，Server 必须确认 Task 存在。不存在的 Task 不能创建 WorkflowRun 或 NodeRun，避免后续 SSE、Artifact、Bridge job 读取到无法归属的运行记录。

## Acceptance criteria

- [x] TaskRepository 支持按 id 查询 Task。
- [x] `POST /tasks/:id/workflow-runs` 在 Task 不存在时返回 404。
- [x] `GET /tasks/:id/workflow-runs` 在 Task 不存在时返回 404。
- [x] 不存在 Task 时不会创建孤儿 WorkflowRun。
- [x] 测试覆盖仓储查询和 API 拒绝路径。

## Blocked by

- [0006 Workflow Run 与 Node Run 状态机闭环](./0006-workflow-run-node-state-machine.md)

## User stories covered

- 10. 指定 Task Workflow Template
- 14. Task 分配给 agent 执行 Workflow Node

## Expected artifacts

- Task existence guard
- 404 API behavior
- Regression tests
