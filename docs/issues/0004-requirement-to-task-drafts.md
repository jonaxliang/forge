# 0004 Requirement 到 Task Draft 的最小拆解链路

## Type

AFK

## What to build

实现从 Requirement 到 Task Draft 的最小工作链路。用户创建 Requirement，选择一个 requirement-scope `.wf`，Server 使用一个 mock agent executor 执行拆解节点，生成 Task Draft。

## Acceptance criteria

- [x] DB 支持 Requirement 和 TaskDraft。
- [x] Web 提供创建 Requirement 的表单。
- [x] 创建 Requirement 时可以选择已导入的 requirement-scope `.wf`。
- [x] Server 能启动一个最小 Requirement Workflow Run。
- [x] 使用 mock executor 生成至少一个 Task Draft。
- [x] 用户能看到 Task Draft 列表。
- [x] 失败时 Requirement 显示错误状态。
- [x] 测试覆盖 Requirement 创建、workflow 执行和 Task Draft 生成。

## Blocked by

- [0003 `.wf` 导入、校验与预览](./0003-workflow-file-import-preview.md)

## User stories covered

- 3. 创建 Requirement
- 4. 选择 Requirement Workflow Template
- 5. 生成 Task Draft

## Expected artifacts

- Requirement API/UI
- TaskDraft schema/API/UI
- Mock workflow executor
