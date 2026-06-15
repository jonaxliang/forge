# Workflow Template Schema v1.1

Date: 2026-06-15

## Context

Forge already imports and previews `.wf` Workflow Files, but the current schema is intentionally small:

- `name`
- `scope`
- `nodes`
- node `id`, `type`, `dependsOn` or `after`, `executor`, `outputs`, `exit.maxRetries`

This proves DAG parsing and preview, but the default Workflow Templates can still feel close to prompt presets. To make templates clearly better than directly writing prompts to AI, `.wf` needs to express a structured work contract: what context enters the workflow, what reusable capabilities are allowed, what each Workflow Node must produce, and how Forge decides whether a node can advance.

## Goals

1. Make Workflow Templates more controllable than prompts by adding explicit inputs, outputs, Exit Criteria, review policy, and retry instructions.
2. Make Workflow Templates reusable by declaring Skill, Agent Role, and Artifact Type references at the Workflow File level.
3. Make Workflow Templates traceable by giving every important Workflow Node a structured artifact contract and review result.
4. Preserve backward compatibility for existing `.wf` files.
5. Keep MVP execution DAG-based with node-local retries. Do not introduce loops, `goto`, or runtime node generation.
6. Keep pure parsing, validation, and normalization logic in `packages/core`.

## Non-Goals

- Do not build a full `.wf` registry in this pass.
- Do not add arbitrary runtime-generated Workflow Nodes.
- Do not require all Skill, Agent Role, or Artifact Type references to exist in a persisted registry before import.
- Do not replace existing prompt or instruction usage. Prompts can still be referenced, but they become one part of the structured contract.
- Do not implement a visual workflow editor in this pass.

## Recommended Approach

Implement `.wf` schema v1.1 as an additive schema evolution. Existing v1 `.wf` files continue to parse and normalize into the richer internal representation with empty defaults.

The schema should add four top-level resource sections:

- `inputs`: workflow-level context expected from the Requirement or Task.
- `skills`: reusable Skill references available to Workflow Nodes.
- `agents`: Agent Role definitions used by Workflow Nodes.
- `artifacts`: Artifact Type definitions that Workflow Nodes can produce or consume.

Each Workflow Node should add:

- `description`: short operational purpose.
- `inputs`: node-local input references.
- `outputs`: structured artifact outputs, while still accepting the legacy string list.
- `instruction`: inline instruction or reference to a named prompt/Skill instruction.
- `exit.criteria`: checklist-style acceptance criteria.
- `exit.review`: `model`, `human`, or `none`.
- `exit.retryInstruction`: guidance used when retrying the node.
- `humanReview`: optional policy for nodes that need explicit human approval.

This keeps the workflow file readable while making execution less dependent on one large prompt.

## Schema Shape

Example:

```yaml
name: Software Change Task
scope: task
version: "1.1"
inputs:
  - id: task
    type: task
    required: true
  - id: repository_context
    type: context
    required: true
skills:
  - id: planning
    ref: skill:implementation-planning
  - id: code
    ref: skill:code-change
agents:
  - id: planner
    role: implementation-planner
  - id: coder
    role: code-agent
  - id: reviewer
    role: code-reviewer
artifacts:
  - id: plan
    type: markdown
    path: plan.md
  - id: patch
    type: patch
    path: diff.patch
  - id: verification
    type: markdown
    path: verification.md
nodes:
  - id: plan
    type: implementation-plan
    description: Turn the Task into a scoped implementation plan.
    executor: agent:planner
    uses:
      - skill:planning
    inputs:
      - task
      - repository_context
    instruction:
      ref: prompt:implementation-plan
    outputs:
      - artifact:plan
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Plan names files or modules likely to change.
        - Plan includes verification commands.
      retryInstruction: Revise the plan to close missing scope or verification gaps.
  - id: code
    type: code-change
    after: plan
    executor: agent:coder
    uses:
      - skill:code
    inputs:
      - artifact:plan
    outputs:
      - artifact:patch
    exit:
      maxRetries: 2
      review: model
      criteria:
        - Patch follows the approved plan or explains deviations.
        - Patch avoids unrelated refactors.
      retryInstruction: Fix only the failed criterion and preserve unrelated user changes.
  - id: verify
    type: test-and-typecheck
    after: code
    executor: agent:coder
    inputs:
      - artifact:patch
    outputs:
      - artifact:verification
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Verification lists commands that ran.
        - Failures include the exact failing command and next fix.
      retryInstruction: Re-run only the missing or failed verification commands.
  - id: review
    type: code-review
    after: verify
    executor: agent:reviewer
    inputs:
      - artifact:patch
      - artifact:verification
    outputs:
      - review.md
    humanReview:
      required: true
      reason: Merge readiness needs user confirmation.
    exit:
      maxRetries: 1
      review: human
      criteria:
        - Findings are listed before summaries.
        - Blocking issues are tied to files or commands.
      retryInstruction: Re-run review after the author resolves blocking issues.
```

## Compatibility Rules

1. Missing `version` means v1.
2. Legacy `outputs: ["analysis.md"]` remains valid and normalizes to an artifact output with unknown type:
   - `ref: "analysis.md"`
   - `kind: "file"`
3. `after` remains an alias for `dependsOn`.
4. Missing top-level `inputs`, `skills`, `agents`, and `artifacts` normalize to empty arrays.
5. Missing `exit.criteria`, `exit.review`, and `exit.retryInstruction` normalize to:
   - `criteria: []`
   - `review: "model"`
   - `retryInstruction: ""`
6. Node `executor` remains required for now.

## Validation Rules

Core validation should stay deterministic and side-effect free:

- Workflow scope must be `requirement` or `task`.
- Workflow Nodes must have unique IDs.
- `dependsOn` and `after` must reference known Workflow Nodes.
- The dependency graph must be a DAG.
- Top-level resource IDs must be unique within their section.
- Node `uses` references must point to declared local `skills` using `skill:<id>`. The declared Skill `ref` may point to an external registry, local Skill, or future connector target.
- Node `inputs` and `outputs` may reference declared artifacts or external file names.
- `exit.maxRetries` must be a non-negative integer.
- `exit.criteria` must be non-empty for built-in v1.1 templates, but optional for imported legacy files.
- `humanReview.required: true` implies `exit.review: human` or emits a clear validation error.

## Product Behavior

### Import

The import API should accept both v1 and v1.1 `.wf` sources. It stores the normalized Workflow File definition so UI and future execution code read a stable shape.

Invalid references should produce actionable messages, for example:

- `Unknown skill reference "skill:planning" for workflow node "plan"`
- `humanReview.required requires exit.review: human for workflow node "review"`

### Preview

The Web template preview should show why the template is more than a prompt:

- Workflow-level input contract.
- Declared Skill and Agent Role count.
- Declared Artifact Types.
- For each Workflow Node:
  - purpose
  - executor
  - used skills
  - input references
  - artifact outputs
  - Exit Criteria count
  - review mode
  - retry budget
  - human review marker when present

The preview should stay compact and operational. Avoid turning it into a document viewer.

### Built-In Templates

Default Workflow Templates should be expanded to prove Forge is not coding-only:

1. Software Change Requirement Workflow Template
2. Software Change Task Workflow Template
3. Research & Writing Requirement Workflow Template
4. Research & Writing Task Workflow Template
5. Creative Writing Requirement Workflow Template
6. Creative Writing Task Workflow Template

Each built-in template should include:

- Workflow-level inputs.
- Skill and Agent Role declarations.
- Artifact Type declarations.
- At least four Workflow Nodes.
- Exit Criteria for every Workflow Node.
- At least one review or approval gate where appropriate.

## Data Flow

1. User imports or selects a `.wf`.
2. `packages/core` parses YAML, validates schema, normalizes legacy fields, validates DAG and references.
3. Forge Server persists the normalized definition as Workflow File metadata.
4. Web reads Workflow File metadata and renders the structured preview.
5. Future Workflow Runs can use the normalized definition to create Node Runs, attach Artifact Versions, and record review outcomes.

## Subagent Implementation Split

After this spec is approved, implementation can be split across parallel agents:

1. Core/schema agent
   - Update `packages/core/src/workflow-file.ts`.
   - Add parser, normalization, and validation tests.
   - Add built-in template parse fixtures if templates are moved out of React code.

2. Server/persistence agent
   - Ensure import API stores normalized v1.1 definitions.
   - Add API tests for old v1 imports and rich v1.1 imports.
   - Keep DB shape stable unless a typed metadata column is already required.

3. Web/preview agent
   - Expand default templates.
   - Render structured template contract in the template manager.
   - Add SSR/component tests for v1 and v1.1 preview states.

These agents should not overlap files where possible. If default templates remain in `App.tsx`, the Web agent owns that file and the Core agent should use test fixtures instead.

## Testing

Minimum verification:

- `pnpm --filter @forge/core test`
- `pnpm --filter @forge/forge test`
- `pnpm --filter @forge/forge typecheck`

Core test cases:

- Parses legacy v1 Workflow Files.
- Parses v1.1 Workflow Files.
- Normalizes legacy string outputs.
- Rejects unknown node dependencies.
- Rejects dependency cycles.
- Rejects duplicate resource IDs.
- Rejects inconsistent human review configuration.

Web test cases:

- Default template picker lists all six built-in templates.
- Preview shows input contract, artifacts, Skill count, Agent Role count, review mode, and Exit Criteria count.
- Legacy Workflow Files still preview without crashing.

## Risks

- Adding too many schema fields can make `.wf` harder to write by hand. Keep fields optional for imports and strict only for built-in templates.
- If templates stay embedded in `App.tsx`, the file will keep growing. Prefer moving built-in `.wf` source and parsed metadata into a focused module during implementation.
- Validating external Skill or Agent Binding existence during import would couple schema parsing to project state. Defer that to execution or a later registry pass.

## Design Decisions

1. `instruction` supports both `ref` and `text`. Built-in templates should prefer `ref` so prompts remain reusable.
2. `artifacts.type` uses simple Forge-specific types in this pass: `markdown`, `patch`, `json`, `report`, `outline`, and `draft`.
3. Workflow Nodes must declare reusable capability usage through local `skills` IDs. Imported templates do not need the external Skill to exist in a registry yet, but each node-level `uses` entry must resolve to a top-level `skills` item.
