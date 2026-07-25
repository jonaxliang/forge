import {
  getExitReviewTransition,
  type ExitReviewResult,
  type NodeRunAttempt,
  type WorkflowFile,
  type WorkflowNode
} from "@forge/core";
import type {
  AgentBinding,
  BridgeRepository,
  ExecutionSettings,
  NodeRun,
  Task,
  TaskRepository,
  WorkflowFileMetadata,
  WorkflowRun,
  WorkflowRunRepository
} from "@forge/db";

export type ExecutorAssignment = {
  executorAgentBindingId: string | null;
  executorLabel: string;
  executorType: "model-api" | "agent-binding";
};

export type TaskWorkflowNodeExecutorInput = {
  node: WorkflowNode;
  nodeRun: NodeRun;
  nodeRuns: NodeRun[];
  settings: ExecutionSettings;
  task: Task;
  taskDependencyOutputs?: TaskDependencyOutput[];
  workflow: WorkflowFile;
  workflowFile: WorkflowFileMetadata;
  workflowRun: WorkflowRun;
};

export type TaskDependencyOutput = {
  outputs: Array<{
    nodeId: string;
    output: string;
    workflowRunId: string;
  }>;
  taskId: string;
  taskTitle: string;
};

export type TaskWorkflowNodeExecutor = (
  input: TaskWorkflowNodeExecutorInput
) => Promise<string>;

export type TaskWorkflowExitEvaluatorInput = TaskWorkflowNodeExecutorInput & {
  executorAssignment: ExecutorAssignment;
  output: string;
};

export type TaskWorkflowExitEvaluation = Pick<
  ExitReviewResult,
  "criteria" | "feedback" | "summary" | "verdict"
>;

export type TaskWorkflowExitEvaluator = (
  input: TaskWorkflowExitEvaluatorInput
) => Promise<TaskWorkflowExitEvaluation>;

type TaskWorkflowRunnerInput = {
  bridges: BridgeRepository;
  exitEvaluator: TaskWorkflowExitEvaluator;
  taskNodeExecutor: TaskWorkflowNodeExecutor;
  tasks: TaskRepository;
  workflowRuns: WorkflowRunRepository;
};

type AdvanceTaskWorkflowRunInput = {
  deferModelExecution?: boolean;
  executorAssignments: Record<string, ExecutorAssignment>;
  settings: ExecutionSettings;
  task: Task;
  workflow: WorkflowFile;
  workflowFile: WorkflowFileMetadata;
  workflowRun: WorkflowRun;
};

type RetryFailedNodeRunInput = AdvanceTaskWorkflowRunInput & {
  nodeRunId: string;
};

type ExecuteModelNodeAndAdvanceInput = TaskWorkflowNodeExecutorInput & {
  executorAssignments: Record<string, ExecutorAssignment>;
};

type CompleteNodeExecutionInput = ExecuteModelNodeAndAdvanceInput & {
  deferModelExecution?: boolean;
  output: string;
};

type CompleteHumanReviewInput = AdvanceTaskWorkflowRunInput & {
  decision: "approve" | "request_changes";
  feedback: string;
  nodeRunId: string;
};

export function serializeExecutorAssignments(
  executorAssignments: Map<string, ExecutorAssignment>
) {
  return Object.fromEntries(executorAssignments.entries());
}

export function readExecutorAssignments(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const assignments = (payload as { executorAssignments?: unknown })
    .executorAssignments;

  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) {
    return {};
  }

  return assignments as Record<string, ExecutorAssignment>;
}

export function createTaskWorkflowRunner({
  bridges,
  exitEvaluator,
  taskNodeExecutor,
  tasks,
  workflowRuns
}: TaskWorkflowRunnerInput) {
  async function failTaskWorkflowRun(input: {
    errorMessage?: string | null;
    nodeRun: NodeRun;
    taskId?: string;
    workflowRunId: string;
  }) {
    const currentNodeRuns = await workflowRuns.listNodeRuns(input.workflowRunId);
    const currentNodeRun =
      currentNodeRuns.find((nodeRun) => nodeRun.id === input.nodeRun.id) ??
      input.nodeRun;
    const errorMessage = input.errorMessage ?? currentNodeRun.errorMessage ?? null;
    const attempts = appendAttempt(currentNodeRun, {
      errorMessage,
      output: currentNodeRun.output,
      review: currentNodeRun.exitReview
    });

    await workflowRuns.updateNodeRunStatus({
      attempts,
      id: input.nodeRun.id,
      errorMessage,
      status: "failed"
    });
    await workflowRuns.updateWorkflowRunStatus({
      id: input.workflowRunId,
      status: "failed"
    });
    if (input.taskId) {
      await tasks.updateTaskStatus({
        id: input.taskId,
        status: "failed"
      });
    }
  }

  function getNextRunnableNodeRun(nodeRuns: NodeRun[]) {
    const statusByNodeId = new Map(
      nodeRuns.map((nodeRun) => [nodeRun.nodeId, nodeRun.status])
    );

    return (
      nodeRuns.find(
        (nodeRun) =>
          nodeRun.status === "queued" &&
          nodeRun.dependsOn.every(
            (dependency) => statusByNodeId.get(dependency) === "succeeded"
          )
      ) ?? null
    );
  }

  async function executeModelNodeAndAdvance(
    input: ExecuteModelNodeAndAdvanceInput
  ) {
    try {
      const output = await taskNodeExecutor(input);
      await completeNodeExecution({
        ...input,
        output
      });
    } catch (error) {
      await failTaskWorkflowRun({
        errorMessage: getErrorMessage(error),
        nodeRun: input.nodeRun,
        taskId: input.task.id,
        workflowRunId: input.workflowRun.id
      });
    }
  }

  async function completeNodeExecution(input: CompleteNodeExecutionInput) {
    const reviewingNodeRun = await workflowRuns.updateNodeRunStatus({
      errorMessage: null,
      exitReview: null,
      id: input.nodeRun.id,
      output: input.output,
      status: "reviewing"
    });
    const review = await createExitReview(input);

    return applyExitReview({
      ...input,
      nodeRun: reviewingNodeRun,
      review
    });
  }

  async function completeHumanReview(input: CompleteHumanReviewInput) {
    const currentNodeRuns = await workflowRuns.listNodeRuns(input.workflowRun.id);
    const nodeRun = currentNodeRuns.find(
      (candidate) => candidate.id === input.nodeRunId
    );

    if (!nodeRun) {
      throw new Error(`Node Run not found: ${input.nodeRunId}`);
    }

    if (nodeRun.status !== "reviewing" || nodeRun.exitReview?.verdict !== "pending") {
      throw new Error("Workflow Node is not waiting for Human Review");
    }

    const node = input.workflow.nodes.find(
      (candidate) => candidate.id === nodeRun.nodeId
    );

    if (!node) {
      throw new Error(`Workflow Node not found: ${nodeRun.nodeId}`);
    }

    const feedback = input.feedback.trim();
    if (input.decision === "request_changes" && !feedback) {
      throw new Error("Feedback is required when requesting changes");
    }

    return applyExitReview({
      ...input,
      node,
      nodeRun,
      nodeRuns: currentNodeRuns,
      output: nodeRun.output ?? "",
      review: {
        criteria: node.exit.criteria.map((criterion) => ({
          criterion,
          evidence: feedback,
          passed: input.decision === "approve"
        })),
        feedback,
        mode: node.exit.review,
        reviewedAt: new Date().toISOString(),
        reviewer: "human",
        summary:
          feedback ||
          (input.decision === "approve"
            ? "Human Review approved the output."
            : "Human Review requested changes."),
        verdict: input.decision === "approve" ? "passed" : "failed"
      }
    });
  }

  async function createExitReview(
    input: CompleteNodeExecutionInput
  ): Promise<ExitReviewResult> {
    const mode = input.node.exit.review;

    if (mode === "none" || input.node.exit.criteria.length === 0) {
      return {
        criteria: input.node.exit.criteria.map((criterion) => ({
          criterion,
          evidence: "",
          passed: true
        })),
        feedback: "",
        mode,
        reviewedAt: new Date().toISOString(),
        reviewer: "none",
        summary:
          mode === "none"
            ? "Exit Review is disabled for this Workflow Node."
            : "No Exit Criteria were defined.",
        verdict: "skipped"
      };
    }

    if (mode === "human") {
      return createPendingHumanReview(input.node);
    }

    try {
      const executorAssignment = input.executorAssignments[input.node.id];

      if (!executorAssignment) {
        throw new Error(
          `Missing executor assignment for Workflow Node ${input.node.id}`
        );
      }

      const evaluation = await exitEvaluator({
        ...input,
        executorAssignment
      });

      return {
        ...evaluation,
        mode,
        reviewedAt: new Date().toISOString(),
        reviewer: "model"
      };
    } catch (error) {
      return createPendingHumanReview(
        input.node,
        `Model review was unavailable: ${getErrorMessage(error)}`
      );
    }
  }

  async function applyExitReview(
    input: CompleteNodeExecutionInput & {
      review: ExitReviewResult;
    }
  ) {
    const transition = getExitReviewTransition({
      maxRetries: input.node.exit.maxRetries,
      retryCount: input.nodeRun.retryCount,
      verdict: input.review.verdict
    });

    if (transition === "waiting") {
      const reviewingNodeRun = await workflowRuns.updateNodeRunStatus({
        exitReview: input.review,
        id: input.nodeRun.id,
        status: "reviewing"
      });

      return replaceNodeRun(input.nodeRuns, reviewingNodeRun);
    }

    const attempts = appendAttempt(input.nodeRun, {
      errorMessage: null,
      output: input.output,
      review: input.review
    });

    if (transition === "passed") {
      const succeededNodeRun = await workflowRuns.updateNodeRunStatus({
        attempts,
        exitReview: input.review,
        id: input.nodeRun.id,
        status: "succeeded"
      });

      return advanceTaskWorkflowRun({
        deferModelExecution: input.deferModelExecution,
        executorAssignments: input.executorAssignments,
        settings: input.settings,
        task: input.task,
        workflow: input.workflow,
        workflowFile: input.workflowFile,
        workflowRun: input.workflowRun
      }).then((nodeRuns) => replaceNodeRun(nodeRuns, succeededNodeRun));
    }

    if (transition === "retry") {
      await workflowRuns.updateNodeRunStatus({
        attempt: input.nodeRun.attempt + 1,
        attempts,
        errorMessage: null,
        exitReview: null,
        id: input.nodeRun.id,
        output: null,
        retryCount: input.nodeRun.retryCount + 1,
        status: "queued"
      });

      return advanceTaskWorkflowRun({
        deferModelExecution: input.deferModelExecution,
        executorAssignments: input.executorAssignments,
        settings: input.settings,
        task: input.task,
        workflow: input.workflow,
        workflowFile: input.workflowFile,
        workflowRun: input.workflowRun
      });
    }

    const blockedNodeRun = await workflowRuns.updateNodeRunStatus({
      attempts,
      errorMessage:
        input.review.feedback ||
        input.review.summary ||
        "Exit Criteria were not met.",
      exitReview: input.review,
      id: input.nodeRun.id,
      status: "blocked"
    });
    await workflowRuns.updateWorkflowRunStatus({
      id: input.workflowRun.id,
      status: "failed"
    });
    await tasks.updateTaskStatus({
      id: input.task.id,
      status: "failed"
    });

    return replaceNodeRun(input.nodeRuns, blockedNodeRun);
  }

  async function advanceTaskWorkflowRun(input: AdvanceTaskWorkflowRunInput) {
    const currentNodeRuns = await workflowRuns.listNodeRuns(input.workflowRun.id);

    if (
      currentNodeRuns.length > 0 &&
      currentNodeRuns.every((nodeRun) => nodeRun.status === "succeeded")
    ) {
      await workflowRuns.updateWorkflowRunStatus({
        id: input.workflowRun.id,
        status: "succeeded"
      });
      await tasks.updateTaskStatus({
        id: input.task.id,
        status: "pending_acceptance"
      });
      return currentNodeRuns;
    }

    if (currentNodeRuns.some((nodeRun) => nodeRun.status === "failed")) {
      await workflowRuns.updateWorkflowRunStatus({
        id: input.workflowRun.id,
        status: "failed"
      });
      await tasks.updateTaskStatus({
        id: input.task.id,
        status: "failed"
      });
      return currentNodeRuns;
    }

    if (
      currentNodeRuns.some(
        (nodeRun) =>
          nodeRun.status === "running" || nodeRun.status === "reviewing"
      )
    ) {
      return currentNodeRuns;
    }

    const nextNodeRun = getNextRunnableNodeRun(currentNodeRuns);

    if (!nextNodeRun) {
      return currentNodeRuns;
    }

    const nextNode = input.workflow.nodes.find(
      (node) => node.id === nextNodeRun.nodeId
    );

    if (!nextNode) {
      throw new Error(`Workflow Node not found: ${nextNodeRun.nodeId}`);
    }

    const executor = input.executorAssignments[nextNode.id];

    if (!executor) {
      throw new Error(`Missing executor assignment for Workflow Node ${nextNode.id}`);
    }

    if (executor.executorType === "agent-binding") {
      const agentBindings = await bridges.listAgentBindings();
      const taskDependencyOutputs = await collectTaskDependencyOutputs(input.task);
      await bridges.createBridgeJob({
        agentName: resolveAgentName(executor, agentBindings),
        nodeRunId: nextNodeRun.id,
        payload: {
          executor,
          executorAssignments: input.executorAssignments,
          nodeRun: nextNodeRun,
          nodeRuns: currentNodeRuns,
          task: input.task,
          taskDependencyOutputs,
          workflowFile: input.workflowFile,
          workflowRun: input.workflowRun
        },
        workflowRunId: input.workflowRun.id
      });
      return currentNodeRuns;
    }

    const runningNodeRun = await workflowRuns.updateNodeRunStatus({
      id: nextNodeRun.id,
      status: "running"
    });
    const nextNodeRuns = currentNodeRuns.map((nodeRun) =>
      nodeRun.id === runningNodeRun.id ? runningNodeRun : nodeRun
    );
    const taskDependencyOutputs = await collectTaskDependencyOutputs(input.task);
    const runInput = {
      executorAssignments: input.executorAssignments,
      node: nextNode,
      nodeRun: runningNodeRun,
      nodeRuns: nextNodeRuns,
      settings: input.settings,
      task: input.task,
      taskDependencyOutputs,
      workflow: input.workflow,
      workflowFile: input.workflowFile,
      workflowRun: input.workflowRun
    };

    if (input.deferModelExecution) {
      setTimeout(() => {
        void executeModelNodeAndAdvance(runInput);
      }, 0);
      return nextNodeRuns;
    }

    await executeModelNodeAndAdvance(runInput);
    return workflowRuns.listNodeRuns(input.workflowRun.id);
  }

  async function retryFailedNodeRun(input: RetryFailedNodeRunInput) {
    const currentNodeRuns = await workflowRuns.listNodeRuns(input.workflowRun.id);
    const targetNodeRun = currentNodeRuns.find(
      (nodeRun) => nodeRun.id === input.nodeRunId
    );

    if (!targetNodeRun) {
      throw new Error(`Node Run not found: ${input.nodeRunId}`);
    }

    if (!["blocked", "failed"].includes(targetNodeRun.status)) {
      throw new Error("Only failed or blocked Workflow Nodes can be retried");
    }

    const statusByNodeId = new Map(
      currentNodeRuns.map((nodeRun) => [nodeRun.nodeId, nodeRun.status])
    );
    const unfinishedDependency = targetNodeRun.dependsOn.find(
      (dependency) => statusByNodeId.get(dependency) !== "succeeded"
    );

    if (unfinishedDependency) {
      throw new Error(
        `Workflow Node dependency is not complete: ${unfinishedDependency}`
      );
    }

    const retryNodeIds = collectNodeRunDescendantIds(
      currentNodeRuns,
      targetNodeRun.nodeId
    );
    retryNodeIds.add(targetNodeRun.nodeId);

    for (const nodeRun of currentNodeRuns) {
      if (retryNodeIds.has(nodeRun.nodeId)) {
        await workflowRuns.updateNodeRunStatus({
          attempt:
            nodeRun.id === targetNodeRun.id ||
            ["blocked", "failed", "succeeded"].includes(nodeRun.status)
              ? nodeRun.attempt + 1
              : nodeRun.attempt,
          errorMessage: null,
          exitReview: null,
          id: nodeRun.id,
          output: null,
          status: "queued"
        });
      }
    }

    const workflowRun = await workflowRuns.updateWorkflowRunStatus({
      id: input.workflowRun.id,
      status: "running"
    });
    await tasks.updateTaskStatus({
      id: input.task.id,
      status: "running"
    });

    return advanceTaskWorkflowRun({
      deferModelExecution: input.deferModelExecution,
      executorAssignments: input.executorAssignments,
      settings: input.settings,
      task: input.task,
      workflow: input.workflow,
      workflowFile: input.workflowFile,
      workflowRun
    });
  }

  async function listRunnableNodeRunIdsForBridgeJobs() {
    const runningWorkflowRuns = (await workflowRuns.listWorkflowRuns()).filter(
      (workflowRun) => workflowRun.status === "running"
    );
    const runnableNodeRunIds: string[] = [];

    for (const workflowRun of runningWorkflowRuns) {
      const nextNodeRun = getNextRunnableNodeRun(
        await workflowRuns.listNodeRuns(workflowRun.id)
      );

      if (nextNodeRun) {
        runnableNodeRunIds.push(nextNodeRun.id);
      }
    }

    return runnableNodeRunIds;
  }

  async function collectTaskDependencyOutputs(
    task: Task
  ): Promise<TaskDependencyOutput[]> {
    const dependencyOutputs: TaskDependencyOutput[] = [];

    for (const dependencyTaskId of task.dependsOn) {
      const dependencyTask = await tasks.getTask(dependencyTaskId);

      if (!dependencyTask) {
        continue;
      }

      const succeededRuns = (await workflowRuns.listWorkflowRuns(dependencyTaskId))
        .filter((workflowRun) => workflowRun.status === "succeeded")
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      const latestSucceededRun = succeededRuns.at(-1);

      if (!latestSucceededRun) {
        continue;
      }

      const outputs = (await workflowRuns.listNodeRuns(latestSucceededRun.id))
        .filter(
          (nodeRun) =>
            nodeRun.status === "succeeded" &&
            typeof nodeRun.output === "string" &&
            nodeRun.output.trim().length > 0
        )
        .map((nodeRun) => ({
          nodeId: nodeRun.nodeId,
          output: nodeRun.output!,
          workflowRunId: latestSucceededRun.id
        }));

      if (outputs.length > 0) {
        dependencyOutputs.push({
          outputs,
          taskId: dependencyTask.id,
          taskTitle: dependencyTask.title
        });
      }
    }

    return dependencyOutputs;
  }

  return {
    advanceTaskWorkflowRun,
    completeHumanReview,
    completeNodeExecution,
    executeModelNodeAndAdvance,
    failTaskWorkflowRun,
    listRunnableNodeRunIdsForBridgeJobs,
    retryFailedNodeRun
  };
}

function collectNodeRunDescendantIds(nodeRuns: NodeRun[], nodeId: string) {
  const descendants = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;

    for (const candidate of nodeRuns) {
      if (
        !descendants.has(candidate.nodeId) &&
        candidate.dependsOn.some(
          (dependency) => dependency === nodeId || descendants.has(dependency)
        )
      ) {
        descendants.add(candidate.nodeId);
        changed = true;
      }
    }
  }

  return descendants;
}

function appendAttempt(
  nodeRun: NodeRun,
  attempt: Omit<NodeRunAttempt, "attempt" | "completedAt">
) {
  if (nodeRun.attempts.some((candidate) => candidate.attempt === nodeRun.attempt)) {
    return nodeRun.attempts;
  }

  return [
    ...nodeRun.attempts,
    {
      ...attempt,
      attempt: nodeRun.attempt,
      completedAt: new Date().toISOString()
    }
  ];
}

function createPendingHumanReview(
  node: WorkflowNode,
  fallbackReason = ""
): ExitReviewResult {
  const reason =
    fallbackReason.trim() ||
    node.humanReview?.reason.trim() ||
    "Review the output against the Exit Criteria before continuing.";

  return {
    criteria: node.exit.criteria.map((criterion) => ({
      criterion,
      evidence: "",
      passed: false
    })),
    feedback: reason,
    mode: node.exit.review,
    reviewedAt: null,
    reviewer: "human",
    summary: reason,
    verdict: "pending"
  };
}

function replaceNodeRun(nodeRuns: NodeRun[], updatedNodeRun: NodeRun) {
  return nodeRuns.map((nodeRun) =>
    nodeRun.id === updatedNodeRun.id ? updatedNodeRun : nodeRun
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function resolveAgentName(
  executor: ExecutorAssignment,
  agentBindings: AgentBinding[]
) {
  if (executor.executorType === "agent-binding") {
    return executor.executorLabel;
  }

  const onlineAgent = agentBindings.find((agent) => agent.status === "online");

  if (!onlineAgent) {
    throw new Error("No online Agent Binding is available for this Workflow Node");
  }

  return onlineAgent.name;
}
