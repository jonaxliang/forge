# Monorepo 构建工具

Forge 使用 pnpm workspace 管理 monorepo，并使用 Turborepo 编排 build、test、lint、typecheck 等任务。应用层分别使用 Vite 构建 Web、Hono 运行 Server、Node.js 构建 `forgecli`；共享包使用 tsup 或 tsc 构建，后续发布流程可引入 changesets。
