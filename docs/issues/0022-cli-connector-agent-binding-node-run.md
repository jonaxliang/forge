# 0022 CLI Connector 通过 Agent Binding 执行 Node Run

## Type

AFK

## What to build

让已分配到 CLI Connector Agent Binding 的 Node Run 通过 Bridge 执行本地命令，并把状态、日志和最小 Artifact ref 回传 Forge。

## Acceptance criteria

- [ ] Node Run 根据 `assigned_agent_binding_id` 路由到 CLI Connector。
- [ ] Bridge 执行绑定的本地命令并捕获 stdout、stderr 和退出码。
- [ ] 命令成功映射为 Node Run succeeded，失败映射为 failed 或 blocked。
- [ ] Server 接收并持久化状态事件、日志引用和最小 Artifact ref。
- [ ] Control Room 能看到执行进度和结果。
- [ ] 测试覆盖成功命令、失败命令、日志回传和 Artifact ref 回传。

## Blocked by

- [0012 Bridge 主动连接 Server 与 job 领取](./0012-bridge-outbound-jobs.md)
- [0013 CLI Connector 执行本地 agent 命令](./0013-cli-connector-local-agent.md)
- [0019 Workflow Node 分配 Agent Binding](./0019-workflow-node-agent-binding-assignment.md)
- [0020 Agent Connector metadata 与 capability registry](./0020-agent-connector-metadata-capability-registry.md)

