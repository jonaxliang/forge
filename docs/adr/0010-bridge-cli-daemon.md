# Bridge CLI 与常驻 daemon

Forge 本地 agent 接入依赖常驻 Local Agent Bridge daemon。项目必须提供名为 `forgecli` 的本地 CLI，用于启动 daemon、绑定 Forge Server、注册本地 agent、查看连接状态、停止 daemon 和调试任务；daemon 是主路径，不以每次任务临时启动进程作为默认模型。MVP 必须支持 macOS 和 Linux，Windows 尽量兼容但不阻塞首版。
