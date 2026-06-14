# AGENTS.md

This file is the working agreement for AI agents in this repository. Follow it together with the user's latest request and the existing project docs.

## Four Operating Principles

These principles are adapted from the widely used Karpathy-style `CLAUDE.md` guidance.

### 1. Think Before Coding

- Read the relevant code and docs before changing files.
- State important assumptions when the request is ambiguous.
- If there are multiple plausible interpretations, surface the tradeoff instead of silently choosing the riskiest one.
- Push back when a simpler or more local solution would satisfy the goal better.

### 2. Simplicity First

- Prefer the smallest implementation that satisfies the requirement.
- Do not add speculative abstractions, framework churn, or "future-proof" layers unless the existing code clearly needs them.
- Reuse local patterns, helpers, package boundaries, and terminology before inventing new ones.
- Keep code, tests, and docs understandable to the next agent or maintainer.

### 3. Surgical Changes

- Touch only the files needed for the current task.
- Do not reformat, rename, refactor, or "clean up" adjacent code unless it is necessary for the requested change.
- Clean up only issues introduced by your own edits, such as unused imports or broken tests.
- If you notice unrelated problems, mention them rather than fixing them opportunistically.
- Never revert or overwrite user changes unless the user explicitly asks.

### 4. Goal-Driven Execution

- Convert each task into concrete success criteria before implementing.
- For code changes, verify with the narrowest relevant tests first, then broader checks when risk justifies it.
- Do not stop at a partial patch when local verification or follow-through is still feasible.
- If verification cannot be run, explain exactly what was skipped and why.

## Repository Context

Forge is a TypeScript monorepo for an AI work orchestration control plane. It connects requirements, workflow templates, skills, local or remote agent execution, artifacts, and human review into a traceable workflow system.

Current stack and layout:

- Package manager: `pnpm`
- Monorepo runner: Turborepo
- Language: TypeScript, ESM
- Web app: `apps/web`, React + Vite
- API server: `apps/server`, Hono
- CLI: `apps/cli`, `forgecli`
- Shared domain logic: `packages/core`
- Database package: `packages/db`
- SDK package: `packages/sdk`
- Shared UI: `packages/ui`

Common commands:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm lint
pnpm --filter @forge/server dev
pnpm --filter @forge/web dev
```

## Domain Language

Use the vocabulary in `CONTEXT.md` and do not replace it with near-synonyms.

- Forge is the AI work orchestration control plane. Do not describe it as an IDE, coding environment, or agent runtime.
- Harness is the execution plane that connects Forge to local or remote agents.
- Project organizes Requirements, Task Drafts, Tasks, Workflow Files, Workflow Templates, Agent Bindings, Skills, Artifacts, and settings.
- Requirement is the user's goal description before execution planning.
- Task Draft is a generated candidate task before board approval.
- Task is the issue-like executable work unit tracked by Forge.
- Workflow File uses the `.wf` suffix and defines workflow templates.
- Workflow Node is a template step. Avoid calling it merely a step or stage in product copy.
- Exit Criteria define whether a node can advance.
- Workflow Run and Node Run are runtime instances.
- Artifact and Artifact Version are persistent, versioned outputs.
- Agent Binding connects an agent to Forge; Agent Connector adapts protocols such as MCP, CLI, HTTP/SSE, or A2A.
- Cat Factory View is the default Control Room interaction metaphor, while preserving professional status, log, artifact, approval, retry, and blocked-state controls.

## Architecture Constraints

- Keep workflow engine and domain rules in `packages/core` as pure logic where possible.
- Use Zod schemas for structured validation and typed boundaries.
- Use Drizzle for database work when persistence is implemented.
- Avoid business logic that depends directly on one SQL dialect.
- Prefer application-generated text IDs and shared timestamp helpers when those patterns exist.
- Forge Server must not depend on reverse-connecting into the user's machine; the Bridge connects outbound to the server.
- Realtime updates are SSE-first. User actions should go through HTTP APIs.
- `.wf` MVP behavior should stay DAG-based with node-local retries; do not introduce arbitrary loops, `goto`, or runtime node generation unless explicitly requested.

## Frontend Constraints

- The web UI should feel like a quiet, professional operations tool: dense enough to scan, low noise, and built for repeated use.
- Use existing project UI patterns before adding new visual systems.
- Prefer Tailwind, Radix-style primitives, shadcn-style source components, and lucide icons when the project has them available.
- Do not build marketing-style landing pages unless explicitly requested.
- Keep Cat Factory View expressive but still operational: status, logs, artifacts, approvals, retries, and blocked reasons must remain clear.
- Use stable dimensions for boards, toolbars, controls, and repeated items so UI state changes do not shift layout.

## Coding Workflow

- Use `rg` or `rg --files` for searching whenever possible.
- Before editing a file, inspect the surrounding code, exports, callers, and tests that define the local pattern.
- Use `apply_patch` for manual edits.
- Do not use destructive git commands such as `git reset --hard` or `git checkout --` unless explicitly requested.
- Treat dirty or untracked files as user-owned unless you created them in the current task.
- Keep comments sparse and useful. Do not narrate obvious code.
- Default to ASCII in new files unless the file or product copy clearly requires Chinese or other Unicode text.

## Testing Expectations

- For `packages/core`, prefer Vitest coverage for `.wf` parsing, DAG planning, node status transitions, retry behavior, and Exit Criteria types.
- For `apps/server`, use Vitest and Hono test client patterns for API, orchestration, SSE event generation, and bridge queue behavior.
- For `apps/web`, use component tests for important UI behavior and Playwright for end-to-end flows when available.
- For `apps/cli`, test argument parsing, config writes, bridge status commands, and diagnostics.
- Before claiming completion, run the most relevant available checks. At minimum, explain any checks that were not run.

## Communication

- Match the user's language; this project owner commonly writes in Chinese, so Chinese is preferred for progress updates and summaries unless the user uses another language.
- Be direct and concise. Lead with what changed, what was verified, and what remains risky.
- When reviewing code, list findings first with file and line references.
- When implementing, keep the user informed before significant edits and after verification.
