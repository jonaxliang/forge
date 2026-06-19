# Forge UI and Motion Polish Design

## Goal

Improve Forge's existing workbench UI before open source release without changing information architecture, routes, data flow, domain language, or core workflows.

## Scope

This is a conservative polish pass on the existing React/Vite workbench in `apps/forge/web`. The work should keep the current Control Room, Requirements, Settings, and Workflow Templates surfaces recognizable.

In scope:

- Refine global visual tokens for a calmer product workspace.
- Improve panel, card, toolbar, form, modal, list, and empty-state hierarchy.
- Add a small, controlled motion layer using Motion for React.
- Preserve existing copy except where a label clearly wraps, clips, or weakens accessibility.
- Verify desktop and mobile rendering in a browser.

Out of scope:

- Rebuilding the app shell or navigation model.
- Marketing landing page work.
- New workflow concepts or domain model changes.
- Large component extraction from `App.tsx`.
- Theme switching or dark mode.

## Design Direction

Forge should read as an open-source AI work orchestration control plane: calm, precise, and operational. The default visual language remains light and neutral, using teal only for primary actions, selected states, focus, and live/active status.

The workbench should expose the active Project, next action, current status, and generated work path without feeling promotional. Cat Factory View remains expressive, but status, artifacts, approvals, retries, and blocked-state controls must stay clear.

## Visual System

- Use one radius system: 8px controls, 10px records/cards, 14px panels, 18px shell/modal.
- Keep off-white page backgrounds, near-white panels, charcoal text, cool gray borders, and the existing teal accent.
- Prefer hairline borders, inset surfaces, and subtle tinted shadows over heavy card stacking.
- Improve scan density by tightening labels and repeated records while keeping touch targets usable.
- Keep numeric, IDs, and log-like values visually stable with mono styling where already used.

## Motion System

Use Motion for React for a small set of motivated transitions:

- App/workbench entrance: subtle opacity and 6-10px vertical lift.
- Modal entrance/exit: opacity plus scale from 0.98 to 1.
- Repeated records: small stagger on first render only where it does not change layout.
- Buttons, rows, upload dropzones, and quick actions: existing CSS hover/active feedback remains transform/opacity based.

Motion rules:

- Respect `prefers-reduced-motion`.
- Animate only transform and opacity.
- Do not add scroll hijacking, parallax, continuous loops, or physics.
- Do not introduce animation to communicate fake activity.

## Implementation Boundary

Expected files:

- `apps/forge/package.json`: add a Motion dependency if absent.
- `apps/forge/web/src/App.tsx`: add minimal Motion wrappers and reduced-motion handling around existing shell, modals, and selected lists.
- `apps/forge/web/src/styles.css`: refine tokens, surfaces, interaction states, responsive spacing, and reduced-motion CSS.
- `apps/forge/web/src/App.test.tsx`: adjust or add focused tests only if markup or motion wrappers affect observable behavior.

## Acceptance Criteria

- Existing navigation and workflows still work.
- UI remains stable at 320px mobile width and desktop widths.
- Buttons and form controls have clear hover, active, disabled, and focus-visible states.
- Modal and workbench transitions disable under reduced motion.
- No text is clipped or overlapping in the main workbench, modals, settings, requirements, or workflow template screens.
- No purple/blue AI gradient treatment, decorative blobs, or marketing hero patterns are introduced.
- Relevant checks run: `pnpm --filter @forge/forge typecheck:web`, `pnpm --filter @forge/forge test`, and browser inspection at `http://localhost:3001` when feasible.

## Risks

- The current worktree has many user-owned changes in Web and server files. The implementation must avoid broad refactors and avoid reverting unrelated edits.
- `App.tsx` is large, so motion changes should be wrapper-level and local rather than introducing a new component architecture.
- Adding Motion increases dependency surface. The animation layer must stay small enough to justify that cost.
