import { describe, expect, it } from "vitest";
import { parseWorkflowFile } from "./workflow-file";

describe("parseWorkflowFile", () => {
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
name: Requirement workflow
scope: requirement
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
});
