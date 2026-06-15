# Workflow Template Schema v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `.wf` schema v1.1 so Workflow Templates are controllable, reusable, and traceable beyond direct prompts while preserving legacy `.wf` imports.

**Architecture:** `packages/core` owns pure parsing, normalization, type definitions, and validation. `apps/forge` persists normalized definitions and exposes them through existing APIs. `apps/forge/web` moves built-in templates into a focused module and renders the richer contract in the Workflow Template manager.

**Tech Stack:** TypeScript, ESM, Zod, yaml, Hono, React, Vitest, Vite.

---

## File Structure

- Modify `packages/core/src/workflow-file.ts`: add v1.1 schemas, normalized types, legacy normalization, reference validation.
- Modify `packages/core/src/index.ts`: export new workflow types if exports are explicit.
- Modify `packages/core/src/workflow-file.test.ts`: add RED/GREEN parser and validation tests.
- Modify `packages/sdk/src/index.ts`: mirror normalized Workflow File TypeScript types used by Web.
- Modify `apps/forge/src/app.test.ts`: add API import test for v1.1 normalized persistence.
- Verify `apps/forge/src/app.ts`: likely no code change if it already stores `JSON.stringify(workflow)`.
- Create `apps/forge/web/src/default-workflow-templates.ts`: own all built-in `.wf` sources and parsed metadata.
- Modify `apps/forge/web/src/App.tsx`: consume moved templates and render v1.1 preview fields.
- Modify `apps/forge/web/src/i18n.ts`: add preview labels and six default template descriptions in English and Chinese.
- Modify `apps/forge/web/src/styles.css`: compact contract preview styles.
- Modify `apps/forge/web/src/App.test.tsx`: assert six templates and rich preview fields.

## Task 1: Core `.wf` v1.1 Parser and Types

**Files:**
- Modify: `packages/core/src/workflow-file.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/workflow-file.test.ts`

- [ ] **Step 1: Write failing tests for v1.1 parsing and legacy normalization**

Add tests to `packages/core/src/workflow-file.test.ts`:

```ts
it("parses a v1.1 workflow file with reusable resources and exit criteria", () => {
  const workflow = parseWorkflowFile(`
name: Software Change Task
scope: task
version: "1.1"
inputs:
  - id: task
    type: task
    required: true
skills:
  - id: planning
    ref: skill:implementation-planning
agents:
  - id: planner
    role: implementation-planner
artifacts:
  - id: plan
    type: markdown
    path: plan.md
nodes:
  - id: plan
    type: implementation-plan
    description: Turn the Task into a scoped implementation plan.
    executor: agent:planner
    uses:
      - skill:planning
    inputs:
      - task
    instruction:
      ref: prompt:implementation-plan
    outputs:
      - artifact:plan
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Plan names files or modules likely to change.
      retryInstruction: Revise the plan to close missing scope gaps.
`);

  expect(workflow).toMatchObject({
    artifacts: [{ id: "plan", path: "plan.md", type: "markdown" }],
    inputs: [{ id: "task", required: true, type: "task" }],
    skills: [{ id: "planning", ref: "skill:implementation-planning" }],
    version: "1.1",
    nodes: [
      {
        description: "Turn the Task into a scoped implementation plan.",
        exit: {
          criteria: ["Plan names files or modules likely to change."],
          maxRetries: 1,
          retryInstruction: "Revise the plan to close missing scope gaps.",
          review: "model"
        },
        inputs: ["task"],
        instruction: { ref: "prompt:implementation-plan" },
        outputs: [{ artifact: "plan" }],
        uses: ["skill:planning"]
      }
    ]
  });
});

it("normalizes legacy workflow files into the v1.1 shape", () => {
  const workflow = parseWorkflowFile(`
name: Legacy Coding workflow
scope: task
nodes:
  - id: code
    type: code-change
    executor: agent:coder
    outputs:
      - diff.patch
    exit:
      maxRetries: 2
`);

  expect(workflow).toMatchObject({
    artifacts: [],
    inputs: [],
    skills: [],
    version: "1",
    nodes: [
      {
        exit: {
          criteria: [],
          maxRetries: 2,
          retryInstruction: "",
          review: "model"
        },
        outputs: [{ kind: "file", ref: "diff.patch" }],
        uses: []
      }
    ]
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm --filter @forge/core test -- workflow-file.test.ts
```

Expected: FAIL because `version`, `inputs`, `skills`, `agents`, `artifacts`, structured outputs, and rich exit fields are not implemented.

- [ ] **Step 3: Implement normalized schema and validation**

In `packages/core/src/workflow-file.ts`, add:

```ts
export const workflowVersions = ["1", "1.1"] as const;
export const workflowReviewModes = ["model", "human", "none"] as const;
export const workflowArtifactTypes = [
  "markdown",
  "patch",
  "json",
  "report",
  "outline",
  "draft"
] as const;
```

Implement Zod schemas for:

```ts
type WorkflowInput = { id: string; type: string; required: boolean };
type WorkflowSkill = { id: string; ref: string };
type WorkflowAgent = { id: string; role: string };
type WorkflowArtifact = { id: string; type: WorkflowArtifactType; path: string };
type WorkflowInstruction = { ref?: string; text?: string };
type WorkflowNodeOutput =
  | { artifact: string }
  | { kind: "file"; ref: string };
type WorkflowHumanReview = { required: boolean; reason: string };
```

Normalize missing arrays to `[]`, legacy outputs to `{ kind: "file", ref }`, missing exit fields to `criteria: []`, `review: "model"`, and `retryInstruction: ""`.

Add validators:

```ts
validateUniqueResourceIds("workflow input", workflow.inputs);
validateUniqueResourceIds("workflow skill", workflow.skills);
validateUniqueResourceIds("workflow agent", workflow.agents);
validateUniqueResourceIds("workflow artifact", workflow.artifacts);
validateNodeSkillReferences(workflow.nodes, workflow.skills);
validateNodeArtifactReferences(workflow.nodes, workflow.artifacts);
validateHumanReviewConsistency(workflow.nodes);
```

- [ ] **Step 4: Run core tests and verify GREEN**

Run:

```bash
pnpm --filter @forge/core test -- workflow-file.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add failing validation tests, then implement minimal validators**

Add tests:

```ts
it("rejects duplicate v1.1 resource ids", () => {
  expect(() =>
    parseWorkflowFile(`
name: Duplicate resources
scope: task
skills:
  - id: planning
    ref: skill:one
  - id: planning
    ref: skill:two
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
    exit:
      maxRetries: 1
`)
  ).toThrow(/duplicate workflow skill id/i);
});

it("rejects node skill references that are not declared", () => {
  expect(() =>
    parseWorkflowFile(`
name: Missing skill
scope: task
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
    uses:
      - skill:planning
    exit:
      maxRetries: 1
`)
  ).toThrow(/unknown skill reference/i);
});

it("rejects human review without human exit review mode", () => {
  expect(() =>
    parseWorkflowFile(`
name: Inconsistent review
scope: task
nodes:
  - id: review
    type: code-review
    executor: agent:reviewer
    humanReview:
      required: true
      reason: User approval is required.
    exit:
      maxRetries: 1
      review: model
`)
  ).toThrow(/humanReview.required requires exit.review: human/i);
});
```

Run the same core test command, verify RED, implement, and rerun to GREEN.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/workflow-file.ts packages/core/src/index.ts packages/core/src/workflow-file.test.ts
git commit -m "feat(core): support workflow template schema v1.1"
```

## Task 2: SDK and Server Import Contract

**Files:**
- Modify: `packages/sdk/src/index.ts`
- Modify: `apps/forge/src/app.test.ts`
- Inspect only unless needed: `apps/forge/src/app.ts`

- [ ] **Step 1: Write failing API import test**

Add to `apps/forge/src/app.test.ts` near Workflow File API tests:

```ts
it("imports and persists normalized v1.1 workflow files", async () => {
  const app = createApp();
  const response = await app.request("/api/workflow-files/import", {
    body: JSON.stringify({
      source: `
name: Rich workflow
scope: task
version: "1.1"
inputs:
  - id: task
    type: task
    required: true
skills:
  - id: planning
    ref: skill:implementation-planning
agents:
  - id: planner
    role: implementation-planner
artifacts:
  - id: plan
    type: markdown
    path: plan.md
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
    uses:
      - skill:planning
    outputs:
      - artifact:plan
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Plan is scoped.
`
    }),
    headers: { "content-type": "application/json" },
    method: "POST"
  });

  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.workflow).toMatchObject({
    artifacts: [{ id: "plan", path: "plan.md", type: "markdown" }],
    skills: [{ id: "planning", ref: "skill:implementation-planning" }],
    version: "1.1"
  });
  expect(JSON.parse(body.workflowFile.definition)).toMatchObject({
    version: "1.1",
    nodes: [{ outputs: [{ artifact: "plan" }] }]
  });
});
```

- [ ] **Step 2: Run server test and verify RED**

Run:

```bash
pnpm --filter @forge/forge test -- app.test.ts
```

Expected: FAIL until core types are available and SDK/server expectations are aligned.

- [ ] **Step 3: Update SDK workflow types**

In `packages/sdk/src/index.ts`, replace `WorkflowNode.outputs: string[]` with the normalized union and add:

```ts
export type WorkflowVersion = "1" | "1.1";
export type WorkflowReviewMode = "model" | "human" | "none";
export type WorkflowArtifactType =
  | "markdown"
  | "patch"
  | "json"
  | "report"
  | "outline"
  | "draft";
export type WorkflowInput = { id: string; type: string; required: boolean };
export type WorkflowSkill = { id: string; ref: string };
export type WorkflowAgent = { id: string; role: string };
export type WorkflowArtifact = {
  id: string;
  type: WorkflowArtifactType;
  path: string;
};
export type WorkflowInstruction = { ref?: string; text?: string };
export type WorkflowNodeOutput =
  | { artifact: string }
  | { kind: "file"; ref: string };
export type WorkflowHumanReview = {
  required: boolean;
  reason: string;
};
```

Update `WorkflowFile` to include `version`, `inputs`, `skills`, `agents`, and `artifacts`.

- [ ] **Step 4: Run API tests and typecheck**

Run:

```bash
pnpm --filter @forge/forge test -- app.test.ts
pnpm --filter @forge/forge typecheck
```

Expected: PASS. If `apps/forge/src/app.ts` already stores `JSON.stringify(workflow)`, do not change it.

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/index.ts apps/forge/src/app.test.ts apps/forge/src/app.ts
git commit -m "feat(forge): persist rich workflow template definitions"
```

## Task 3: Built-In v1.1 Workflow Templates

**Files:**
- Create: `apps/forge/web/src/default-workflow-templates.ts`
- Modify: `apps/forge/web/src/App.tsx`
- Modify: `apps/forge/web/src/i18n.ts`
- Test: `apps/forge/web/src/App.test.tsx`

- [ ] **Step 1: Write failing Web test for six built-in templates**

Update `apps/forge/web/src/App.test.tsx`:

```ts
it("offers six rich default Workflow templates in the template manager", () => {
  const markup = renderToStaticMarkup(
    <App initialPage="workflow-templates" initialWorkflowTemplateDialog="new" />
  );

  expect(markup).toContain("Software Change Requirement");
  expect(markup).toContain("Software Change Task");
  expect(markup).toContain("Research &amp; Writing Requirement");
  expect(markup).toContain("Research &amp; Writing Task");
  expect(markup).toContain("Creative Writing Requirement");
  expect(markup).toContain("Creative Writing Task");
  expect(markup).toContain("task template with 5 nodes");
});
```

- [ ] **Step 2: Run Web test and verify RED**

Run:

```bash
pnpm --filter @forge/forge test -- web/src/App.test.tsx
```

Expected: FAIL because only the old default template list exists.

- [ ] **Step 3: Move and expand default templates**

Create `apps/forge/web/src/default-workflow-templates.ts` exporting:

```ts
import { parseWorkflowFile, type WorkflowFile } from "@forge/core";

export type DefaultWorkflowTemplateKey =
  | "software-change-requirement"
  | "software-change-task"
  | "research-writing-requirement"
  | "research-writing-task"
  | "creative-writing-requirement"
  | "creative-writing-task";

export type DefaultWorkflowTemplate = {
  key: DefaultWorkflowTemplateKey;
  source: string;
  workflow: WorkflowFile;
};

function createDefaultWorkflowTemplate(
  key: DefaultWorkflowTemplateKey,
  source: string
): DefaultWorkflowTemplate {
  return {
    key,
    source,
    workflow: parseWorkflowFile(source)
  };
}
```

Add six v1.1 `.wf` sources. Each source must include top-level `inputs`, `skills`, `agents`, `artifacts`, at least four nodes, and node `exit.criteria`.

- [ ] **Step 4: Update App imports and i18n descriptions**

In `apps/forge/web/src/App.tsx`, remove inline default template constants and import:

```ts
import {
  defaultWorkflowTemplates,
  type DefaultWorkflowTemplateKey
} from "./default-workflow-templates";
```

Update `apps/forge/web/src/i18n.ts` `defaultTemplateDescriptions` with the six keys in both locales.

- [ ] **Step 5: Run Web test and verify GREEN**

Run:

```bash
pnpm --filter @forge/forge test -- web/src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/forge/web/src/default-workflow-templates.ts apps/forge/web/src/App.tsx apps/forge/web/src/i18n.ts apps/forge/web/src/App.test.tsx
git commit -m "feat(web): add rich built-in workflow templates"
```

## Task 4: Rich Template Preview UI

**Files:**
- Modify: `apps/forge/web/src/App.tsx`
- Modify: `apps/forge/web/src/i18n.ts`
- Modify: `apps/forge/web/src/styles.css`
- Test: `apps/forge/web/src/App.test.tsx`

- [ ] **Step 1: Write failing preview test**

Add to `apps/forge/web/src/App.test.tsx`:

```ts
it("previews rich Workflow template contracts", () => {
  const markup = renderToStaticMarkup(
    <App initialPage="workflow-templates" initialWorkflowTemplateDialog="new" />
  );

  expect(markup).toContain("Inputs");
  expect(markup).toContain("Skills");
  expect(markup).toContain("Agent Roles");
  expect(markup).toContain("Artifact Types");
  expect(markup).toContain("Exit Criteria");
  expect(markup).toContain("Review: model");
});
```

- [ ] **Step 2: Run Web test and verify RED**

Run:

```bash
pnpm --filter @forge/forge test -- web/src/App.test.tsx
```

Expected: FAIL because preview only renders executor, retry, outputs, and dependencies.

- [ ] **Step 3: Add preview helpers and markup**

In `apps/forge/web/src/App.tsx`, add helpers near `getWorkflowTemplateDisplayName`:

```ts
function getWorkflowOutputLabel(output: WorkflowNode["outputs"][number]) {
  if ("artifact" in output) {
    return `artifact:${output.artifact}`;
  }
  return output.ref;
}

function getWorkflowContractCountLabel(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}
```

Update preview summary to render contract stats for `inputs`, `skills`, `agents`, and `artifacts`. Update each node to render description, uses, inputs, outputs, Exit Criteria count, review mode, retry budget, and human review marker.

- [ ] **Step 4: Add localized labels**

In `apps/forge/web/src/i18n.ts`, add labels under `templatePage` in both locales:

```ts
inputsLabel: "Inputs",
skillsLabel: "Skills",
agentRolesLabel: "Agent Roles",
artifactTypesLabel: "Artifact Types",
exitCriteriaLabel: "Exit Criteria",
reviewMode: (mode: string) => `Review: ${mode}`,
humanReviewRequired: "Human review required",
usesLabel: "Uses",
nodeInputsLabel: "Node inputs"
```

Use equivalent Chinese labels in the Chinese locale.

- [ ] **Step 5: Add compact CSS**

In `apps/forge/web/src/styles.css`, add:

```css
.workflow-contract-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.workflow-contract-stat {
  border: 1px solid var(--color-line);
  border-radius: var(--radius-control);
  background: #ffffff;
  padding: 10px;
}

.workflow-node-contract {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
```

- [ ] **Step 6: Run Web tests and typecheck**

Run:

```bash
pnpm --filter @forge/forge test -- web/src/App.test.tsx
pnpm --filter @forge/forge typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/forge/web/src/App.tsx apps/forge/web/src/i18n.ts apps/forge/web/src/styles.css apps/forge/web/src/App.test.tsx
git commit -m "feat(web): preview workflow template contracts"
```

## Task 5: Final Integration Verification

**Files:**
- Modify only if tests expose integration defects.

- [ ] **Step 1: Run focused package checks**

Run:

```bash
pnpm --filter @forge/core test
pnpm --filter @forge/forge test
pnpm --filter @forge/forge typecheck
```

Expected: PASS.

- [ ] **Step 2: Run broader checks if focused checks pass**

Run:

```bash
pnpm typecheck
pnpm test
```

Expected: PASS or unrelated pre-existing failures documented with exact failing command and failure summary.

- [ ] **Step 3: Inspect Web visually if a dev server is feasible**

Run:

```bash
pnpm --filter @forge/forge dev
```

Open the Workflow Templates page and inspect:

- six default templates fit in the modal at desktop and mobile widths;
- preview contract stats do not overlap;
- node rows keep stable dimensions;
- legacy imported templates still show sensible fallback values.

- [ ] **Step 4: Final commit for test-only or integration fixes**

If Step 1 or Step 2 required fixes:

```bash
git add <changed-files>
git commit -m "fix: stabilize workflow template v1.1 integration"
```

