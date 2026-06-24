<div align="center">
  <img src="./apps/forge/web/public/brand/forge-cat-logo-256.png" alt="Forge 标志" width="88" />
  <h1>Forge</h1>
  <p><strong>AI 工作编排控制平面。</strong></p>
  <p>
    把一个需求变成任务、任务工作流、产物、评审、重试和明确验收，
    同时保留每次执行周围的工作历史。
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

![Forge 中文首页](./docs/assets/forge-control-room-zh-CN.png)

![Forge 中文产物页](./docs/assets/forge-artifacts-zh-CN.png)

Forge 不是 IDE、聊天窗口或 Agent runtime。Forge 是围绕 AI 工作的控制平面：
它把项目、需求、任务、工作流模板、任务工作流、节点执行、产物和验收决策放在同一个可运营界面里。

本地桥接负责执行。本地或远端 Agent 继续拥有自己的工具、凭证、工作区和命令。
Forge 负责编排、状态、检查、重试、产物评审和人工验收。

## 当前功能复核

当前产品主链路已经可以端到端闭环：

1. 创建或选择项目。
2. 从目标描述创建需求。
3. 生成并编辑拆解结果。
4. 从确认后的拆解结果生成任务。
5. 选择任务范围的 `.wf` 工作流模板并启动任务工作流。
6. 查看节点执行、进程输出和产物。
7. 验收任务产物，或要求返工重跑。
8. 关联任务完成后验收需求。
9. 在独立产物页查看最终需求产物。

近期功能清理：

- 需求验收现在会把所有已执行完成的关联任务一起标记为已完成，不再只关闭最终任务。
- 已完成需求显示 `无需下一步`，不再显示像待办动作的复核提示。
- 需求产物已从首页工作区移到独立产物页。
- 首页进展条增加产物数，并可点击进入产物页。
- Markdown 产物预览使用内部滚动区域，长文档可以拉到底。
- 英文和中文 README 截图来自对应路由、视口和项目状态。

## 核心 Loop

```text
需求
  -> 拆解结果
  -> 任务
  -> 任务工作流
  -> 节点执行
  -> 产物
  -> 评审 / 重试 / 验收
```

| 层级 | Forge 追踪什么 | 为什么重要 |
| --- | --- | --- |
| 意图 | 需求 | 工作从持久目标开始，而不是丢在聊天记录里的 prompt |
| 计划 | 拆解结果与任务 | 生成出来的工作可以在执行前编辑 |
| 执行 | 任务工作流与节点执行 | Agent 工作可见、可重试、可检查 |
| 证据 | 产物 | 输出不会随着聊天或 CLI 会话结束而消失 |
| 判断 | 评审与验收 | 完成是用户决策，不只是进程退出 |

## 你会得到什么

- 面向浏览器的控制平面：管理项目、需求、任务、工作流模板、Agent 绑定、Skill、产物和设置。
- 任务看板：扫描生成任务、依赖状态和任务工作流。
- 任务工作流详情：查看节点状态、执行日志、进程输出、产物、重试和阻塞状态。
- 独立产物页：按格式查看最终需求产物。
- 通过 `forgecli` 本地优先执行工作。
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

CLI Connector Agent 会通过 stdin 接收 Bridge job JSON，并通过进程退出码报告成功或失败。
MCP Connector Agent 通过 stdio 启动，并通过 `tools/call` 调用。

## 工作流模板

Forge 使用 `.wf` 文件定义工作流。MVP 工作流模型是 DAG：
节点声明输入、输出、依赖、Skill、产物、Agent、验收条件、重试说明和可选人工评审。

```text
工作流模板源文件
  -> 工作流节点
  -> 依赖
  -> 验收条件
  -> 重试
  -> 产物
  -> 评审
```

Forge 在 MVP 中有意避免任意 runtime loop、`goto` 或运行时生成节点。
Loop 是控制平面层面的显式机制：每次执行都可以被评审、重试、验收和审计。

## 架构

| 路径 | 说明 |
| --- | --- |
| `apps/forge` | Forge Web 控制台和 API server |
| `apps/forgecli` | `forgecli` 命令入口与本地桥接命令 |
| `packages/core` | `.wf` 解析、DAG 规划、产物输出规整和工作流领域逻辑 |
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
pnpm --filter @forge/forge test -- src/app.test.ts web/src/App.test.tsx
pnpm --filter @forge/db test -- src/project-repository.test.ts
pnpm --filter @forge/sdk test -- src/index.test.ts
pnpm --filter @forge/forge typecheck
pnpm --filter @forge/forge build
```

## 项目状态

Forge 仍处于早期阶段。当前实现覆盖项目创建、需求创建、需求拆解、任务生成、
任务范围工作流运行、节点执行检查、产物预览、任务验收、需求验收和最终需求产物查看。

仍在演进：

- 完整 worktree 生命周期策略
- cloud 产物存储适配器
- 更丰富的外部产物发布
- 更完整的本地和远端 Agent Connector 覆盖
- 超出当前模型评审路径的验收条件语义

API、存储形态和 UI 细节仍可能变化。

## 安全说明

- Forge Server 不需要反向连接用户机器。本地或远端本地桥接集成应主动连接到 Forge。
- 实时更新优先使用 SSE，用户操作应通过 HTTP API 完成。
- 不要发布 `.forge` 数据库、`.env*` 文件、私钥、证书、bridge token、模型 API key 或本地 Agent 凭证。
- 测试 fixture 可能使用 `secret-key` 这类占位字符串，它们不是真实凭证。

如果你认为发现了安全问题，请不要在公开 issue 中发布漏洞细节。
等项目公布首选私密报告渠道后，请通过该渠道联系维护者。

## License

当前还没有 license 文件。正式开源发布前应先添加 `LICENSE` 文件。
