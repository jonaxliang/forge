# Forge 技术选型与架构决策

## 总体判断

Forge 第一版采用 Web Server + Local Agent Bridge 架构，不做桌面 App 优先。Forge 是 Web 控制平面，Local Agent Bridge 是本地常驻 daemon，`forgecli` 是本地命令行客户端，用于启动 daemon、绑定 Forge Server、注册本地 agent 并查看状态。

## 核心技术栈

```text
Language: TypeScript
Package Manager: pnpm workspace
Monorepo Runner: Turborepo
Frontend: React + Vite
Routing: TanStack Router
Server State: TanStack Query
Styling: Tailwind CSS
UI: Radix primitives / shadcn-style source components
Icons: lucide
Backend: Hono
Schema: Zod
ORM: Drizzle
Database: SQLite / Postgres / MySQL 初始化可选
Realtime: SSE first
CLI/Bridge: Node.js daemon, binary name forgecli
Testing: Vitest + Playwright
```

## Monorepo 结构

```text
apps/web
  Forge Web UI，包含 Task Board、Control Room、Artifact 管理、Agent 管理和 `.wf` 导入预览。

apps/server
  Hono API Server，负责 HTTP API、SSE、workflow orchestration、DB persistence、bridge job queue。

apps/cli
  `forgecli` 命令行工具，负责启动和管理 Local Agent Bridge daemon，并提供本地诊断命令。

packages/core
  纯领域逻辑：`.wf` 类型、Zod schema、DAG planning、Node Status 状态机、Exit Criteria 类型、Artifact domain 类型。

packages/db
  Drizzle schema、dialect adapter、migration、repository interface。

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
scope: task

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

Forge 初始化时允许选择数据库：

```text
Local default: SQLite
Remote/team: Postgres or MySQL
```

实现约束：

- 使用 Drizzle。
- 避免依赖单一数据库方言特性。
- ID 使用应用层生成的 text ID。
- JSON 字段通过兼容封装或 text + Zod parse 处理。
- timestamp 使用统一应用层 helper。
- 业务层不直接写方言 SQL。
- SQLite 至少作为本地和测试默认数据库。
- Postgres/MySQL 通过 CI service 或 docker compose 加入集成测试。

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
forgecli bridge bind --server http://localhost:3000

forgecli agent list
forgecli agent add codex --connector mcp --command "codex mcp-server"

forgecli doctor
forgecli logs
```

MVP 必须支持 macOS 和 Linux，Windows 尽量兼容但不阻塞首版。

## UI 原则

- 整体风格清爽、专业、低噪音。
- 不使用重型组件库。
- 采用 shadcn/ui 风格源码、Radix primitives、Tailwind CSS、lucide icons。
- Cat Factory View 是 Control Room 的默认交互隐喻，但状态、阻塞、日志、Artifact、审批和重跑控制必须保持清晰。

## 测试策略

```text
packages/core:
  Vitest 覆盖 .wf parser、DAG、状态机、retry、exit criteria 类型。

apps/server:
  Vitest + Hono test client 覆盖 API、workflow orchestration、SSE event 生成、bridge job queue。

apps/web:
  Vitest + Testing Library 覆盖关键组件行为。

apps/cli:
  Vitest + execa 覆盖 forgecli 参数解析、配置写入、bridge 状态命令。

E2E:
  Playwright 覆盖 Project 创建、Requirement -> Task Draft -> Task、Workflow Run、SSE 更新和 Control Room 展示。
```

## 当前已确认决策

- TypeScript monorepo。
- Hono + Drizzle + Zod。
- React + Vite + TanStack Router/Query。
- SQLite/Postgres/MySQL 初始化可选。
- `.wf` YAML-like 文件作为 workflow 核心定义。
- Workflow engine 放在 `packages/core`，保持纯逻辑。
- Web 实时用 SSE first。
- Local Agent Bridge 主动连接 Server。
- `forgecli` 管理常驻 daemon。
- UI 风格清爽，组件源码可控。
- 测试采用 Vitest + Playwright。
