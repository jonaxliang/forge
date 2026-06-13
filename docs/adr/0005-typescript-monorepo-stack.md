# TypeScript Monorepo 技术栈

Forge 采用 pnpm monorepo 和 TypeScript 作为主技术栈。前端使用 React + Vite，后端使用 Hono，schema 校验使用 Zod，数据库访问使用 Drizzle，本地 Agent Bridge 使用 Node.js CLI/daemon；这种组合能让 Web 控制平面、workflow 类型、connector SDK 和本地 bridge 共享领域模型，同时保持开源项目的上手成本较低。
