# Forge 技术选型与架构决策

> 状态：本文描述当前已实现架构。未实现的备选方案不作为当前能力。
> 当前能力和运行方式以仓库根目录 README 为准。

## 总体判断

Forge 第一版采用 Web Server + Local Agent Bridge 架构，不做桌面 App 优先。Forge 是 Web 控制平面，Local Agent Bridge 是本地常驻 daemon，`forgecli` 是本地命令行客户端，用于启动 daemon、绑定 Forge Server、注册本地 agent 并查看状态。

## 核心技术栈

```text
Language: TypeScript
Package Manager: pnpm workspace
Monorepo Runner: Turborepo
Frontend: React + Vite
Routing: History API + local route helpers
Server State: React state + typed SDK calls
Styling: CSS
UI: local React components + packages/ui
Backend: Hono
Schema: Zod
ORM: Drizzle
Database: SQLite
Realtime: SSE first
CLI/Bridge: Node.js daemon, binary name forgecli
Testing: Vitest; Playwright dependency reserved for E2E coverage
```

## Monorepo 结构

```text
apps/forge
  Forge 主体，包含 Hono API Server 和 React + Vite Web 控制台源码。Server 负责 HTTP API、SSE、workflow orchestration、DB persistence、bridge job queue，并在生产态托管 Web 控制台。

apps/forgecli
  `forgecli` 命令行工具，负责启动和管理 Local Agent Bridge daemon，并提供本地诊断命令。

packages/core
  纯领域逻辑：`.wf` 类型、Zod schema、DAG planning、Node Status 状态机、Exit Criteria 类型、Artifact domain 类型。

packages/db
  SQLite、Drizzle schema、migration 和 repository 实现。

packages/sdk
  Agent Connector SDK、Workflow File loader、Artifact Publisher extension point。

packages/ui
  清爽、专业、低噪音的共享 UI 组件。
```

## Web Server 与 Bridge 模型

```text
Browser
  -> Forge Server
    -> DB
    -> Workflow Engine
    -> SSE events
    -> Bridge job queue

forgecli
  -> starts Local Agent Bridge daemon

Local Agent Bridge daemon
  -> outbound connect to Forge Server
  -> register / heartbeat / subscribe jobs
  -> execute local agent via MCP or CLI
  -> send node events / logs / artifact refs back
```

Forge Server 不反连用户本机。Bridge 主动连接 Server，避免内网穿透、本机端口暴露和复杂网络配置。

## `.wf` 工作流文件

`.wf` 是 Forge 工作流定义、导入、分享和版本化的核心单位。格式采用 YAML-like 语法，MVP 只支持 DAG 和节点内 `maxRetries`，不支持任意循环、`goto` 或运行时动态生成节点。

示例：

```yaml
name: software.change

inputs:
  task: required
  repo: optional

nodes:
  - id: plan
    type: agent
    executor:
      role: planner
      skill: skills/software-plan.md
    outputs:
      - artifact: implementation_plan
    exit:
      review: prompts/plan-review.md
      maxRetries: 2

  - id: implement
    type: agent
    after: plan
    executor:
      role: executor
      skill: skills/code-change.md
    outputs:
      - artifact: patch
      - artifact: test_report
    exit:
      review: prompts/code-review.md
      maxRetries: 3
```

## 数据库策略

当前版本只实现 SQLite。项目记录、工作流定义、节点输出、本地桥接输出和执行配置
都由 Forge Server 保存到同一个 SQLite 数据库。Postgres、MySQL 和云端产物存储
尚未实现，也不在当前 UI 中作为可选后端展示。

实现约束：

- 使用 Drizzle 和 `better-sqlite3`。
- ID 使用应用层生成的 text ID。
- JSON 字段通过 text + Zod parse 处理。
- timestamp 使用统一应用层 helper。
- SQLite 同时作为本地运行和测试数据库。

## 实时通信

Web 前端使用 SSE 接收服务端事件：

```text
node.status.changed
log.chunk
artifact.created
exit.reviewed
human.review.waiting
run.completed
```

用户操作走 HTTP API：

```text
POST /api/runs/:id/start
POST /api/node-runs/:id/rerun
POST /api/node-runs/:id/approve
POST /api/node-runs/:id/request-changes
```

## Agent Connector

第一版 connector 策略：

```text
MCP Connector: 优先路径，适配 Codex 等 MCP server
CLI Connector: 兜底路径，适配可通过命令调用的本地 agent
HTTP/SSE Connector: 后续支持本地或远端常驻 bridge
A2A Connector: 未来支持 richer agent-to-agent interoperability
```

## `forgecli`

CLI 命令建议：

```bash
forgecli bridge start
forgecli bridge stop
forgecli bridge status
forgecli bridge bind --server http://localhost:3001

forgecli agent list
forgecli agent add codex --connector mcp --command "codex mcp-server"

forgecli doctor
forgecli logs
```

MVP 必须支持 macOS 和 Linux，Windows 尽量兼容但不阻塞首版。

## UI 原则

- 整体风格清爽、专业、低噪音。
- 不使用重型组件库。
- 使用仓库内 React 组件和 CSS，避免仅为视觉样式引入大型组件库。
- Cat Factory View 是 Control Room 的默认交互隐喻，但状态、阻塞、日志、Artifact、审批和重跑控制必须保持清晰。

## 测试策略

```text
packages/core:
  Vitest 覆盖 .wf parser、DAG、状态机、retry、exit criteria 类型。

apps/forge:
  Vitest + Hono test client 覆盖 API、workflow orchestration、SSE event 生成、bridge job queue。
  Vitest + Testing Library 覆盖关键 Web 组件行为。

apps/forgecli:
  Vitest + execa 覆盖 forgecli 参数解析、配置写入、bridge 状态命令。

E2E:
  当前没有维护中的 Playwright E2E 套件；加入后应覆盖 Project、Requirement、
  Task、Workflow Run 和 SSE 的关键路径。
```

## 当前已确认决策

- TypeScript monorepo。
- Hono + Drizzle + Zod。
- React + Vite，使用本地路由 helper、React state 和 typed SDK calls。
- SQLite 是当前唯一数据库后端。
- `.wf` YAML-like 文件作为 workflow 核心定义。
- Workflow engine 放在 `packages/core`，保持纯逻辑。
- Web 实时用 SSE first。
- Local Agent Bridge 主动连接 Server。
- `forgecli` 管理常驻 daemon。
- UI 使用仓库内组件和 CSS。
- 当前测试采用 Vitest；Playwright E2E 覆盖仍待补充。
