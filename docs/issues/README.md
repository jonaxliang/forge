# Forge 本地 Issue 拆解

这些 markdown issue 用来模拟 Forge 第一阶段的 `Task`。执行方式是 issue-driven：每个 issue 都应能被 AI agent 或人类开发者独立领取，并产出可验证 Artifact。

## 阶段原则

- 阶段一只使用本地 markdown issue 管理开发。
- issue 应尽量是 tracer-bullet：贯穿 schema、API、UI、测试或 CLI 的最小可演示路径。
- 完成每个 issue 后，应更新对应文档、测试和验收记录。
- 当 Forge 具备最小自举能力后，迁移到阶段三：使用 Forge 自己的 `.wf` workflow 和 Task Board 开发 Forge。

## Issue 列表

1. [0001 初始化 monorepo 与本地开发闭环](./0001-bootstrap-monorepo.md)
2. [0002 Project 创建与数据库策略选择](./0002-project-creation-db-strategy.md)
3. [0003 `.wf` 导入、校验与预览](./0003-workflow-file-import-preview.md)
4. [0004 Requirement 到 Task Draft 的最小拆解链路](./0004-requirement-to-task-drafts.md)
5. [0005 Task Draft 审批进入 Task Board](./0005-task-drafts-to-task-board.md)
6. [0006 Workflow Run 与 Node Run 状态机闭环](./0006-workflow-run-node-state-machine.md)
7. [0007 SSE 驱动的 Control Room 实时状态](./0007-sse-control-room-events.md)
8. [0008 Cat Factory Control Room 主视图](./0008-cat-factory-control-room.md)
9. [0009 Artifact 与 Artifact Version 最小链路](./0009-artifact-versioning.md)
10. [0010 Exit Criteria 自评与 maxRetries](./0010-exit-criteria-retry.md)
11. [0011 `forgecli` 与 Bridge daemon 本地启动](./0011-forgecli-bridge-daemon.md)
12. [0012 Bridge 主动连接 Server 与 job 领取](./0012-bridge-outbound-jobs.md)
13. [0013 CLI Connector 执行本地 agent 命令](./0013-cli-connector-local-agent.md)
14. [0014 MCP Connector 接入 Codex 风格 agent](./0014-mcp-connector-codex.md)
15. [0015 内置三类 `.wf` 工作流文件](./0015-builtin-workflows.md)
16. [0016 Forge 自举 dogfood 准入](./0016-self-hosting-readiness.md)
17. [0017 禁止孤儿 Task Workflow Run](./0017-prevent-orphan-workflow-runs.md)

## 建议执行顺序

```text
0001
  -> 0002
    -> 0003
      -> 0004
        -> 0005
          -> 0006
            -> 0007
              -> 0008
            -> 0009
              -> 0010
            -> 0017
  -> 0011
    -> 0012
      -> 0013
      -> 0014
  -> 0015
    -> 0016
```
