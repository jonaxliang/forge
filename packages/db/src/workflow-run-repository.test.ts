import { describe, expect, it } from "vitest";
import { createInMemoryWorkflowRunRepository } from "./index.js";

describe("Workflow Run repository review history", () => {
  it("persists correction feedback and Node Run attempts", async () => {
    const repository = createInMemoryWorkflowRunRepository();
    const workflowRun = await repository.createWorkflowRun({
      correctionFeedback: "Preserve the structure and add evidence.",
      taskId: "task_1",
      workflowFileId: "workflow_1"
    });
    const nodeRun = await repository.createNodeRun({
      dependsOn: [],
      nodeId: "draft",
      sortOrder: 0,
      status: "queued",
      workflowRunId: workflowRun.id
    });
    const review = {
      criteria: [
        {
          criterion: "Output includes evidence.",
          evidence: "No source references were provided.",
          passed: false
        }
      ],
      feedback: "Add source references.",
      mode: "model" as const,
      reviewedAt: "2026-07-25T00:01:00.000Z",
      reviewer: "model" as const,
      summary: "Evidence is missing.",
      verdict: "failed" as const
    };

    await repository.updateNodeRunStatus({
      attempt: 2,
      attempts: [
        {
          attempt: 1,
          completedAt: "2026-07-25T00:01:00.000Z",
          errorMessage: null,
          output: "First draft",
          review
        }
      ],
      exitReview: null,
      id: nodeRun.id,
      output: null,
      retryCount: 1,
      status: "queued"
    });

    await expect(repository.listWorkflowRuns("task_1")).resolves.toMatchObject([
      {
        correctionFeedback: "Preserve the structure and add evidence."
      }
    ]);
    await expect(repository.listNodeRuns(workflowRun.id)).resolves.toMatchObject([
      {
        attempt: 2,
        attempts: [
          {
            attempt: 1,
            output: "First draft",
            review: {
              feedback: "Add source references.",
              verdict: "failed"
            }
          }
        ],
        exitReview: null,
        retryCount: 1,
        status: "queued"
      }
    ]);
  });
});
