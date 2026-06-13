# 前端技术栈

Forge 前端采用 React + Vite + TypeScript，使用 TanStack Router 处理路由、TanStack Query 管理 server state，SSE 事件用于更新 Query cache。UI 层使用 Tailwind CSS、Radix primitives 或 shadcn/ui 风格组件，并使用 lucide 图标；Forge 不以 Next.js 作为主框架，因为核心产品是本地/远端可部署的 Web App 与独立 Hono Server，而不是 SSR 内容站。
