---
name: forge-workflow
description: Use when creating, refining, or reviewing Forge Workflow Template source files from natural language, including .wf YAML, Workflow Nodes, Skill refs, Agent roles, Artifact refs, Exit Criteria, retries, DAG dependencies, or interactive workflow authoring.
---

# Forge Workflow

## Overview

Use this skill to turn a natural-language process into a valid Forge Workflow Template source file. Forge Workflow Files use `.wf` YAML, `version: "1.1"`, DAG-based Workflow Nodes, declared Skill refs, Agent roles, Artifact refs, and node-local Exit Criteria.

Load `references/workflow-template.md` before drafting or reviewing a `.wf` file.

## Interactive Creation Loop

Ask only the smallest set of questions needed to produce a valid template. Prefer confirming assumptions over blocking on details.

1. Capture the intent.
   Identify the work domain, Workflow Template name, target user, and what successful completion produces.

2. Identify the input contract.
   Default to one required input:
   `id: task`, `type: task`, `required: true`.

3. Shape Workflow Nodes.
   Turn the user's process into 3-7 node-local responsibilities. Keep nodes sequential unless the user explicitly describes independent branches.

4. Declare reusable resources.
   For every node, declare:
   - one local `skills` entry and a `skill:<id>` use
   - one `agents` role when the role is meaningful
   - one or more `artifacts` if the node produces persistent output

5. Add Exit Criteria.
   Every node must include `exit.maxRetries`, `exit.review`, `exit.criteria`, and `exit.retryInstruction`. Use concrete criteria that can be judged from the node output.

6. Review with the user.
   Show a short outline first: node order, artifacts, Skill refs, and review mode. Ask for confirmation before emitting the final `.wf` when the workflow is complex or ambiguous.

7. Emit the `.wf`.
   Output one complete YAML block ready to import into Forge, followed by a short assumptions section.

## Constraints

- Use Forge domain language: Workflow Template, Workflow File, Workflow Node, Skill, Agent, Artifact, Exit Criteria.
- Use only supported artifact types: `markdown`, `patch`, `json`, `report`, `outline`, `draft`.
- Keep Workflow Files DAG-based. Do not create loops, `goto`, or runtime node generation.
- Every node `uses` entry must reference a declared local Skill by `skill:<local skill id>`.
- Every artifact output must reference a declared top-level Artifact.
- `humanReview.required: true` requires `exit.review: human`.
- Keep generated YAML concise and importable; do not add unsupported top-level fields.

## Quality Gate

Before final output, check:

- All `id` values are unique in their section.
- Every `dependsOn` target is an existing Workflow Node.
- Node dependencies do not form a cycle.
- Every `artifact:<id>` input and output points to a declared Artifact.
- Each node has at least one specific Exit Criteria item.
- The final response names any assumptions that the user did not explicitly confirm.

## Reference

Use `references/workflow-template.md` for the `.wf` skeleton, supported field summary, and a compact example.
