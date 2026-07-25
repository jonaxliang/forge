<div align="center">
  <img src="./apps/forge/web/public/brand/forge-cat-logo-256.png" alt="Forge logo" width="88" />
  <h1>Forge</h1>
  <p>AI work orchestration control plane.</p>
  <p>
    <a href="./README.md">English</a> ·
    <a href="./README.zh-CN.md">中文</a>
  </p>
</div>

Forge is an early-stage, self-hosted control plane for organizing AI work. It
records Projects, Requirements, Tasks, Workflow Runs, Node Runs, Artifacts, and
acceptance decisions. Local or remote agents execute work through the Bridge.

The current implementation uses SQLite. Project records, workflow definitions,
run output, Bridge output, and execution settings are stored on the Forge
Server. Cloud Artifact storage and alternative SQL backends are not implemented.
APIs, the storage schema, and UI details may change.

![Forge Control Room in English](./docs/assets/forge-control-room-en.png)

![Forge Artifacts page in English](./docs/assets/forge-artifacts-en.png)

## Run from source

Requirements:

- Node.js 22+
- pnpm 9+

Install dependencies and start Forge:

```bash
pnpm install
pnpm start
```

Open `http://localhost:3001`. The Web console and API use the same port. A
health check is available at `http://localhost:3001/api/health`.

For development watch mode:

```bash
pnpm --filter @forge/forge dev
```

The browser URL remains `http://localhost:3001`.

## Current workflow

```text
Requirement
  -> Decomposition Result
  -> Tasks
  -> Task Workflow Runs
  -> Node Runs
  -> Artifacts
  -> review / retry / accept
```

The current release supports:

- creating and selecting Projects;
- creating Requirements and generating editable Decomposition Results;
- generating Tasks from a confirmed decomposition;
- importing task-scope `.wf` Workflow Files;
- starting Task Workflow Runs and inspecting Node Runs;
- viewing process output and Artifacts;
- retrying Workflow Nodes and accepting Task or Requirement output;
- configuring model providers and local Agent Bindings.

The Workflow engine is DAG-based and uses node-local retries. Arbitrary loops,
`goto`, and runtime node generation are outside the current model.

## Connect agents

Build `forgecli`, bind the Bridge, register an agent, and start polling:

```bash
pnpm build:forgecli
apps/forgecli/dist/index.js bridge bind --server http://localhost:3001
apps/forgecli/dist/index.js agent add codex --connector mcp --command "codex mcp-server" --tool codex
apps/forgecli/dist/index.js agent add my-agent --connector cli --command "my-agent run"
apps/forgecli/dist/index.js bridge start
apps/forgecli/dist/index.js bridge status
```

CLI Connector agents receive the Bridge job payload as JSON on stdin and report
success or failure through their process exit code. MCP Connector agents are
started over stdio and invoked through `tools/call`.

## Workflow Files

Forge imports `.wf` files as Workflow Templates. A Workflow File can declare
Workflow Nodes, inputs, outputs, dependencies, Skills, Artifacts, Agent roles,
Exit Criteria, retry instructions, and optional human review.

Example templates are available through the Web console. Parsing, validation,
DAG planning, and workflow state transitions live in `packages/core`.

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/forge` | Forge Web console and API server |
| `apps/forgecli` | `forgecli` command-line entry point and Bridge commands |
| `packages/core` | `.wf` parsing, DAG planning, output normalization, and workflow domain logic |
| `packages/db` | SQLite and Drizzle data access |
| `packages/sdk` | TypeScript client SDK |
| `packages/ui` | Shared React UI components |
| `docs/adr` | Architecture decision records |
| `docs/issues` | Historical local planning records |

## Data and configuration

The default SQLite database is:

```text
apps/forge/.forge/forge.sqlite
```

| Setting | Description | Default |
| --- | --- | --- |
| `PORT` | API and bundled Web server port | `3001` |
| `FORGE_HOST` | Server listen address | `127.0.0.1` |
| `FORGE_AUTH_TOKEN` | Server token; generated under `~/.forge/auth-token` when omitted | generated |
| `FORGE_WEB_ASSETS_ROOT` | Directory containing built Web assets | bundled app assets |
| `FORGE_SQLITE_PATH` | SQLite database file path | `apps/forge/.forge/forge.sqlite` |

Non-loopback listeners require the server token. Put TLS and additional network
access controls in front of any remote deployment.

Provider API keys are stored unencrypted in the Forge Server SQLite database.
Their values are omitted from settings API responses after saving. Protect the
database, its backups, the host account, and generated Artifacts.

For the deployment boundary and private vulnerability reporting process, read
[SECURITY.md](./SECURITY.md).

## Current limitations

- SQLite is the only implemented database backend.
- Artifact and run output are stored by the Forge Server; Cloud Artifact storage
  is not implemented.
- APIs and persisted data structures are not yet stable.
- Agent Connector coverage and Exit Criteria behavior are still evolving.

## Development checks

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm lint
```

Focused checks:

```bash
pnpm --filter @forge/forge test -- src/app.test.ts web/src/App.test.tsx
pnpm --filter @forge/db test -- src/project-repository.test.ts
pnpm --filter @forge/sdk test -- src/index.test.ts
pnpm --filter @forge/forge typecheck
```

## License

Forge is licensed under the [Apache License 2.0](./LICENSE).
