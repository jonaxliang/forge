# Workflow Engine 边界

Forge 的纯 workflow 逻辑放在 `packages/core`：包括 `.wf` 类型、校验、DAG planning、Node Status 状态机、Exit Criteria 类型和 Artifact domain 类型。`packages/core` 不访问 DB、HTTP 或本地进程；`apps/server` 负责持久化、编排、SSE fanout 和 bridge job queue；`apps/cli` 负责 Local Agent Bridge daemon、本地 connector 和进程执行。
