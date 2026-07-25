import { describe, expect, it } from "vitest";
import { parseWorkflowFile } from "@forge/core";
import {
  createInMemoryBridgeRepository,
  createInMemoryTaskRepository,
  createInMemoryWorkflowRunRepository,
  type ExecutionSettings,
  type WorkflowFileMetadata
} from "@forge/db";
import {
  createTaskWorkflowRunner,
  readExecutorAssignments,
  serializeExecutorAssignments,
  type ExecutorAssignment
} from "./task-workflow-runner.js";

const settings: ExecutionSettings = {
  agentProxyUrl: "",
  createdAt: "2026-07-25T00:00:00.000Z",
  defaultExecutorAgentBindingId: null,
  defaultExecutorType: "model-api",
  id: "default",
  modelApiKey: "test",
  modelBaseUrl: "https://example.com/v1",
  modelName: "test-model",
  modelProvider: "openai-compatible",
  updatedAt: "2026-07-25T00:00:00.000Z"
};

function createWorkflow(review: "model" | "human" = "model", maxRetries = 1) {
  return parseWorkflowFile(`name: Loop test
version: "1.1"
nodes:
  - id: draft
    type: draft
    outputs: []
    exit:
      review: ${review}
      maxRetries: ${maxRetries}
      criteria:
        - Output is ready.
      retryInstruction: Revise the output.
`);
}

async function createRunnerFixture({
  exitEvaluator,
  maxRetries = 1,
  review = "model"
}: {
  exitEvaluator: Parameters<typeof createTaskWorkflowRunner>[0]["exitEvaluator"];
  maxRetries?: number;
  review?: "model" | "human";
}) {
  const tasks = createInMemoryTaskRepository();
  const workflowRuns = createInMemoryWorkflowRunRepository();
  const workflow = createWorkflow(review, maxRetries);
  const [task] = await tasks.createTasksFromDecompositionResult({
    items: [
      {
        body: "Produce the output.",
        executorAgentBindingId: null,
        executorLabel: "Model API",
        executorType: "model-api",
        id: "draft",
        sortOrder: 0,
        title: "Draft"
      }
    ],
    projectId: "proj_test",
    requirementId: "req_test"
  });
  const workflowFile: WorkflowFileMetadata = {
    createdAt: "2026-07-25T00:00:00.000Z",
    definition: JSON.stringify(workflow),
    id: "wf_loop",
    name: "Loop test",
    nodeCount: 1,
    templateType: "custom"
  };
  const workflowRun = await workflowRuns.createWorkflowRun({
    executorAssignments: {
      draft: {
        executorAgentBindingId: null,
        executorLabel: "Model API",
        executorType: "model-api"
      }
    },
    taskId: task!.id,
    workflowFileId: workflowFile.id
  });
  await workflowRuns.createNodeRun({
    dependsOn: [],
    nodeId: "draft",
    sortOrder: 0,
    status: "queued",
    workflowRunId: workflowRun.id
  });
  const runner = createTaskWorkflowRunner({
    bridges: createInMemoryBridgeRepository(),
    exitEvaluator,
    taskNodeExecutor: async ({ nodeRun }) => `output attempt ${nodeRun.attempt}`,
    tasks,
    workflowRuns
  });

  return {
    input: {
      executorAssignments: {
        draft: {
          executorAgentBindingId: null,
          executorLabel: "Model API",
          executorType: "model-api" as const
        }
      },
      settings,
      task: task!,
      workflow,
      workflowFile,
      workflowRun
    },
    runner,
    tasks,
    workflowRuns
  };
}

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

describe("Task Workflow Exit Review loop", () => {
  it("retries with review feedback and preserves both attempts", async () => {
    let reviewCount = 0;
    const fixture = await createRunnerFixture({
      exitEvaluator: async ({ node, output }) => {
        reviewCount += 1;
        const passed = reviewCount === 2;

        return {
          criteria: node.exit.criteria.map((criterion) => ({
            criterion,
            evidence: output,
            passed
          })),
          feedback: passed ? "" : "Add the missing evidence.",
          summary: passed ? "Ready." : "Evidence is missing.",
          verdict: passed ? "passed" : "failed"
        };
      }
    });

    await fixture.runner.advanceTaskWorkflowRun(fixture.input);

    const [nodeRun] = await fixture.workflowRuns.listNodeRuns(
      fixture.input.workflowRun.id
    );
    expect(nodeRun).toMatchObject({
      attempt: 2,
      retryCount: 1,
      status: "succeeded"
    });
    expect(nodeRun!.attempts).toHaveLength(2);
    expect(nodeRun!.attempts[0]).toMatchObject({
      attempt: 1,
      output: "output attempt 1",
      review: {
        feedback: "Add the missing evidence.",
        verdict: "failed"
      }
    });
    expect(nodeRun!.attempts[1]).toMatchObject({
      attempt: 2,
      output: "output attempt 2",
      review: { verdict: "passed" }
    });
    await expect(fixture.tasks.getTask(fixture.input.task.id)).resolves.toMatchObject({
      status: "pending_acceptance"
    });
  });

  it("blocks the node when Exit Review exhausts the retry budget", async () => {
    const fixture = await createRunnerFixture({
      exitEvaluator: async ({ node }) => ({
        criteria: node.exit.criteria.map((criterion) => ({
          criterion,
          evidence: "Missing evidence.",
          passed: false
        })),
        feedback: "Missing evidence.",
        summary: "Not ready.",
        verdict: "failed"
      }),
      maxRetries: 0
    });

    await fixture.runner.advanceTaskWorkflowRun(fixture.input);

    const [nodeRun] = await fixture.workflowRuns.listNodeRuns(
      fixture.input.workflowRun.id
    );
    expect(nodeRun).toMatchObject({
      attempt: 1,
      errorMessage: "Missing evidence.",
      retryCount: 0,
      status: "blocked"
    });
    expect(nodeRun!.attempts).toHaveLength(1);
    await expect(fixture.tasks.getTask(fixture.input.task.id)).resolves.toMatchObject({
      status: "failed"
    });
  });

  it("waits for Human Review and uses change feedback in the next attempt", async () => {
    const fixture = await createRunnerFixture({
      exitEvaluator: async () => {
        throw new Error("Human Review should not call the model evaluator");
      },
      review: "human"
    });

    await fixture.runner.advanceTaskWorkflowRun(fixture.input);
    let [nodeRun] = await fixture.workflowRuns.listNodeRuns(
      fixture.input.workflowRun.id
    );
    expect(nodeRun).toMatchObject({
      attempt: 1,
      exitReview: { reviewer: "human", verdict: "pending" },
      status: "reviewing"
    });

    await fixture.runner.completeHumanReview({
      ...fixture.input,
      decision: "request_changes",
      feedback: "Make the conclusion explicit.",
      nodeRunId: nodeRun!.id
    });
    [nodeRun] = await fixture.workflowRuns.listNodeRuns(
      fixture.input.workflowRun.id
    );
    expect(nodeRun).toMatchObject({
      attempt: 2,
      exitReview: { reviewer: "human", verdict: "pending" },
      retryCount: 1,
      status: "reviewing"
    });
    expect(nodeRun!.attempts[0]?.review?.feedback).toBe(
      "Make the conclusion explicit."
    );

    await fixture.runner.completeHumanReview({
      ...fixture.input,
      decision: "approve",
      feedback: "",
      nodeRunId: nodeRun!.id
    });
    [nodeRun] = await fixture.workflowRuns.listNodeRuns(
      fixture.input.workflowRun.id
    );
    expect(nodeRun).toMatchObject({
      attempt: 2,
      status: "succeeded"
    });
  });
});
