# Local Bridge 主动连接

Forge Local Agent Bridge 采用主动连接 Server 的模型。Bridge 负责注册、心跳、领取 job、执行本地 agent、回传事件和产物；Forge Server 不反连用户本机。这个模型避免内网穿透和本机端口暴露，适合本地部署与远端团队部署，同时让安全边界集中在 Bridge token、能力白名单和审计事件上。
