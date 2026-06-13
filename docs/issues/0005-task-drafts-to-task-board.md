# 0005 Task Draft 审批进入 Task Board

## Type

AFK

## What to build

实现 Task Draft 的人工整理与批准流程。用户可以编辑、删除、排序、批准 Task Draft；批准后 Task 出现在 Task Board。

## Acceptance criteria

- [x] Web 支持编辑 Task Draft 标题和描述。
- [x] Web 支持删除 Task Draft。
- [x] Web 支持调整 Task Draft 顺序。
- [x] Server 提供批准 Task Draft 的 API。
- [x] 批准后创建正式 Task，并保留 Requirement 关联。
- [x] Task Board 显示 Task 状态列。
- [x] Task card 显示标题、状态、来源 Requirement。
- [x] 测试覆盖 Task Draft 到 Task 的转换。

## Blocked by

- [0004 Requirement 到 Task Draft 的最小拆解链路](./0004-requirement-to-task-drafts.md)

## User stories covered

- 6. 编辑 Task Draft
- 7. 合并、删除和排序 Task Draft
- 8. 批准 Task Draft
- 9. 使用 Task Board

## Expected artifacts

- Task schema/API
- Task Board UI
- Task Draft approval tests
