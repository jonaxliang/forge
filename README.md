# Forge

Forge 是一个 AI work workflow 控制平面，用来把 Requirement、Task、`.wf` 工作流、Workflow Run、Node Run、Artifact 和本地/远端 agent 执行连接成可追踪的工作流。

当前仓库是 TypeScript monorepo，包含 Web 控制台、Hono API Server、`forgecli` CLI、核心领域逻辑、数据库层、SDK 和共享 UI。

## 环境要求

- Node.js 22+
- pnpm 9+

安装依赖：

```bash
pnpm install
```

## 本地启动

Forge 本地开发需要同时启动 Server 和 Web。

启动 API Server：

```bash
pnpm --filter @forge/server dev
```

默认监听：

```text
http://localhost:3001
```

启动 Web 控制台：

```bash
pnpm --filter @forge/web dev
```

默认访问：

```text
http://localhost:5173
```

Web 会通过 Vite proxy 调用 Server，例如 `/health` 会代理到 `http://localhost:3001/health`。

## 本地数据

Server 默认使用 SQLite，本地数据库文件位于：

```text
.forge/forge.sqlite
```

如果需要重置本地开发数据：

```bash
rm -rf .forge apps/server/.forge
```

## 常用测试与检查

运行全部测试：

```bash
pnpm test
```

运行类型检查：

```bash
pnpm typecheck
```

运行构建：

```bash
pnpm build
```

运行 lint：

```bash
pnpm lint
```

提交前建议跑完整门禁：

```bash
rm -rf .forge apps/server/.forge
pnpm exec turbo test --force
pnpm exec turbo typecheck --force
pnpm exec turbo build --force
pnpm exec turbo lint --force
```

也可以按 package 聚焦验证：

```bash
pnpm --filter @forge/server test -- src/app.test.ts
pnpm --filter @forge/db test -- src/project-repository.test.ts
pnpm --filter @forge/web typecheck
pnpm --filter @forge/web build
```

## 当前可跑通的主流程

1. 在 Web 创建 Project。
2. 导入 requirement-scope `.wf`。
3. 创建 Requirement，并由 mock executor 生成 Task Draft。
4. 编辑、保存、批准 Task Draft。
5. 导入 task-scope `.wf`。
6. 在 Task Board 启动 Task Workflow Run。
7. 查看 Workflow Run 和 Node Run 状态。

## 包结构

- `apps/web`：React + Vite Web 控制台。
- `apps/server`：Hono API Server。
- `apps/cli`：`forgecli` CLI 入口。
- `packages/core`：`.wf` 解析、DAG planning、workflow run 纯逻辑。
- `packages/db`：SQLite/Drizzle 数据访问层。
- `packages/sdk`：Web/客户端 SDK。
- `packages/ui`：共享 React UI 组件。
- `docs/issues`：阶段一使用的本地 markdown issue。
- `docs/adr`：关键技术决策记录。
