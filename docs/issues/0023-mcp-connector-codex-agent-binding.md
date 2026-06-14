# 0023 MCP Connector 通过 Agent Binding 接入 Codex 风格 agent

## Type

HITL

## What to build

让 Codex 风格 MCP server 作为 MCP Connector Agent Binding 注册到 Forge，并执行一次真实 Node Run。该路径需要人工验证本地 Codex/MCP 行为。

## Acceptance criteria

- [ ] `forgecli agent add codex --connector mcp --command "codex mcp-server"` 注册 MCP Agent Binding。
- [ ] Bridge 能启动或连接 MCP server。
- [ ] Bridge 能发现 MCP tools 并同步到 Agent Binding capability metadata。
- [ ] Node Run 输入可以映射为 MCP tool call。
- [ ] MCP tool 输出可以回传为日志和 Artifact ref。
- [ ] Web 展示 Codex 风格 Hosted Agent 的能力和最近运行状态。
- [ ] 提供人工验证记录，说明真实 Codex/MCP 接入路径是否通过。

## Blocked by

- [0012 Bridge 主动连接 Server 与 job 领取](./0012-bridge-outbound-jobs.md)
- [0014 MCP Connector 接入 Codex 风格 agent](./0014-mcp-connector-codex.md)
- [0019 Workflow Node 分配 Agent Binding](./0019-workflow-node-agent-binding-assignment.md)
- [0020 Agent Connector metadata 与 capability registry](./0020-agent-connector-metadata-capability-registry.md)

