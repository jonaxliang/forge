# Monorepo 构建工具

Forge 使用 pnpm workspace 管理 monorepo，并使用 Turborepo 编排 build、test、lint、typecheck 等任务。应用层使用 `apps/forge` 构建一体化 Forge 主体，其中 Vite 构建 Web 控制台、Hono 运行 Server；`apps/forgecli` 使用 Node.js 构建 `forgecli`；共享包使用 tsup 或 tsc 构建，后续发布流程可引入 changesets。
