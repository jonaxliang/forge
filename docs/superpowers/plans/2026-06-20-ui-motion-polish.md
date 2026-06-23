# UI Motion Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a conservative visual polish and controlled Motion layer to the existing Forge workbench.

**Architecture:** Keep the app shell and product flows intact. Add Motion at wrapper boundaries in `App.tsx`, refine CSS tokens and states in `styles.css`, and avoid component extraction from the large existing file.

**Tech Stack:** React 18, Vite, TypeScript, Motion for React, Vitest SSR markup tests, CSS.

---

## File Structure

- Modify `apps/forge/package.json` and `pnpm-lock.yaml`: add the `motion` dependency.
- Modify `apps/forge/web/src/App.test.tsx`: add narrow SSR markup checks for motion scopes before implementation.
- Modify `apps/forge/web/src/App.tsx`: import Motion, add shell/modal wrappers, and expose stable `data-motion-scope` markers.
- Modify `apps/forge/web/src/styles.css`: refine visual tokens, interaction states, modal/shell polish, and reduced-motion fallbacks.

### Task 1: Add Motion Dependency

**Files:**
- Modify: `apps/forge/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add Motion using pnpm**

Run:

```bash
pnpm --filter @forge/forge add motion
```

Expected: `apps/forge/package.json` includes `"motion"` in dependencies and `pnpm-lock.yaml` is updated.

- [ ] **Step 2: Verify dependency metadata**

Run:

```bash
rg -n '"motion"' apps/forge/package.json pnpm-lock.yaml
```

Expected: both files contain `motion`.

### Task 2: Write Motion Scope Tests

**Files:**
- Modify: `apps/forge/web/src/App.test.tsx`

- [ ] **Step 1: Add failing shell and modal tests**

Add these tests inside `describe("App workbench layout", () => { ... })`:

```tsx
  it("marks the app shell as a motion scope", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('data-motion-scope="app-shell"');
    expect(markup).toContain('class="studio-shell"');
  });

  it("marks modal panels as motion scopes", () => {
    const markup = renderToStaticMarkup(
      <App initialWorkbenchAction="project" />
    );

    expect(markup).toContain('data-motion-scope="modal-backdrop"');
    expect(markup).toContain('data-motion-scope="modal-panel"');
    expect(markup).toContain('role="dialog"');
  });
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
pnpm --filter @forge/forge test -- web/src/App.test.tsx
```

Expected: the new tests fail because `data-motion-scope` attributes do not exist yet.

### Task 3: Implement Motion Wrappers

**Files:**
- Modify: `apps/forge/web/src/App.tsx`

- [ ] **Step 1: Import Motion helpers**

Add:

```tsx
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
```

- [ ] **Step 2: Add reduced-motion aware shell and modal variants**

Inside `App`, call `useReducedMotion()` and use wrapper props that animate only `opacity`, `y`, and `scale`. The shell must render as `<motion.main className="studio-shell" data-motion-scope="app-shell">`. Modal backdrops must render with `data-motion-scope="modal-backdrop"`, and modal panels with `data-motion-scope="modal-panel"`.

- [ ] **Step 3: Run tests and verify green**

Run:

```bash
pnpm --filter @forge/forge test -- web/src/App.test.tsx
```

Expected: the new motion scope tests pass and existing App tests remain green.

### Task 4: Polish CSS

**Files:**
- Modify: `apps/forge/web/src/styles.css`

- [ ] **Step 1: Refine global tokens and surfaces**

Update existing CSS variables and shell/panel styles to make hierarchy calmer: slightly cooler line colors, lower shadows, more consistent panel fills, and stable radii already defined in `:root`.

- [ ] **Step 2: Improve interaction states**

Refine button, nav, quick-action, row, upload dropzone, input, and focus-visible states. Keep transitions in the 120-220ms range and animate only color, border, box-shadow, transform, and opacity.

- [ ] **Step 3: Add reduced-motion CSS fallback**

Add:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 4: Run style-sensitive checks**

Run:

```bash
pnpm --filter @forge/forge typecheck:web
pnpm --filter @forge/forge test -- web/src/App.test.tsx
```

Expected: typecheck passes and App tests pass.

### Task 5: Browser Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Build and start Forge**

Run:

```bash
pnpm start
```

Expected: integrated Forge server starts on `http://localhost:3001`.

- [ ] **Step 2: Inspect in browser**

Open `http://localhost:3001` and inspect:

- Desktop width around 1440px.
- Mobile width around 320px.
- Control Room first-project state.
- Settings.
- Requirements.
- Workflow Templates.
- Project modal.

Expected: no clipped text, overlapping controls, low-contrast labels, unstable layout, or broken empty states.

- [ ] **Step 3: Stop the server**

Stop the `pnpm start` process after verification.
