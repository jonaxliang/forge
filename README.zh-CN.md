<div align="center">
  <img src="./apps/forge/web/public/brand/forge-cat-logo-256.png" alt="Forge logo" width="88" />
  <h1>Forge</h1>
  <p><strong>Agentic work loop 的控制平面。</strong></p>
  <p>
    把一个需求变成可治理的 Loop：任务、任务工作流、Agent 执行、产物、评审、重试与验收。
  </p>
  <p>
    <a href="./README.md">English</a> ·
    <a href="./README.zh-CN.md">中文</a>
  </p>
  <p>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-ESM-3178c6" />
    <img alt="pnpm" src="https://img.shields.io/badge/pnpm-9-f69220" />
    <img alt="Local first" src="https://img.shields.io/badge/local--first-SQLite-0f766e" />
    <img alt="Workflow files" src="https://img.shields.io/badge/workflows-.wf-111827" />
    <img alt="Agent connectors" src="https://img.shields.io/badge/agents-CLI%20%7C%20MCP-0f766e" />
  </p>
</div>

![Forge 任务看板](./docs/assets/forge-control-room.png)

Forge 不是另一个聊天窗口、执行界面或 Agent runtime。它是本地与远端 Agent 之外缺失的操作层：项目、需求、任务、`.wf` 工作流模板、Agent 绑定、节点执行、产物和明确的人工验收。

## The Loop

多数 Agent 工具优化的是一次执行。Forge 管理的是每次执行外面的 Loop。

```text
需求
  -> 拆解结果
  -> 任务
  -> 任务工作流
  -> 节点执行
  -> 产物版本
  -> 评审 / 重试 / 验收
  -> 带着历史进入下一次执行
```

| Loop 层级 | Forge 追踪什么 | 为什么重要 |
| --- | --- | --- |
| 意图 | 需求与拆解结果 | 工作从目标开始，而不是丢在聊天记录里的 prompt |
| 计划 | 任务与依赖关系 | 生成出来的工作可以编辑、排序和确认 |
| 执行 | 任务工作流与节点执行 | Agent 工作可见、可重试、可检查 |
| 证据 | 产物版本与执行日志 | 输出不会随着聊天或 CLI 会话结束而消失 |
| 判断 | 验收条件与人工评审 | 完成是一次验收决策，不只是进程退出码 |

本地桥接负责执行：模型凭证、工具、文件、命令、worktree 和外部服务。Forge 负责这些执行之外的控制平面。

## 为什么需要 Forge

- **聊天不保存可运营上下文。** Forge 把状态、负责人、重试、产物和验收决策绑定到项目。
- **单个 Agent 不等于工作流。** Forge 把可复用 `.wf` 工作流模板变成 DAG Loop，支持节点级重试和评审点。
- **本地执行也需要协调。** Forge 可以把工作分配给本地 CLI 或 MCP Agent，但不接管它们的运行时和凭证。
- **输出需要生命周期。** Forge 把输出作为带版本、评审状态和验收路径的产物管理。

## 你会得到什么

- 面向浏览器的控制平面：管理需求、任务、工作流模板、Agent 绑定、Skill、产物和设置。
- 任务看板：扫描生成任务并启动任务工作流。
- 任务工作流视图：检查节点状态、执行 Agent、执行日志、产物、重试、等待状态和阻塞原因。
- 通过 `forgecli` 本地桥接执行工作。
- 基于 Vercel AI SDK 的模型配置：OpenAI、Anthropic、Google Gemini、Mistral、Groq、DeepSeek、OpenRouter、Ollama、LM Studio 和 OpenAI-compatible 端点。
- TypeScript monorepo：`packages/core` 放纯工作流/领域逻辑，`packages/db` 放持久化，`packages/sdk` 提供 typed SDK。

## Quickstart

环境要求：

- Node.js 22+
- pnpm 9+

本地运行 Forge：

```bash
pnpm install
pnpm start
```

打开：

```text
http://localhost:3001
```

Forge 的 Web 控制台和 API 使用同一个端口。API 路由位于 `/api/*`，例如：

```text
http://localhost:3001/api/health
```

开发 watch 模式：

```bash
pnpm --filter @forge/forge dev
```

浏览器地址仍然是 `http://localhost:3001`；正常 Forge 开发不使用单独的 Vite 浏览器端口。

## 连接 Agent

构建 `forgecli`、绑定本地桥接、注册 Agent，并开始轮询工作：

```bash
pnpm build:forgecli
apps/forgecli/dist/index.js bridge bind --server http://localhost:3001
apps/forgecli/dist/index.js agent add codex --connector mcp --command "codex mcp-server" --tool codex
apps/forgecli/dist/index.js agent add coco --connector cli --command "coco run"
apps/forgecli/dist/index.js bridge start
apps/forgecli/dist/index.js bridge status
```

CLI Connector Agent 会通过 stdin 接收 Bridge job JSON，并通过进程退出码报告成功或失败。MCP Connector Agent 通过 stdio 启动，并通过 `tools/call` 调用。

## 工作流模板

Forge 使用 `.wf` 文件定义工作流。MVP 工作流模型是 DAG：节点声明输入、输出、依赖、Skill、产物、Agent、验收条件、重试说明和可选人工评审。

```text
工作流模板
  -> 节点
  -> 依赖
  -> 验收条件
  -> 重试
  -> 产物
  -> 评审
```

Forge 在 MVP 中有意避免任意 runtime loop、`goto` 或运行时生成节点。Loop 是控制平面层面的显式机制：每次执行都可以被评审、重试、验收和审计。

## 架构

| 路径 | 说明 |
| --- | --- |
| `apps/forge` | Forge Web 控制台和 API server |
| `apps/forgecli` | `forgecli` 命令入口与本地桥接命令 |
| `packages/core` | `.wf` 解析、DAG 规划和工作流领域逻辑 |
| `packages/db` | SQLite 与 Drizzle 数据访问层 |
| `packages/sdk` | TypeScript client SDK |
| `packages/ui` | 共享 React UI 组件 |
| `docs/adr` | 架构决策记录 |
| `docs/issues` | 用于阶段规划的本地 markdown issue |

## 配置

Forge 默认使用 SQLite。本地开发数据存储在：

```text
apps/forge/.forge/forge.sqlite
```

常见运行配置：

| 配置 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | API 与打包后 Web server 端口 | `3001` |
| `FORGE_WEB_ASSETS_ROOT` | 构建后 Web 资产目录 | bundled app assets |
| `FORGE_SQLITE_PATH` | SQLite 数据库文件路径 | `apps/forge/.forge/forge.sqlite` |

重置本地开发数据：

```bash
rm -rf apps/forge/.forge
```

不要提交本地数据库文件、模型 API key、bridge token 或生成的产物。

## 脚本

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm lint
pnpm release
```

聚焦检查：

```bash
pnpm --filter @forge/forge test -- src/app.test.ts
pnpm --filter @forge/db test -- src/project-repository.test.ts
pnpm --filter @forge/forge typecheck
pnpm --filter @forge/forge build
```

## 项目状态

Forge 仍处于早期阶段。当前实现聚焦核心路径：

1. 创建项目。
2. 导入需求范围的 `.wf` 工作流模板。
3. 创建需求，并通过 mock executor 或已配置的 OpenAI-compatible 模型端点生成拆解结果。
4. 编辑拆解结果并生成任务。
5. 导入任务范围的 `.wf` 工作流模板。
6. 从任务看板启动任务工作流。
7. 在任务工作流视图中检查工作流和节点执行状态。

完整 worktree 生命周期策略、产物版本存储、SSE 事件流和完整验收条件重试语义仍在完善中。API、存储形态和 UI 细节仍可能变化。

## 安全说明

- Forge Server 不需要反向连接用户机器。本地或远端本地桥接集成应主动连接到 Forge。
- 实时更新优先使用 SSE，用户操作应通过 HTTP API 完成。
- 不要发布 `.forge` 数据库、`.env*` 文件、私钥、证书、bridge token、模型 API key 或本地 Agent 凭证。
- 测试 fixture 可能使用 `secret-key` 这类占位字符串，它们不是真实凭证。

如果你认为发现了安全问题，请不要在公开 issue 中发布漏洞细节。等项目公布首选私密报告渠道后，请通过该渠道联系维护者。

## License

当前还没有 license 文件。正式开源发布前应先添加 `LICENSE` 文件。
