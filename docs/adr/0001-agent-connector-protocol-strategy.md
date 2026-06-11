# Agent Connector Protocol Strategy

Forge will use Agent Connector as its stable abstraction for binding local and remote agents. The first supported connector path is MCP because Codex and other agent runtimes can expose local capabilities through MCP servers; CLI connectors provide a low-friction fallback for agents without protocol support, while A2A remains the forward-looking path for richer agent-to-agent discovery and delegation.
