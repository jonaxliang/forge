# 0012 Bridge 主动连接 Server 与 job 领取

## Type

AFK

## What to build

实现 Local Agent Bridge daemon 主动连接 Forge Server 的最小协议。Bridge 能注册、心跳、领取 job，并把执行事件回传给 Server。

## Acceptance criteria

- [ ] Server 提供 bridge register API。
- [ ] Server 提供 bridge heartbeat API。
- [ ] Server 提供 bridge job queue API 或 job SSE endpoint。
- [ ] Bridge daemon 启动后主动连接 Server。
- [ ] Bridge 能领取 pending Node Run job。
- [ ] Bridge 能回传 `node.status.changed` 和 `log.chunk` 事件。
- [ ] Server 不反连本机。
- [ ] 测试覆盖 register、heartbeat、job claim、event submit。

## Blocked by

- [0006 Workflow Run 与 Node Run 状态机闭环](./0006-workflow-run-node-state-machine.md)
- [0011 `forgecli` 与 Bridge daemon 本地启动](./0011-forgecli-bridge-daemon.md)

## User stories covered

- 14. Task 分配给已绑定 agent
- 15. 展示工作流进度

## Expected artifacts

- Bridge protocol APIs
- Bridge daemon job loop
- Integration tests
