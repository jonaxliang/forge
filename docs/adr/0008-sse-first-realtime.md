# SSE First 实时通信

Forge Web 前端第一版使用 SSE 接收 Workflow Run、Node Run、Artifact、日志和评审状态事件，用户控制操作继续走普通 HTTP API。SSE 更贴合 Forge 的 server-to-browser 推送需求，部署和重连模型也比 WebSocket 简单；WebSocket 可在后续需要低延迟双向协作时再引入。
