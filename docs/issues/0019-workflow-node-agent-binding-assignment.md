# 0019 Workflow Node 分配 Agent Binding

## Type

AFK

## What to build

让 Task Workflow Run 在创建 Node Run 时记录被分配的 Agent Binding。用户可以为 Task Workflow 选择默认 Agent Binding，Forge 在 Control Room 中展示每个 Node Run 的绑定 agent。

## Acceptance criteria

- [ ] 启动 Task Workflow Run 时可以传入或解析默认 Agent Binding。
- [ ] Node Run 持久化 `assigned_agent_binding_id`。
- [ ] Server 在 Workflow Run 查询结果中返回 Node Run 的 Agent Binding 信息或 ID。
- [ ] Control Room 展示 Node Run 分配的 Hosted Agent。
- [ ] 未配置 Agent Binding 时给出明确阻塞状态，不再依赖全局 local Agent proxy 作为领域概念。
- [ ] 测试覆盖成功分配、缺失 binding、Task 不存在和无效 Workflow File。

## Blocked by

- [0018 Agent Binding 注册与管理最小链路](./0018-agent-binding-registration.md)
- [0006 Workflow Run 与 Node Run 状态机闭环](./0006-workflow-run-node-state-machine.md)
- [0017 禁止孤儿 Task Workflow Run](./0017-prevent-orphan-workflow-runs.md)
