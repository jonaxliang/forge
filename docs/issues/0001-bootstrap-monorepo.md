# 0001 初始化 monorepo 与本地开发闭环

## Type

AFK

## What to build

建立 Forge 的 TypeScript monorepo 骨架，使开发者可以一条命令安装依赖、启动 Web、Server 和基础测试。该 issue 的目标不是实现业务功能，而是形成后续所有 tracer-bullet issue 的可运行底座。

## Acceptance criteria

- [ ] 使用 `pnpm workspace` 和 Turborepo 管理仓库任务。
- [ ] 创建 `apps/web`、`apps/server`、`apps/cli`、`packages/core`、`packages/db`、`packages/sdk`、`packages/ui`。
- [ ] `apps/web` 使用 React + Vite + TypeScript 启动，并能显示 Forge 首页占位。
- [ ] `apps/server` 使用 Hono 提供 `/health` API。
- [ ] `apps/web` 能调用 `/health` 并显示 Server 连接状态。
- [ ] 配置 `lint`、`typecheck`、`test`、`build` 顶层脚本。
- [ ] Vitest 能在至少一个 package 中跑通。
- [ ] README 增加本地开发启动方式。

## Blocked by

None - can start immediately

## User stories covered

- 为所有后续用户故事提供开发基础。

## Expected artifacts

- Monorepo scaffold
- 本地开发 README
- 基础 health check 测试
