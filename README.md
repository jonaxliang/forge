# Forge

Forge is a TypeScript monorepo for building a web control plane and local agent bridge workflow system.

## Local Development

Install dependencies:

```bash
pnpm install
```

Start the Hono API server:

```bash
pnpm --filter @forge/server dev
```

Start the React web app in a second terminal:

```bash
pnpm --filter @forge/web dev
```

The web app runs at `http://localhost:5173` and proxies `/health` to the server at `http://localhost:3001`.

## Workspace Commands

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm lint
```

## Packages

- `apps/web`: React + Vite web UI.
- `apps/server`: Hono API server with `GET /health`.
- `apps/cli`: placeholder `forgecli` Node binary.
- `packages/core`: shared domain helpers and types.
- `packages/db`: database package placeholder for later Drizzle setup.
- `packages/sdk`: browser/client SDK helpers.
- `packages/ui`: shared React UI components.
