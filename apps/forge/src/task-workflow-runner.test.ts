import { describe, expect, it } from "vitest";
import {
  readExecutorAssignments,
  serializeExecutorAssignments,
  type ExecutorAssignment
} from "./task-workflow-runner.js";

describe("Task Workflow runner assignment helpers", () => {
  it("round-trips executor assignments through bridge job payloads", () => {
    const implementExecutor: ExecutorAssignment = {
      executorAgentBindingId: "agent_1",
      executorLabel: "Local Codex",
      executorType: "agent-binding"
    };
    const reviewExecutor: ExecutorAssignment = {
      executorAgentBindingId: null,
      executorLabel: "Model API · test-model",
      executorType: "model-api"
    };

    const payload = {
      executorAssignments: serializeExecutorAssignments(
        new Map([
          ["implement", implementExecutor],
          ["review", reviewExecutor]
        ])
      )
    };

    expect(readExecutorAssignments(payload)).toEqual({
      implement: implementExecutor,
      review: reviewExecutor
    });
  });

  it("treats malformed bridge job payloads as no assignments", () => {
    expect(readExecutorAssignments(null)).toEqual({});
    expect(readExecutorAssignments({ executorAssignments: [] })).toEqual({});
    expect(readExecutorAssignments({})).toEqual({});
  });
});
