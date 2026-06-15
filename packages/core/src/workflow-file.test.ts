import { describe, expect, it } from "vitest";
import { parseWorkflowFile, workflowFileSchema } from "./workflow-file";

describe("parseWorkflowFile", () => {
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
      agents: [{ id: "planner", role: "implementation-planner" }],
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
      agents: [],
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

  it("parses requirement-scoped workflow files and normalizes after into dependsOn", () => {
    const workflow = parseWorkflowFile(`
name: Requirement workflow
scope: requirement
nodes:
  - id: clarify
    type: requirement-analysis
    executor: agent:planner
    exit:
      maxRetries: 0
  - id: split
    type: task-drafting
    after: clarify
    executor: agent:planner
    exit:
      maxRetries: 1
`);

    expect(workflow.scope).toBe("requirement");
    expect(workflow.nodes[1]?.dependsOn).toEqual(["clarify"]);
  });

  it("parses a task-scoped workflow file with node exit criteria", () => {
    const workflow = parseWorkflowFile(`
name: Coding workflow
scope: task
nodes:
  - id: analyze
    type: requirement-analysis
    executor: skill:requirements
    outputs:
      - analysis.md
    exit:
      maxRetries: 2
  - id: implement
    type: coding
    dependsOn:
      - analyze
    executor: skill:code
    outputs:
      - diff.patch
    exit:
      maxRetries: 1
`);

    expect(workflow).toMatchObject({
      name: "Coding workflow",
      scope: "task",
      nodes: [
        {
          id: "analyze",
          exit: {
            maxRetries: 2
          }
        },
        {
          id: "implement",
          dependsOn: ["analyze"]
        }
      ]
    });
  });

  it("normalizes after into dependsOn", () => {
    const workflow = parseWorkflowFile(`
name: Planning workflow
scope: task
nodes:
  - id: clarify
    type: analysis
    executor: skill:analysis
    exit:
      maxRetries: 0
  - id: draft
    type: writing
    after: clarify
    executor: skill:writing
    exit:
      maxRetries: 1
`);

    expect(workflow.nodes[1]?.dependsOn).toEqual(["clarify"]);
  });

  it("merges dependsOn and after into dependsOn without duplicates", () => {
    const workflow = parseWorkflowFile(`
name: Combined dependency workflow
scope: task
nodes:
  - id: a
    type: first
    executor: skill:first
    exit:
      maxRetries: 0
  - id: b
    type: second
    executor: skill:second
    exit:
      maxRetries: 0
  - id: c
    type: third
    dependsOn:
      - a
      - b
    after: b
    executor: skill:third
    exit:
      maxRetries: 1
`);

    expect(workflow.nodes[2]?.dependsOn).toEqual(["a", "b"]);
  });

  it("rejects unknown after dependencies when dependsOn is also present", () => {
    expect(() =>
      parseWorkflowFile(`
name: Invalid combined dependency workflow
scope: task
nodes:
  - id: a
    type: first
    executor: skill:first
    exit:
      maxRetries: 0
  - id: c
    type: third
    dependsOn:
      - a
    after: missing
    executor: skill:third
    exit:
      maxRetries: 1
`)
    ).toThrow(/unknown dependency/i);
  });

  it("rejects cyclic node dependencies", () => {
    expect(() =>
      parseWorkflowFile(`
name: Cyclic workflow
scope: task
nodes:
  - id: a
    type: first
    after: b
    executor: skill:first
    exit:
      maxRetries: 1
  - id: b
    type: second
    after: a
    executor: skill:second
    exit:
      maxRetries: 1
`)
    ).toThrow(/cycle/i);
  });

  it("rejects dependencies that point to unknown nodes", () => {
    expect(() =>
      parseWorkflowFile(`
name: Missing dependency workflow
scope: task
nodes:
  - id: implement
    type: coding
    dependsOn:
      - analyze
    executor: skill:code
    exit:
      maxRetries: 1
`)
    ).toThrow(/unknown dependency/i);
  });

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

  it("rejects node artifact outputs that are not declared", () => {
    expect(() =>
      parseWorkflowFile(`
name: Missing artifact output
scope: task
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
    outputs:
      - artifact:plan
    exit:
      maxRetries: 1
`)
    ).toThrow(/unknown artifact output/i);
  });

  it("rejects artifact outputs with empty ids", () => {
    expect(() =>
      parseWorkflowFile(`
name: Empty artifact output
scope: task
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
    outputs:
      - "artifact:"
    exit:
      maxRetries: 1
`)
    ).toThrow(/artifact output/i);

    expect(() =>
      parseWorkflowFile(`
name: Blank artifact output
scope: task
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
    outputs:
      - artifact: "   "
    exit:
      maxRetries: 1
`)
    ).toThrow(/artifact output/i);
  });

  it("rejects file outputs with empty refs", () => {
    expect(() =>
      parseWorkflowFile(`
name: Empty file output
scope: task
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
    outputs:
      - " "
    exit:
      maxRetries: 1
`)
    ).toThrow(/Invalid workflow file/i);
  });

  it("rejects node artifact inputs that are not declared", () => {
    expect(() =>
      parseWorkflowFile(`
name: Missing artifact input
scope: task
nodes:
  - id: code
    type: code-change
    executor: agent:coder
    inputs:
      - artifact:plan
    exit:
      maxRetries: 1
`)
    ).toThrow(/unknown artifact input/i);
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

  it("accepts required human review with human exit review mode", () => {
    const workflow = parseWorkflowFile(`
name: Human review workflow
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
      review: human
`);

    expect(workflow.nodes[0]).toMatchObject({
      exit: {
        review: "human"
      },
      humanReview: {
        reason: "User approval is required.",
        required: true
      }
    });
  });

  it("normalizes legacy objects parsed through the exported schema", () => {
    const workflow = workflowFileSchema.parse({
      name: "Legacy object workflow",
      scope: "task",
      nodes: [
        {
          id: "code",
          type: "code-change",
          dependsOn: [],
          executor: "agent:coder",
          outputs: ["diff.patch"],
          exit: {
            maxRetries: 2
          }
        }
      ]
    });

    expect(workflow).toMatchObject({
      agents: [],
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
          inputs: [],
          outputs: [{ kind: "file", ref: "diff.patch" }],
          uses: []
        }
      ]
    });
  });

  it("rejects invalid dependencies parsed through the exported schema", () => {
    expect(() =>
      workflowFileSchema.parse({
        name: "Invalid dependency object workflow",
        scope: "task",
        nodes: [
          {
            id: "code",
            type: "code-change",
            dependsOn: ["missing"],
            executor: "agent:coder",
            exit: {
              maxRetries: 1
            }
          }
        ]
      })
    ).toThrow(/unknown dependency/i);
  });

  it("rejects duplicate resources parsed through the exported schema", () => {
    expect(() =>
      workflowFileSchema.parse({
        name: "Duplicate skill object workflow",
        scope: "task",
        skills: [
          {
            id: "planning",
            ref: "skill:one"
          },
          {
            id: "planning",
            ref: "skill:two"
          }
        ],
        nodes: [
          {
            id: "plan",
            type: "implementation-plan",
            executor: "agent:planner",
            exit: {
              maxRetries: 1
            }
          }
        ]
      })
    ).toThrow(/duplicate workflow skill id/i);
  });
});
