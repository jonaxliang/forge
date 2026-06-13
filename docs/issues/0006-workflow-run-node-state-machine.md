# 0006 Workflow Run 与 Node Run 状态机闭环

## Type

AFK

## What to build

实现 Task Workflow Run 的最小状态机。用户可以从 Task 详情页启动 task-scope `.wf`，Server 创建 Workflow Run 和 Node Run，并按 DAG 顺序推进节点状态。

## Acceptance criteria

- [ ] `packages/core` 定义 Node Status：`idle`、`queued`、`running`、`waiting`、`blocked`、`reviewing`、`failed`、`succeeded`、`skipped`。
- [ ] `packages/core` 提供 DAG planning 和 next-node 纯逻辑。
- [ ] DB 支持 WorkflowRun 和 NodeRun。
- [ ] Server 提供启动 Workflow Run API。
- [ ] 使用 mock executor 推进一个 task-scope workflow。
- [ ] Task Detail 展示当前 Workflow Run 和 Node Run 列表。
- [ ] 测试覆盖状态转换和 DAG 执行顺序。

## Blocked by

- [0005 Task Draft 审批进入 Task Board](./0005-task-drafts-to-task-board.md)

## User stories covered

- 10. 指定 Task Workflow Template
- 14. Task 分配给 agent 执行 Workflow Node
- 23. 节点失败后进入 blocked 或 failed

## Expected artifacts

- WorkflowRun/NodeRun schema
- Core state machine
- Task Detail run view
