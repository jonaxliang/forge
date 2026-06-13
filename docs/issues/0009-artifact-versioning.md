# 0009 Artifact 与 Artifact Version 最小链路

## Type

AFK

## What to build

实现 Artifact 的最小版本化能力。Workflow Run 中的 Node Run 可以产出 Artifact Version，Task 详情页可以查看 Artifact、版本列表、当前版本和已接受版本。

## Acceptance criteria

- [ ] DB 支持 Artifact 和 ArtifactVersion。
- [ ] ArtifactVersion 不可变。
- [ ] Node Run 可以关联产出的 ArtifactVersion。
- [ ] 支持 `current_version_id` 和 `accepted_version_id`。
- [ ] 支持 Project 默认 Storage Mode 与 Artifact 覆盖 Storage Mode。
- [ ] local-only 模式保存 content_ref，不强制上传内容。
- [ ] Task Detail 展示 Artifact 列表和版本。
- [ ] 测试覆盖版本不可变和 storage mode override。

## Blocked by

- [0006 Workflow Run 与 Node Run 状态机闭环](./0006-workflow-run-node-state-machine.md)

## User stories covered

- 24. Artifact 版本化
- 31. local-only Artifact 模式
- 32. cloud Artifact 模式

## Expected artifacts

- Artifact schema/API/UI
- Versioning tests
- Storage mode handling
