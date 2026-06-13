# 0010 Exit Criteria 自评与 maxRetries

## Type

AFK

## What to build

实现节点准出条件的最小闭环。Node 执行完成后进入 reviewing，由 Same Agent 或 mock reviewer 根据自然语言 Exit Criteria 生成通过/不通过结果；不通过时按 `maxRetries` 重试，耗尽后进入 blocked 或 failed。

## Acceptance criteria

- [ ] `.wf` 支持 `exit.review`、`exit.maxRetries`、`exit.retryInstruction`。
- [ ] Node Run 记录 retry count 和 exit review result。
- [ ] 默认 reviewer 是 Same Agent。
- [ ] mock reviewer 可以模拟 pass/fail。
- [ ] fail 时按 maxRetries 重试。
- [ ] 超过 maxRetries 后 Node Run 进入 blocked 或 failed。
- [ ] Task Detail 展示 exit review 和 retry history。
- [ ] 测试覆盖 pass、retry、exhausted 三种路径。

## Blocked by

- [0009 Artifact 与 Artifact Version 最小链路](./0009-artifact-versioning.md)

## User stories covered

- 19. Node 定义 Exit Criteria
- 20. Exit Criteria 支持自然语言 rubric
- 21. 最大重试次数

## Expected artifacts

- Exit criteria evaluator interface
- Retry state machine
- Exit review UI
