# Agent Connector 协议策略

Forge 使用 Agent Connector 作为绑定本地和远端 agent 的稳定抽象。首个支持路径是 MCP，因为 Codex 和其他 agent runtime 可以通过 MCP server 暴露本地能力；CLI connector 为不支持协议的 agent 提供低门槛兜底；A2A 则作为未来更丰富的 agent 发现和委派方向。
