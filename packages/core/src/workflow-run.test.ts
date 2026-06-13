import { describe, expect, it } from "vitest";
import { getNextRunnableNode, nodeStatuses, planWorkflowDag } from "./workflow-run";
import type { WorkflowFile } from "./workflow-file";

const workflow: WorkflowFile = {
  name: "Task workflow",
  scope: "task",
  nodes: [
    {
      id: "plan",
      type: "planning",
      dependsOn: [],
      executor: "skill:plan",
      outputs: [],
      exit: {
        maxRetries: 1
      }
    },
    {
      id: "code",
      type: "coding",
      dependsOn: ["plan"],
      executor: "skill:code",
      outputs: [],
      exit: {
        maxRetries: 1
      }
    },
    {
      id: "review",
      type: "review",
      dependsOn: ["code"],
      executor: "skill:review",
      outputs: [],
      exit: {
        maxRetries: 1
      }
    }
  ]
};

describe("workflow run state machine", () => {
  it("defines the MVP node statuses", () => {
    expect(nodeStatuses).toEqual([
      "idle",
      "queued",
      "running",
      "waiting",
      "blocked",
      "reviewing",
      "failed",
      "succeeded",
      "skipped"
    ]);
  });

  it("plans workflow nodes in dependency order", () => {
    expect(planWorkflowDag(workflow).map((node) => node.id)).toEqual([
      "plan",
      "code",
      "review"
    ]);
  });

  it("returns the next runnable queued node after dependencies succeed", () => {
    const next = getNextRunnableNode([
      {
        nodeId: "plan",
        dependsOn: [],
        status: "succeeded"
      },
      {
        nodeId: "code",
        dependsOn: ["plan"],
        status: "queued"
      },
      {
        nodeId: "review",
        dependsOn: ["code"],
        status: "queued"
      }
    ]);

    expect(next?.nodeId).toBe("code");
  });

  it("does not return blocked nodes when a dependency failed", () => {
    const next = getNextRunnableNode([
      {
        nodeId: "plan",
        dependsOn: [],
        status: "failed"
      },
      {
        nodeId: "code",
        dependsOn: ["plan"],
        status: "queued"
      }
    ]);

    expect(next).toBeNull();
  });
});
