# Forge

Forge is an AI work orchestration control plane. It connects Requirements,
Task Drafts, Tasks, `.wf` Workflow Files, Workflow Runs, Node Runs, Artifacts,
and local or remote agent execution into a traceable workflow system.

The repository is a TypeScript monorepo for running Forge as a local-first
control plane. The current app package combines the web console and API server,
while `forgecli` provides optional local command-line integration.

## Project Status

Forge is early-stage software. The current implementation focuses on the core
workflow path:

1. Create a Project.
2. Import a requirement-scope `.wf` Workflow File.
3. Create a Requirement and generate Task Drafts with a mock executor or a
   configured OpenAI-compatible model endpoint.
4. Edit and approve Task Drafts into Tasks.
5. Import a task-scope `.wf` Workflow File.
6. Start a Task Workflow Run from the Task Board.
7. Inspect Workflow Run and Node Run status in the Control Room.

APIs, storage shape, and UI details can still change.

## Repository Layout

- `apps/forge`: Forge web console and API server.
- `apps/forgecli`: `forgecli` command-line entry point.
- `packages/core`: `.wf` parsing, DAG planning, and workflow run domain logic.
- `packages/db`: SQLite and Drizzle data access layer.
- `packages/sdk`: TypeScript client SDK.
- `packages/ui`: shared React UI components.
- `docs/adr`: architecture decision records.
- `docs/issues`: local markdown issues used for staged planning.

## Requirements

- Node.js 22+
- pnpm 9+

Install dependencies:

```bash
pnpm install
```

## Run Forge

Build the app, bundle the web assets, and start Forge:

```bash
pnpm start
```

The default production-style local URL is:

```text
http://localhost:3001
```

The API is served under `/api/*`, for example:

```text
http://localhost:3001/api/health
```

To use a different port:

```bash
PORT=3999 pnpm start
```

If you host or build the web assets separately, point the server at that
directory:

```bash
FORGE_WEB_ASSETS_ROOT=/path/to/web/dist pnpm --filter @forge/forge start
```

## Development

Start the Forge development server:

```bash
pnpm --filter @forge/forge dev
```

The Vite development URL is:

```text
http://localhost:5173
```

During development, `/api/*` requests are proxied to the local Forge API server:

```text
http://localhost:5173/api/health -> http://localhost:3001/api/health
```

## Local Data

Forge uses SQLite by default. Local development data is stored under:

```text
apps/forge/.forge/forge.sqlite
```

Set `FORGE_SQLITE_PATH=/absolute/path/to/forge.sqlite` when you need to point
Forge at a different local database file.

To reset local development data:

```bash
rm -rf apps/forge/.forge
```

Do not commit local database files, model API keys, bridge tokens, or generated
artifacts. The repository ignores `.forge`, `.env*`, SQLite database files, and
common private-key formats.

## Configuration

Forge can call mainstream model providers through the Vercel AI SDK, including
OpenAI, Anthropic, Google Gemini, Mistral, Groq, DeepSeek, OpenRouter, Ollama,
LM Studio, and generic OpenAI-compatible endpoints when execution settings are
configured in the web UI. By default, no model API key is stored in source code.

Common runtime settings:

| Setting | Description | Default |
| --- | --- | --- |
| `PORT` | API and bundled web server port | `3001` |
| `FORGE_WEB_ASSETS_ROOT` | Directory containing built web assets | bundled app assets |

The web UI stores execution settings in the local SQLite database. Keep that
database local unless you have reviewed its contents.

## Scripts

Run all tests:

```bash
pnpm test
```

Run type checks:

```bash
pnpm typecheck
```

Build all packages:

```bash
pnpm build
```

Build only `forgecli`:

```bash
pnpm build:forgecli
```

Bind local agents through the Bridge:

```bash
pnpm build:forgecli
apps/forgecli/dist/index.js bridge bind --server http://localhost:3001
apps/forgecli/dist/index.js agent add codex --connector mcp --command "codex mcp-server" --tool codex
apps/forgecli/dist/index.js agent add coco --connector cli --command "coco run"
apps/forgecli/dist/index.js bridge start
apps/forgecli/dist/index.js bridge status
```

CLI Connector agents receive the Bridge job payload as JSON on stdin and report
success or failure through their process exit code. MCP Connector agents are
started over stdio and invoked through `tools/call`.

Run lint:

```bash
pnpm lint
```

Suggested pre-publish verification:

```bash
rm -rf apps/forge/.forge
pnpm exec turbo test --force
pnpm exec turbo typecheck --force
pnpm exec turbo build --force
pnpm exec turbo lint --force
```

Focused checks:

```bash
pnpm --filter @forge/forge test -- src/app.test.ts
pnpm --filter @forge/db test -- src/project-repository.test.ts
pnpm --filter @forge/forge typecheck
pnpm --filter @forge/forge build
```

Build platform release executables:

```bash
pnpm release
```

The release command creates ignored platform directories such as:

```text
release/forge-macos-arm64/forge
release/forgecli-macos-arm64/forgecli
```

Run the same command on Linux to produce Linux-native directories. Forge uses a
native SQLite addon, so Linux release packages must be built on a Linux runner
instead of being cross-built from macOS.

## Security Notes

- Forge Server does not need to reverse-connect into a user's machine. Local or
  remote Harness integrations should connect outbound to Forge.
- Realtime updates are SSE-first, while user actions should go through HTTP
  APIs.
- Do not publish `.forge` databases, `.env*` files, private keys, certificates,
  bridge tokens, model API keys, or local agent credentials.
- Test fixtures may use placeholder strings such as `secret-key`; these are not
  real credentials.

If you believe you found a security issue, please do not open a public issue
with exploit details. Contact the maintainers through the project's preferred
private reporting channel once one is published.

## License

No license file is included yet. Add a `LICENSE` file before publishing this
repository as open source.
