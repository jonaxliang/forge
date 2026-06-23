# Forge Workflow Template Reference

Use this reference when drafting or reviewing Forge Workflow File YAML.

## Minimal Skeleton

```yaml
name: "Example workflow"
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
    role: planner
artifacts:
  - id: plan
    type: markdown
    path: plan.md
nodes:
  - id: plan
    type: planning
    uses:
      - skill:planning
    inputs:
      - task
    outputs:
      - artifact: plan
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Plan names node order, artifacts, and review criteria.
      retryInstruction: Revise the plan to close missing scope or validation gaps.
```

## Supported Fields

Top-level fields:

- `name`: human-readable Workflow Template name.
- `version`: must be `"1.1"`.
- `inputs`: declared input contract.
- `skills`: local Skill IDs mapped to external Skill refs.
- `agents`: agent role declarations.
- `artifacts`: declared persistent outputs.
- `nodes`: Workflow Nodes in a DAG.

Workflow Node fields:

- `id`: unique node ID.
- `type`: node kind, such as `research`, `draft`, `review`, `code-change`.
- `description`: optional short explanation.
- `dependsOn`: string or list of upstream node IDs.
- `uses`: list of local Skill refs in `skill:<id>` form.
- `inputs`: `task` or `artifact:<id>` entries.
- `instruction`: optional `{ text: "..." }` or `{ ref: "..." }`.
- `outputs`: list such as `{ artifact: plan }`.
- `exit`: required retry and review rules.
- `humanReview`: optional; if required, set `exit.review: human`.

Artifact types:

- `markdown`
- `patch`
- `json`
- `report`
- `outline`
- `draft`

Review modes:

- `model`
- `human`
- `none`

## Interactive Questions

Ask these only when the answer is not already clear:

1. What should this Workflow Template be called?
2. Does it run on a Task, or does it need another input type?
3. What are the major Workflow Nodes, in order?
4. What persistent Artifacts should the workflow keep?
5. Which nodes require human review instead of model review?

## Naming Guidance

- IDs use lowercase hyphen-case: `research`, `outline`, `code-review`.
- Skill local IDs name the reusable capability: `planning`, `writing`, `review`.
- Agent roles name the worker responsibility: `planner`, `researcher`, `editor`.
- Artifact paths use simple filenames: `plan.md`, `review.md`, `draft.md`.

## Self-Check

Before returning YAML:

- Validate every `uses` item against top-level `skills`.
- Validate every `artifact:<id>` input and output against top-level `artifacts`.
- Ensure every non-first node has a valid `dependsOn` unless it is intentionally parallel.
- Ensure each `exit.criteria` item describes observable output quality.
- Remove unsupported fields such as `scope`, `goto`, `loop`, dynamic node creation, or arbitrary runtime branching.
