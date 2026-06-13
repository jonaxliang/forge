# 0016 Forge 自举 dogfood 准入

## Type

HITL

## What to build

定义并验证 Forge 从“本地 markdown issue 阶段”进入“使用 Forge 开发 Forge 阶段”的准入条件。完成后，后续开发应优先通过 Forge 自己的 Task Board、`.wf` 和 Bridge 执行。

## Acceptance criteria

- [ ] Forge 可以创建 Project。
- [ ] Forge 可以导入 `.wf`。
- [ ] Forge 可以从 Requirement 生成 Task Draft。
- [ ] Forge 可以批准 Task Draft 到 Task Board。
- [ ] Forge 可以启动 Task Workflow Run。
- [ ] Forge 可以通过 SSE 展示 Node Run 状态。
- [ ] Forge 可以通过 `forgecli` 连接本地 Bridge。
- [ ] Forge 可以通过 CLI 或 MCP Connector 执行至少一个本地 agent job。
- [ ] Forge 可以产出并展示 Artifact Version。
- [ ] 人工确认 Forge 已可用于管理下一批 Forge 开发任务。
- [ ] 创建 `forge-development.wf`，用于后续 dogfood。

## Blocked by

- [0008 Cat Factory Control Room 主视图](./0008-cat-factory-control-room.md)
- [0010 Exit Criteria 自评与 maxRetries](./0010-exit-criteria-retry.md)
- [0013 CLI Connector 执行本地 agent 命令](./0013-cli-connector-local-agent.md)
- [0014 MCP Connector 接入 Codex 风格 agent](./0014-mcp-connector-codex.md)
- [0015 内置三类 `.wf` 工作流文件](./0015-builtin-workflows.md)

## User stories covered

- 阶段三 dogfood 准入。

## Expected artifacts

- Self-hosting checklist
- `forge-development.wf`
- Human readiness review
