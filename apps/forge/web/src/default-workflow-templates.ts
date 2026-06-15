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
  return { key, source, workflow: parseWorkflowFile(source) };
}

export const defaultWorkflowTemplates: readonly DefaultWorkflowTemplate[] = [
  createDefaultWorkflowTemplate("software-change-requirement", `name: "Software Change Requirement"
scope: requirement
version: "1.1"
inputs:
  - id: requirement
    type: requirement
    required: true
skills:
  - id: analysis
    ref: skill:software-requirement-analysis
  - id: task-drafting
    ref: skill:task-drafting
  - id: risk-review
    ref: skill:risk-review
agents:
  - id: analyst
    role: requirement-analyst
  - id: planner
    role: task-planner
  - id: reviewer
    role: delivery-reviewer
artifacts:
  - id: requirement-brief
    type: markdown
    path: requirement-brief.md
  - id: task-drafts
    type: json
    path: task-drafts.json
  - id: risk-check
    type: report
    path: risk-check.md
  - id: approval-notes
    type: markdown
    path: approval-notes.md
nodes:
  - id: intake
    type: requirement-intake
    executor: agent:analyst
    uses:
      - skill:analysis
    inputs:
      - requirement
    outputs:
      - artifact: requirement-brief
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Requirement goals, constraints, and acceptance signals are captured.
      retryInstruction: Tighten the Requirement brief around missing scope or constraints.
  - id: draft-tasks
    type: task-drafting
    after: intake
    executor: agent:planner
    uses:
      - skill:task-drafting
    inputs:
      - artifact:requirement-brief
    outputs:
      - artifact: task-drafts
    exit:
      maxRetries: 2
      review: model
      criteria:
        - Task Drafts are independently executable and trace back to the Requirement.
      retryInstruction: Split oversized work and preserve Requirement traceability.
  - id: risk-review
    type: risk-review
    after: draft-tasks
    executor: agent:reviewer
    uses:
      - skill:risk-review
    inputs:
      - artifact:task-drafts
    outputs:
      - artifact: risk-check
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Risks, dependencies, and verification gaps are named before approval.
      retryInstruction: Call out missing risk, dependency, or verification details.
  - id: package
    type: requirement-package
    after: risk-review
    executor: agent:planner
    uses:
      - skill:task-drafting
    inputs:
      - artifact:task-drafts
      - artifact:risk-check
    outputs:
      - artifact: approval-notes
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Final package includes Task Drafts, risk notes, and approval guidance.
      retryInstruction: Complete the package with missing approval or handoff details.
`,
  ),
  createDefaultWorkflowTemplate("software-change-task", `name: "Software Change Task"
scope: task
version: "1.1"
inputs:
  - id: task
    type: task
    required: true
skills:
  - id: planning
    ref: skill:implementation-planning
  - id: coding
    ref: skill:code-change
  - id: verification
    ref: skill:verification
  - id: review
    ref: skill:code-review
agents:
  - id: planner
    role: implementation-planner
  - id: coder
    role: software-engineer
  - id: tester
    role: verification-engineer
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
    type: report
    path: verification.md
  - id: review
    type: markdown
    path: review.md
  - id: handoff
    type: markdown
    path: handoff.md
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
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
        - Plan names target files, risks, and the narrow verification path.
      retryInstruction: Revise the plan to close scope and verification gaps.
  - id: implement
    type: code-change
    after: plan
    executor: agent:coder
    uses:
      - skill:coding
    inputs:
      - artifact:plan
    outputs:
      - artifact: patch
    exit:
      maxRetries: 2
      review: model
      criteria:
        - Patch implements the Task without unrelated refactors.
      retryInstruction: Keep the patch surgical and aligned to the plan.
  - id: verify
    type: test-and-typecheck
    after: implement
    executor: agent:tester
    uses:
      - skill:verification
    inputs:
      - artifact:patch
    outputs:
      - artifact: verification
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Verification output lists commands run and any skipped checks.
      retryInstruction: Run the narrowest relevant checks or explain blockers precisely.
  - id: review
    type: code-review
    after: verify
    executor: agent:reviewer
    uses:
      - skill:review
    inputs:
      - artifact:patch
      - artifact:verification
    outputs:
      - artifact: review
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Review identifies blocking issues or explicitly clears the change.
      retryInstruction: Ground review findings in file and behavior references.
  - id: handoff
    type: delivery-handoff
    after: review
    executor: agent:planner
    uses:
      - skill:planning
    inputs:
      - artifact:review
    outputs:
      - artifact: handoff
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Handoff summarizes changed behavior, verification, and residual risk.
      retryInstruction: Fill in missing verification or residual-risk notes.
`,
  ),
  createDefaultWorkflowTemplate("research-writing-requirement", `name: "Research & Writing Requirement"
scope: requirement
version: "1.1"
inputs:
  - id: requirement
    type: requirement
    required: true
skills:
  - id: research-planning
    ref: skill:research-planning
  - id: source-evaluation
    ref: skill:source-evaluation
  - id: brief-writing
    ref: skill:brief-writing
  - id: task-drafting
    ref: skill:task-drafting
agents:
  - id: researcher
    role: research-planner
  - id: analyst
    role: research-analyst
  - id: editor
    role: brief-editor
artifacts:
  - id: research-plan
    type: outline
    path: research-plan.md
  - id: source-map
    type: markdown
    path: source-map.md
  - id: brief
    type: markdown
    path: brief.md
  - id: task-drafts
    type: json
    path: task-drafts.json
nodes:
  - id: frame
    type: research-framing
    executor: agent:researcher
    uses:
      - skill:research-planning
    inputs:
      - requirement
    outputs:
      - artifact: research-plan
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Research questions, audience, and decision needs are explicit.
      retryInstruction: Clarify audience, decision needs, or research boundaries.
  - id: source-map
    type: source-evaluation
    after: frame
    executor: agent:researcher
    uses:
      - skill:source-evaluation
    inputs:
      - artifact:research-plan
    outputs:
      - artifact: source-map
    exit:
      maxRetries: 2
      review: model
      criteria:
        - Source map separates facts, assumptions, and open questions.
      retryInstruction: Add missing evidence categories or unresolved questions.
  - id: synthesize
    type: research-synthesis
    after: source-map
    executor: agent:analyst
    uses:
      - skill:brief-writing
    inputs:
      - artifact:source-map
    outputs:
      - artifact: brief
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Brief connects evidence to recommendations and writing constraints.
      retryInstruction: Tie findings back to the requested decision or draft.
  - id: draft-tasks
    type: task-drafting
    after: synthesize
    executor: agent:editor
    uses:
      - skill:task-drafting
    inputs:
      - artifact:brief
    outputs:
      - artifact: task-drafts
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Task Drafts split research, drafting, and review work cleanly.
      retryInstruction: Separate unclear research, writing, or editorial work.
`,
  ),
  createDefaultWorkflowTemplate("research-writing-task", `name: "Research & Writing Task"
scope: task
version: "1.1"
inputs:
  - id: task
    type: task
    required: true
skills:
  - id: research
    ref: skill:research
  - id: writing
    ref: skill:writing
  - id: editorial-review
    ref: skill:editorial-review
agents:
  - id: researcher
    role: researcher
  - id: writer
    role: writer
  - id: editor
    role: editor
  - id: reviewer
    role: reviewer
artifacts:
  - id: notes
    type: markdown
    path: notes.md
  - id: outline
    type: outline
    path: outline.md
  - id: draft
    type: draft
    path: draft.md
  - id: editorial-review
    type: markdown
    path: editorial-review.md
nodes:
  - id: research
    type: research
    executor: agent:researcher
    uses:
      - skill:research
    inputs:
      - task
    outputs:
      - artifact: notes
    exit:
      maxRetries: 2
      review: model
      criteria:
        - Notes include relevant evidence, source gaps, and constraints.
      retryInstruction: Add missing evidence, caveats, or constraints.
  - id: outline
    type: writing-outline
    after: research
    executor: agent:writer
    uses:
      - skill:writing
    inputs:
      - artifact:notes
    outputs:
      - artifact: outline
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Outline matches the audience, thesis, and required sections.
      retryInstruction: Restructure the outline around the audience and thesis.
  - id: draft
    type: writing-draft
    after: outline
    executor: agent:writer
    uses:
      - skill:writing
    inputs:
      - artifact:outline
    outputs:
      - artifact: draft
    exit:
      maxRetries: 2
      review: model
      criteria:
        - Draft follows the outline and distinguishes evidence from interpretation.
      retryInstruction: Revise the draft for structure, evidence, and clarity.
  - id: edit
    type: editorial-review
    after: draft
    executor: agent:editor
    uses:
      - skill:editorial-review
    inputs:
      - artifact:draft
    outputs:
      - artifact: editorial-review
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Editorial review names required revisions or clears the draft.
      retryInstruction: Make revision requests specific and actionable.
`,
  ),
  createDefaultWorkflowTemplate("creative-writing-requirement", `name: "Creative Writing Requirement"
scope: requirement
version: "1.1"
inputs:
  - id: requirement
    type: requirement
    required: true
skills:
  - id: creative-brief
    ref: skill:creative-brief
  - id: audience-analysis
    ref: skill:audience-analysis
  - id: creative-outline
    ref: skill:creative-outline
  - id: task-drafting
    ref: skill:task-drafting
agents:
  - id: strategist
    role: creative-strategist
  - id: writer
    role: creative-writer
  - id: editor
    role: creative-editor
artifacts:
  - id: creative-brief
    type: markdown
    path: creative-brief.md
  - id: audience-notes
    type: markdown
    path: audience-notes.md
  - id: outline
    type: outline
    path: outline.md
  - id: task-drafts
    type: json
    path: task-drafts.json
nodes:
  - id: interpret
    type: creative-brief
    executor: agent:strategist
    uses:
      - skill:creative-brief
    inputs:
      - requirement
    outputs:
      - artifact: creative-brief
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Creative brief captures purpose, tone, format, and hard constraints.
      retryInstruction: Clarify missing purpose, tone, format, or constraints.
  - id: audience
    type: audience-analysis
    after: interpret
    executor: agent:strategist
    uses:
      - skill:audience-analysis
    inputs:
      - artifact:creative-brief
    outputs:
      - artifact: audience-notes
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Audience notes explain reader expectations and sensitivity boundaries.
      retryInstruction: Add missing audience expectations or content boundaries.
  - id: shape
    type: creative-outline
    after: audience
    executor: agent:writer
    uses:
      - skill:creative-outline
    inputs:
      - artifact:creative-brief
      - artifact:audience-notes
    outputs:
      - artifact: outline
    exit:
      maxRetries: 2
      review: model
      criteria:
        - Outline supports the requested arc, voice, and deliverable shape.
      retryInstruction: Reshape the outline around voice, arc, and deliverable needs.
  - id: draft-tasks
    type: task-drafting
    after: shape
    executor: agent:editor
    uses:
      - skill:task-drafting
    inputs:
      - artifact:outline
    outputs:
      - artifact: task-drafts
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Task Drafts separate drafting, revision, and approval responsibilities.
      retryInstruction: Split unclear creative writing work into executable Task Drafts.
`,
  ),
  createDefaultWorkflowTemplate("creative-writing-task", `name: "Creative Writing Task"
scope: task
version: "1.1"
inputs:
  - id: task
    type: task
    required: true
skills:
  - id: drafting
    ref: skill:creative-drafting
  - id: revision
    ref: skill:creative-revision
  - id: editorial-review
    ref: skill:editorial-review
agents:
  - id: writer
    role: creative-writer
  - id: editor
    role: creative-editor
  - id: reviewer
    role: approval-reviewer
artifacts:
  - id: outline
    type: outline
    path: outline.md
  - id: draft
    type: draft
    path: draft.md
  - id: revision
    type: draft
    path: revision.md
  - id: final
    type: markdown
    path: final.md
nodes:
  - id: outline
    type: creative-outline
    executor: agent:writer
    uses:
      - skill:drafting
    inputs:
      - task
    outputs:
      - artifact: outline
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Outline names the creative premise, structure, and tone guardrails.
      retryInstruction: Clarify premise, structure, or tone guardrails.
  - id: draft
    type: creative-draft
    after: outline
    executor: agent:writer
    uses:
      - skill:drafting
    inputs:
      - artifact:outline
    outputs:
      - artifact: draft
    exit:
      maxRetries: 2
      review: model
      criteria:
        - Draft follows the outline and preserves the requested voice.
      retryInstruction: Revise for voice, structure, and completeness.
  - id: revise
    type: creative-revision
    after: draft
    executor: agent:editor
    uses:
      - skill:revision
    inputs:
      - artifact:draft
    outputs:
      - artifact: revision
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Revision addresses clarity, pacing, and instruction fit.
      retryInstruction: Revise against clarity, pacing, and requested constraints.
  - id: approve
    type: creative-approval
    after: revise
    executor: agent:reviewer
    uses:
      - skill:editorial-review
    inputs:
      - artifact:revision
    outputs:
      - artifact: final
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Final output is ready for handoff with no unresolved editorial blockers.
      retryInstruction: Resolve remaining editorial blockers before final handoff.
`,
  )
];
