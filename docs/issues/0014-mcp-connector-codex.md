# 0014 MCP Connector 接入 Codex 风格 agent

## Type

HITL

## What to build

实现 MCP Connector 的第一版，用于接入 Codex 风格的 MCP server。用户可以通过 `forgecli` 注册 MCP agent，Bridge 能调用 MCP tool 执行 Node Run，并回传日志与 Artifact ref。

## Acceptance criteria

- [ ] 支持 `forgecli agent add codex --connector mcp --command "codex mcp-server"`。
- [ ] Bridge 能启动或连接 MCP server。
- [ ] Bridge 能发现 MCP tools。
- [ ] Bridge 能把 Node Run 输入映射为 MCP tool call。
- [ ] Bridge 能接收 MCP tool 输出并回传 Server。
- [ ] Server/Web 展示 MCP agent capability。
- [ ] 提供一个本地可运行的 Codex 风格接入示例。
- [ ] 需要人工验证真实 Codex/MCP 接入路径。

## Blocked by

- [0012 Bridge 主动连接 Server 与 job 领取](./0012-bridge-outbound-jobs.md)

## User stories covered

- 11. 绑定本地 Codex agent 到 Forge
- 13. Forge 发现 agent 能力

## Expected artifacts

- MCP Connector
- Codex-style connector example
- Manual verification notes
