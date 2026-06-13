# 0015 内置三类 `.wf` 工作流文件

## Type

AFK

## What to build

提供三类内置 `.wf` 文件，证明 Forge 不是 coding-only：Software Change、Research & Writing、Creative Writing。每个 `.wf` 都必须能被导入、预览，并在 mock executor 下跑通最小 workflow。

## Acceptance criteria

- [ ] 提供 software change requirement-scope `.wf`。
- [ ] 提供 software change task-scope `.wf`。
- [ ] 提供 research writing requirement-scope `.wf`。
- [ ] 提供 research writing task-scope `.wf`。
- [ ] 提供 creative writing requirement-scope `.wf`。
- [ ] 提供 creative writing task-scope `.wf`。
- [ ] 所有内置 `.wf` 通过 parser 和 DAG 校验。
- [ ] Web 可以选择这些内置 workflow。
- [ ] 至少一个 coding workflow 和一个 non-coding workflow 能跑通 mock demo。

## Blocked by

- [0003 `.wf` 导入、校验与预览](./0003-workflow-file-import-preview.md)
- [0006 Workflow Run 与 Node Run 状态机闭环](./0006-workflow-run-node-state-machine.md)

## User stories covered

- 27. 软件改动模板
- 28. 研究写作模板
- 29. 创意写作模板

## Expected artifacts

- Built-in `.wf` files
- Workflow examples
- Parser validation tests
