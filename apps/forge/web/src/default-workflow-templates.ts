import { parseWorkflowFile, type WorkflowFile } from "@forge/core";

export type DefaultWorkflowTemplateKey =
  | "software-change-task"
  | "research-writing-task"
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
  createDefaultWorkflowTemplate("software-change-task", `name: "代码编写模板"
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
    dependsOn: plan
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
    dependsOn: implement
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
    dependsOn: verify
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
    dependsOn: review
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
  createDefaultWorkflowTemplate("research-writing-task", `name: "调研写作模板"
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
    dependsOn: research
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
    dependsOn: outline
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
    dependsOn: draft
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
  createDefaultWorkflowTemplate("creative-writing-task", `name: "创意写作模板"
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
    dependsOn: outline
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
    dependsOn: draft
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
    dependsOn: revise
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
