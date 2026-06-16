# 0003 `.wf` 导入、校验与预览

## Type

AFK

## What to build

实现 `.wf` 工作流文件的最小闭环：用户可以导入一个 YAML-like `.wf` 文件，Forge 校验 DAG、nodes、exit criteria 和 maxRetries，并在 Web 中展示解析后的节点预览。

## Acceptance criteria

- [x] `packages/core` 定义 `.wf` Zod schema。
- [x] `.wf` 模板面向 Task Workflow；历史 `scope` 字段仅做兼容读取。
- [x] 支持节点字段：`id`、`type`、`after` 或 `dependsOn`、`executor`、`outputs`、`exit.maxRetries`。
- [x] 校验 MVP 只允许 DAG，不允许循环。
- [x] Server 提供 `.wf` 导入 API，并保存 WorkflowFile metadata。
- [x] Web 提供 `.wf` 导入入口和节点预览。
- [x] 无效 `.wf` 能展示明确错误。
- [x] Vitest 覆盖 parser、DAG 校验和 API。

## Blocked by

- [0002 Project 创建与数据库策略选择](./0002-project-creation-db-strategy.md)

## User stories covered

- 33. 定义 Workflow Node
- 34. 通过 `.wf` 文件定义工作流

## Expected artifacts

- `.wf` parser
- WorkflowFile schema/API/UI
- DAG validation tests
