# Forge Control Room UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the existing Forge web app into a cool-toned, professional single-page Workflow Run Control Room without changing backend behavior.

**Architecture:** Keep the current React/Vite app as one screen and preserve the existing SDK calls. Restructure `App.tsx` around a top status bar, left setup rail, and main Control Room surface. Replace the current plain stacked CSS with a focused operations-console visual system in `styles.css`, and extend `StatusBadge` only if status tones need reusable rendering.

**Tech Stack:** React 18, TypeScript, Vite, pnpm, workspace packages `@forge/sdk` and `@forge/ui`, plain CSS.

---

## File Structure

- Modify `apps/web/src/App.tsx`: preserve all current state and handler behavior; add small render helpers, derived metrics, status tone mapping, and a redesigned JSX structure.
- Modify `apps/web/src/styles.css`: replace the current form/card styling with a responsive dashboard shell, left rail, Control Room panels, workflow node rows, task draft queue, task board, status dots, and interaction states.
- Modify `packages/ui/src/status-badge.tsx`: add optional tones only if `App.tsx` needs shared badge statuses beyond `neutral` and `success`.
- Do not create new runtime dependencies.
- Do not change API calls in `@forge/sdk`.

## Task 1: Baseline Verification

**Files:**
- Read: `apps/web/src/App.tsx`
- Read: `apps/web/src/styles.css`
- Read: `packages/ui/src/status-badge.tsx`

- [ ] **Step 1: Run web typecheck before editing**

Run:

```bash
pnpm --filter @forge/web typecheck
```

Expected: TypeScript succeeds before UI changes. If it fails, capture the existing failure and do not conflate it with the redesign.

- [ ] **Step 2: Run web tests before editing**

Run:

```bash
pnpm --filter @forge/web test
```

Expected: Vitest succeeds or reports no tests. The current package script uses `--passWithNoTests`.

## Task 2: App Structure and Derived UI Data

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add local UI helper types and constants near `ConnectionState`**

Add helpers for status rendering and column labels without changing domain types:

```tsx
type StatusTone = "neutral" | "success" | "info" | "warning" | "danger";

const taskStatusLabels = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done"
} as const;

function getNodeRunTone(status: string): StatusTone {
  if (["succeeded", "done"].includes(status)) {
    return "success";
  }
  if (["running", "queued"].includes(status)) {
    return "info";
  }
  if (["waiting", "reviewing"].includes(status)) {
    return "warning";
  }
  if (["blocked", "failed"].includes(status)) {
    return "danger";
  }
  return "neutral";
}
```

- [ ] **Step 2: Add derived metrics inside `App` before handler declarations or before `return`**

Compute summary values from existing state:

```tsx
const workflowRunCount = Object.values(workflowRunsByTaskId).reduce(
  (count, runs) => count + runs.length,
  0
);

const latestStatusMessage = [
  projectStatus,
  workflowImportStatus,
  requirementStatus,
  taskBoardStatus
].find((message) => !message.startsWith("No ")) ?? "Ready";
```

- [ ] **Step 3: Preserve all current handlers unchanged**

Do not alter the behavior of:

```tsx
handleCreateProject
handleImportWorkflow
handleCreateRequirement
handleUpdateTaskDraft
handleDeleteTaskDraft
handleMoveTaskDraft
handleApproveTaskDraft
handleStartTaskWorkflowRun
```

Expected: only presentation structure changes in this task.

## Task 3: Shared Badge Tone Support

**Files:**
- Modify: `packages/ui/src/status-badge.tsx`

- [ ] **Step 1: Extend `StatusBadge` tones**

Replace the current two-tone implementation with this equivalent inline-style implementation:

```tsx
import type { ReactNode } from "react";

type StatusBadgeTone = "neutral" | "success" | "info" | "warning" | "danger";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusBadgeTone;
};

const toneStyles: Record<
  StatusBadgeTone,
  { backgroundColor: string; color: string; borderColor: string }
> = {
  neutral: {
    backgroundColor: "#eef2f7",
    borderColor: "#d7dee8",
    color: "#334155"
  },
  success: {
    backgroundColor: "#dcfce7",
    borderColor: "#bbf7d0",
    color: "#166534"
  },
  info: {
    backgroundColor: "#dbeafe",
    borderColor: "#bfdbfe",
    color: "#1d4ed8"
  },
  warning: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
    color: "#92400e"
  },
  danger: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    color: "#991b1b"
  }
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  const style = toneStyles[tone];

  return (
    <span
      style={{
        alignItems: "center",
        backgroundColor: style.backgroundColor,
        border: `1px solid ${style.borderColor}`,
        borderRadius: 999,
        color: style.color,
        display: "inline-flex",
        fontSize: 13,
        fontWeight: 700,
        lineHeight: 1,
        minHeight: 28,
        padding: "0 10px",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Run UI package typecheck**

Run:

```bash
pnpm --filter @forge/ui typecheck
```

Expected: package typecheck passes.

## Task 4: Redesign JSX Layout

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Replace the current `<main className="shell">` subtree with a dashboard shell**

Keep the same forms, inputs, `data-testid` values, handlers, and state bindings. Use these section classes:

```tsx
<main className="app-shell">
  <header className="topbar">...</header>
  <div className="workspace-grid">
    <aside className="setup-rail">...</aside>
    <section className="control-room" aria-labelledby="control-room-heading">...</section>
  </div>
</main>
```

- [ ] **Step 2: Build topbar contents**

Topbar must include:

```tsx
<div className="brand-lockup">
  <span className="brand-mark">F</span>
  <div>
    <p className="eyebrow">Forge local development</p>
    <h1>Forge Control Room</h1>
  </div>
</div>
<div className="topbar-status" aria-live="polite">
  <StatusBadge tone={connection.status === "connected" ? "success" : "neutral"}>
    {connection.message}
  </StatusBadge>
  {connection.status === "connected" ? (
    <span className="health-detail">
      {connection.health.service} is {connection.health.status}
    </span>
  ) : null}
</div>
```

Also add a compact metric strip for Projects, Workflow Files, Requirements, Task Drafts, Tasks, and Workflow Runs.

- [ ] **Step 3: Move setup forms into the left rail**

Wrap Project setup, Workflow File import, and Requirement intake in `rail-card` sections. Preserve:

```tsx
data-testid="project-name-input"
data-testid="artifact-storage-select"
data-testid="db-strategy-select"
data-testid="workflow-source-textarea"
data-testid="requirement-title-input"
data-testid="requirement-body-textarea"
data-testid="requirement-workflow-select"
```

- [ ] **Step 4: Build Control Room panels**

Create main panels for:

```tsx
Workflow File Preview
Requirement Records
Task Draft Review Queue
Task Board
```

Use `panel`, `panel-header`, `panel-title`, `panel-copy`, and `panel-body` class names for consistent styling.

- [ ] **Step 5: Render Workflow Nodes as node rows**

For each `workflowPreview.nodes`, render:

```tsx
<article className="workflow-node" key={node.id}>
  <div className="node-index">{index + 1}</div>
  <div className="node-main">
    <h3>{node.id}</h3>
    <p>{node.type}</p>
  </div>
  <div className="node-meta">
    <span>{node.executor}</span>
    <span>Retries {node.exit.maxRetries}</span>
    <span>
      Depends {node.dependsOn.length > 0 ? node.dependsOn.join(", ") : "none"}
    </span>
  </div>
</article>
```

- [ ] **Step 6: Render Task Drafts as review cards**

Keep the existing editable form per draft. Change action button labels to compact labels while preserving handler calls:

```tsx
Save
Up
Down
Delete
Approve
```

Use classes:

```tsx
draft-card
draft-form
draft-actions
button-secondary
button-danger
button-primary
```

- [ ] **Step 7: Render Task Board as operational columns**

Keep `taskStatuses` and filtering. Use readable labels:

```tsx
{taskStatusLabels[status]}
```

Each task card should show a status badge, source Requirement, Task Workflow selector, Start Workflow Run button, and node run rows. Keep:

```tsx
data-testid="task-workflow-select"
```

## Task 5: CSS Visual System

**Files:**
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Replace root and base styles**

Use cool operations-console tokens:

```css
:root {
  color: #132033;
  background: #eaf0f7;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}
```

- [ ] **Step 2: Add layout styles**

Define:

```css
.app-shell
.topbar
.workspace-grid
.setup-rail
.control-room
.rail-card
.panel
.panel-header
.panel-body
```

Expected: desktop layout is two columns with a sticky-ish left rail feel via visual grouping, not actual sticky behavior.

- [ ] **Step 3: Add form and control states**

Style `input`, `select`, `textarea`, and `button` with:

```css
:focus-visible
:hover:not(:disabled)
:active:not(:disabled)
:disabled
```

Expected: keyboard focus is visible, disabled controls are readable, and hover states are clear.

- [ ] **Step 4: Add workflow and board styles**

Define:

```css
.metric-strip
.metric-card
.workflow-node
.node-index
.node-meta
.record-grid
.draft-card
.task-board
.task-column
.task-card
.run-history
.node-run-row
.status-dot
```

Expected: Workflow Nodes and Node Runs are scanable rows, not paragraph cards.

- [ ] **Step 5: Add responsive styles**

At `max-width: 980px`, stack the workspace into one column:

```css
@media (max-width: 980px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .task-board {
    grid-template-columns: 1fr;
  }
}
```

At `max-width: 640px`, tighten padding and allow action groups to wrap.

## Task 6: Verification

**Files:**
- Verify: `apps/web/src/App.tsx`
- Verify: `apps/web/src/styles.css`
- Verify: `packages/ui/src/status-badge.tsx`

- [ ] **Step 1: Run UI typecheck**

Run:

```bash
pnpm --filter @forge/ui typecheck
```

Expected: passes.

- [ ] **Step 2: Run web typecheck**

Run:

```bash
pnpm --filter @forge/web typecheck
```

Expected: passes.

- [ ] **Step 3: Run web tests**

Run:

```bash
pnpm --filter @forge/web test
```

Expected: passes or reports no tests with success.

- [ ] **Step 4: Run web build**

Run:

```bash
pnpm --filter @forge/web build
```

Expected: Vite build succeeds.

- [ ] **Step 5: Start web dev server**

Run:

```bash
pnpm --filter @forge/web dev
```

Expected: Vite serves the app on an available local port.

- [ ] **Step 6: Inspect in browser**

Open the served local URL and verify:

- No blank screen.
- No obvious text overlap.
- Topbar metrics fit on desktop.
- Left rail and Control Room stack on mobile width.
- Buttons show hover/focus states.
- Empty states are readable.

## Task 7: Commit Implementation

**Files:**
- Commit: `apps/web/src/App.tsx`
- Commit: `apps/web/src/styles.css`
- Commit: `packages/ui/src/status-badge.tsx`
- Commit: `docs/superpowers/plans/2026-06-14-forge-control-room-ui-redesign.md`

- [ ] **Step 1: Review diff**

Run:

```bash
git diff -- apps/web/src/App.tsx apps/web/src/styles.css packages/ui/src/status-badge.tsx docs/superpowers/plans/2026-06-14-forge-control-room-ui-redesign.md
```

Expected: diff only contains the UI redesign, badge tone support, and implementation plan.

- [ ] **Step 2: Commit**

Run:

```bash
git add apps/web/src/App.tsx apps/web/src/styles.css packages/ui/src/status-badge.tsx docs/superpowers/plans/2026-06-14-forge-control-room-ui-redesign.md
git commit -m "feat: redesign forge control room ui"
```

Expected: commit succeeds.

## Self-Review

- Spec coverage: top bar, left rail, Control Room panels, Workflow File preview, Task Draft queue, Task Board, interaction states, accessibility, and verification are covered.
- Placeholder scan: no TBD, TODO, or incomplete implementation instructions are intentionally left.
- Type consistency: `StatusTone`, `taskStatusLabels`, and `getNodeRunTone` are local UI helpers; `StatusBadge` accepts the same tone names used by the app.
