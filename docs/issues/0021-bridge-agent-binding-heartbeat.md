# 0021 Bridge 注册 Agent Binding 与心跳状态同步

## Type

AFK

## What to build

让 Local Agent Bridge daemon 主动连接 Forge Server 后，能够注册或关联 Agent Binding，并通过心跳同步 Hosted Agent 的在线状态。

## Acceptance criteria

- [ ] Bridge register API 可以创建或关联 Agent Binding。
- [ ] Bridge heartbeat 会更新 Agent Binding 状态和最近在线时间。
- [ ] Server 不反连用户本机。
- [ ] Web 能展示 Bridge 同步后的 Agent Binding 在线、离线或错误状态。
- [ ] Bridge token 或设备标识不会暴露在普通列表 API 中。
- [ ] 测试覆盖 register、heartbeat、状态过期和错误输入。

## Blocked by

- [0011 `forgecli` 与 Bridge daemon 本地启动](./0011-forgecli-bridge-daemon.md)
- [0012 Bridge 主动连接 Server 与 job 领取](./0012-bridge-outbound-jobs.md)
- [0018 Agent Binding 注册与管理最小链路](./0018-agent-binding-registration.md)

