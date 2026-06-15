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
      - artifact: plan
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

  it("rejects workflow files without the current schema version", () => {
    expect(() =>
      parseWorkflowFile(`
name: Missing version workflow
scope: task
nodes:
  - id: code
    type: code-change
    executor: agent:coder
    exit:
      maxRetries: 2
`)
    ).toThrow(/Invalid workflow file/i);
  });

  it("rejects old workflow schema versions", () => {
    expect(() =>
      parseWorkflowFile(`
name: Old version workflow
scope: task
version: "1"
nodes:
  - id: code
    type: code-change
    executor: agent:coder
    exit:
      maxRetries: 2
`)
    ).toThrow(/Invalid workflow file/i);
  });

  it("parses requirement-scoped workflow files with explicit dependencies", () => {
    const workflow = parseWorkflowFile(`
name: Requirement workflow
scope: requirement
version: "1.1"
nodes:
  - id: clarify
    type: requirement-analysis
    executor: agent:planner
    exit:
      maxRetries: 0
  - id: split
    type: task-drafting
    dependsOn: clarify
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
version: "1.1"
nodes:
  - id: analyze
    type: requirement-analysis
    executor: skill:requirements
    outputs:
      - kind: file
        ref: analysis.md
    exit:
      maxRetries: 2
  - id: implement
    type: coding
    dependsOn:
      - analyze
    executor: skill:code
    outputs:
      - kind: file
        ref: diff.patch
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

  it("parses multiple dependencies", () => {
    const workflow = parseWorkflowFile(`
name: Combined dependency workflow
scope: task
version: "1.1"
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
    executor: skill:third
    exit:
      maxRetries: 1
`);

    expect(workflow.nodes[2]?.dependsOn).toEqual(["a", "b"]);
  });

  it("rejects the old after dependency alias", () => {
    expect(() =>
      parseWorkflowFile(`
name: Old dependency alias workflow
scope: task
version: "1.1"
nodes:
  - id: a
    type: first
    executor: skill:first
    exit:
      maxRetries: 0
  - id: c
    type: third
    after: a
    executor: skill:third
    exit:
      maxRetries: 1
`)
    ).toThrow(/unrecognized key/i);
  });

  it("rejects cyclic node dependencies", () => {
    expect(() =>
      parseWorkflowFile(`
name: Cyclic workflow
scope: task
version: "1.1"
nodes:
  - id: a
    type: first
    dependsOn: b
    executor: skill:first
    exit:
      maxRetries: 1
  - id: b
    type: second
    dependsOn: a
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
version: "1.1"
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
version: "1.1"
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
version: "1.1"
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
version: "1.1"
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
    outputs:
      - artifact: plan
    exit:
      maxRetries: 1
`)
    ).toThrow(/unknown artifact output/i);
  });

  it("rejects artifact outputs with empty ids", () => {
    expect(() =>
      parseWorkflowFile(`
name: String artifact output
scope: task
version: "1.1"
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
    outputs:
      - artifact:plan
    exit:
      maxRetries: 1
`)
    ).toThrow(/Invalid workflow file/i);

    expect(() =>
      parseWorkflowFile(`
name: Blank artifact output
scope: task
version: "1.1"
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
    outputs:
      - artifact: "   "
    exit:
      maxRetries: 1
`)
    ).toThrow(/Invalid workflow file/i);
  });

  it("rejects file outputs with empty refs", () => {
    expect(() =>
      parseWorkflowFile(`
name: Empty file output
scope: task
version: "1.1"
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
    outputs:
      - kind: file
        ref: " "
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
version: "1.1"
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
version: "1.1"
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
version: "1.1"
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

  it("rejects old objects parsed through the exported schema", () => {
    expect(() =>
      workflowFileSchema.parse({
        name: "Old object workflow",
        scope: "task",
        version: "1",
        nodes: [
          {
            id: "code",
            type: "code-change",
            dependsOn: [],
            executor: "agent:coder",
            outputs: [{ kind: "file", ref: "diff.patch" }],
            exit: {
              maxRetries: 2
            }
          }
        ]
      })
    ).toThrow();
  });

  it("rejects string outputs parsed through the exported schema", () => {
    expect(() =>
      workflowFileSchema.parse({
        name: "String output workflow",
        scope: "task",
        version: "1.1",
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
      })
    ).toThrow();
  });

  it("rejects invalid dependencies parsed through the exported schema", () => {
    expect(() =>
      workflowFileSchema.parse({
        name: "Invalid dependency object workflow",
        scope: "task",
        version: "1.1",
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
        version: "1.1",
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
