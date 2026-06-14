# 0020 Agent Connector metadata 与 capability registry

## Type

AFK

## What to build

为 Agent Binding 增加 Connector metadata 和 capability registry。Forge 能保存 MCP、CLI、HTTP/SSE 等 Connector 的最小配置，并用能力摘要辅助用户选择合适的 Hosted Agent。

## Acceptance criteria

- [ ] Agent Binding 支持 `connector_type` 对应的 metadata。
- [ ] 支持 MCP 和 CLI 的最小 metadata 校验。
- [ ] capabilities 可以保存并在 API、SDK、Web 中展示。
- [ ] Web 能区分可执行、离线、配置不完整等状态。
- [ ] 不要求真实执行 agent；本 issue 只交付可注册、可展示、可验证的 metadata。
- [ ] 测试覆盖 metadata 校验、capability 序列化和 UI 展示。

## Blocked by

- [0018 Agent Binding 注册与管理最小链路](./0018-agent-binding-registration.md)

