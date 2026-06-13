# 0013 CLI Connector 执行本地 agent 命令

## Type

AFK

## What to build

实现 CLI Connector。用户可以注册一个本地命令作为 agent，Bridge 领取 Node Run job 后调用该命令，将输入传给命令，并把 stdout/stderr/log/artifact ref 回传 Forge Server。

## Acceptance criteria

- [ ] 支持 `forgecli agent add <name> --connector cli --command <command>`。
- [ ] Bridge 能保存 agent capability metadata。
- [ ] Server 能展示已注册 agent。
- [ ] Node Run 可指定 CLI agent。
- [ ] Bridge 执行本地命令并捕获 stdout/stderr。
- [ ] 命令退出码映射为 Node Run success/failure。
- [ ] 支持最小 artifact ref 回传。
- [ ] 测试覆盖成功命令、失败命令和日志回传。

## Blocked by

- [0012 Bridge 主动连接 Server 与 job 领取](./0012-bridge-outbound-jobs.md)

## User stories covered

- 12. 通过 CLI 命令绑定其他本地 agent
- 13. Forge 发现 agent 能力

## Expected artifacts

- CLI Connector
- Agent registration UI/API
- Local command execution tests
