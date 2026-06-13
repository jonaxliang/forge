# 0008 Cat Factory Control Room 主视图

## Type

HITL

## What to build

实现 Cat Factory View 的第一版可用界面。Workflow Node 显示为工位，agent 显示为工作角色，Artifact 显示为工件；同时必须保留专业控制信息，包括状态、日志、重试、阻塞和评审操作入口。

## Acceptance criteria

- [ ] Task Detail 默认展示 Cat Factory Control Room。
- [ ] 每个 Node Run 显示为工位，并映射 9 种 Node Status。
- [ ] 当前运行节点有明确视觉状态。
- [ ] 节点详情面板展示日志、Artifact、重试次数、阻塞原因。
- [ ] UI 风格清爽、专业、低噪音，不玩具化。
- [ ] 用户可以从工位打开节点详情。
- [ ] Playwright 截图或 E2E 验证关键状态可见。
- [ ] 需要人工确认视觉方向后再进入完成状态。

## Blocked by

- [0007 SSE 驱动的 Control Room 实时状态](./0007-sse-control-room-events.md)

## User stories covered

- 16. Control Room 把节点显示为工厂工位
- 17. agent 在 Cat Factory View 中表现为工作角色
- 18. 专业控制不被视觉隐喻遮蔽

## Expected artifacts

- Cat Factory UI components
- Node detail panel
- E2E visual verification
