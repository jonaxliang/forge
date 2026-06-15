# 0011 `forgecli` 与 Bridge daemon 本地启动

## Type

AFK

## What to build

实现 `forgecli` 的最小本地客户端。用户可以通过 CLI 启动、停止、查看 Local Agent Bridge daemon 状态，并把本地 CLI 绑定到 Forge Server。

## Acceptance criteria

- [ ] `apps/forgecli` 生成 `forgecli` binary。
- [ ] 支持 `forgecli bridge start`。
- [ ] 支持 `forgecli bridge stop`。
- [ ] 支持 `forgecli bridge status`。
- [ ] 支持 `forgecli bridge bind --server <url>`。
- [ ] CLI 配置保存到用户本地配置目录。
- [ ] daemon 能写入 pid/status/log。
- [ ] macOS/Linux 可用，Windows 不阻塞。
- [ ] Vitest + execa 覆盖命令参数和配置写入。

## Blocked by

- [0001 初始化 monorepo 与本地开发闭环](./0001-bootstrap-monorepo.md)

## User stories covered

- 11. 绑定本地 Codex agent 到 Forge
- 12. 通过 CLI 命令绑定其他本地 agent

## Expected artifacts

- `forgecli` binary
- Bridge daemon skeleton
- CLI tests
