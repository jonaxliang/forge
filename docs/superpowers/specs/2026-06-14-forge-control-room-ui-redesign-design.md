# Forge Control Room UI Redesign

Date: 2026-06-14

## Context

Forge is an AI work orchestration control plane. The current web UI already supports the core local development loop:

- Create a Project.
- Import and preview a Workflow File.
- Create a Requirement and generate Task Drafts.
- Edit, reorder, delete, and approve Task Drafts.
- View approved Tasks and start Workflow Runs.
- Inspect basic Node Run status.

The current interface presents these capabilities as a long stack of forms and plain cards. It proves the workflow but does not yet feel like an operational control plane. The redesign should keep the existing functionality while making status, flow, and user actions easier to scan and more interactive.

## Design Read

This is a Forge control plane web app for workflow operators and product developers. The visual language should be quiet, cool-toned, dense enough for repeated use, and more like an operations console than a marketing page.

Design dials:

- Visual variance: 5
- Motion intensity: 3
- Visual density: 7

## Goals

1. Make the app feel like a professional Workflow Run Control Room rather than a demo form page.
2. Preserve the existing product vocabulary: Project, Requirement, Task Draft, Task, Workflow File, Workflow Node, Workflow Run, Node Run, Artifact, Harness.
3. Keep the implementation local to the current web app unless a shared UI change is clearly needed.
4. Add meaningful interaction states: hover, focus, disabled, loading text, live status, selected controls, and useful empty states.
5. Improve scanability for workflow structure and task execution without changing backend behavior.

## Non-Goals

- Do not add routing or split the app into multiple pages.
- Do not add arbitrary workflow loops, runtime node generation, or new engine behavior.
- Do not build a marketing landing page.
- Do not introduce a new component library for this pass.
- Do not implement drag-and-drop sorting; keep the existing reorder actions.
- Do not implement real SSE updates unless already exposed by the current API surface.

## Information Architecture

The redesigned app should be one dashboard shell with three primary regions:

1. Top command/status bar
   - Product identity: Forge.
   - Server health.
   - Counts for Projects, Workflow Files, Requirements, Task Drafts, Tasks, and Workflow Runs.
   - A concise global status message from the most recent action.

2. Left rail: configuration and intake
   - Project setup.
   - Workflow File import.
   - Requirement creation.
   - These are supporting controls and should not visually compete with the main execution surface.

3. Main Control Room
   - Workflow File preview.
   - Requirement and Task Draft queue.
   - Task Board.
   - Workflow Run and Node Run inspection inside Task cards.

On narrow screens, the left rail stacks above the main Control Room while preserving the same order: status, setup, intake, execution.

## Visual System

Palette:

- Base: cool near-white and blue-gray surfaces.
- Text: dark navy and slate.
- Accent: one electric blue/cyan family for primary actions and active status.
- Status tones: green for success, amber for waiting/reviewing, red for failed/blocked, blue for running/queued, gray for idle/skipped.

Shape:

- Main panels and cards use an 8px radius.
- Buttons and status pills can use a larger pill radius.
- Inputs use 8px radius.

Typography:

- System sans-serif is acceptable for this pass.
- Use smaller, tighter headings inside panels.
- Avoid hero-scale type because the app is an operations tool.

Depth:

- Prefer borders, subtle background bands, and inset surfaces.
- Avoid heavy shadows and decorative gradients.

## Component Behavior

### Top Bar

The top bar should show Forge as the control plane, not as a large hero. Server connection should use a clear status badge. Counts should be compact metrics, not large marketing stats.

### Project Setup

Project setup remains a form with:

- Project name.
- Artifact Storage Mode.
- Database strategy.
- Submit action.

Project cards should read like registered Project records, with storage and database strategy as compact metadata.

### Workflow File Import

The `.wf` editor remains a textarea. The preview should become a structured Workflow File panel:

- Workflow name, scope, and Workflow Node count.
- Each Workflow Node presented as a node row with type, executor, retry limit, and dependencies.
- Dependencies should be visible without requiring paragraph reading.

### Requirement Intake

Requirement creation remains a form with title, body, selected Requirement Workflow File, and run action. The output area should distinguish Requirements from Task Drafts.

### Task Draft Queue

Task Drafts should feel like a review queue:

- Editable title and body.
- Actions grouped in a compact toolbar: save, move up, move down, delete, approve.
- Approve should be visually primary.
- Delete should be visually destructive but not dominant.
- Empty state should tell the user to run a Requirement workflow.

### Task Board

The Task Board should remain column-based with `todo`, `in_progress`, and `done`.

Each Task card should include:

- Title.
- Status badge.
- Source Requirement.
- Task Workflow selector.
- Start Workflow Run action.
- Workflow Run history.
- Node Run list with state dots or badges.

The card should make it obvious whether no Workflow Run exists, a run is active, or previous runs are available.

## Interaction States

All controls should include:

- Hover feedback for actionable elements.
- Focus-visible outlines for keyboard use.
- Disabled styling that preserves readability.
- Active button states.
- Form status text via existing aria-live regions.

The implementation may derive lightweight busy labels from existing status strings, but it should not add a broad async state framework in this pass.

## Accessibility

- Keep labels bound by visible text and existing form structure.
- Preserve `aria-live` status regions.
- Preserve `data-testid` attributes currently used by tests or future tests.
- Ensure color is not the only signal for status; pair status colors with text labels.
- Ensure mobile layout does not require horizontal scrolling for primary controls.

## Implementation Plan Boundary

Expected code changes:

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- Potentially `packages/ui/src/status-badge.tsx` if the existing badge needs more status tones.

Avoid broader changes unless typecheck or build requires them.

## Verification

Run the narrowest checks first:

- `pnpm --filter @forge/web typecheck`
- `pnpm --filter @forge/web test`
- `pnpm --filter @forge/web build`

If the app can be served locally, run the web dev server and inspect the UI in a browser for layout, overflow, and interaction state issues.

## Open Decisions Resolved

- Use a cool professional operations-console aesthetic.
- Keep the app single-page.
- Do not add new dependencies for this pass.
- Prioritize the Control Room workflow over a decorative hero.
- Preserve existing backend calls and behavior.
