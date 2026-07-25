export function createHealthPayload() {
  return {
    ok: true,
    service: "forge",
    status: "healthy"
  } as const;
}

export { normalizeArtifactOutput } from "./artifact-output.js";

export {
  exitReviewVerdicts,
  getExitReviewTransition
} from "./exit-review.js";

export type {
  ExitReviewCriterionResult,
  ExitReviewResult,
  ExitReviewTransition,
  ExitReviewVerdict,
  NodeRunAttempt
} from "./exit-review.js";

export {
  parseWorkflowFile,
  readLegacyWorkflowScope,
  workflowArtifactTypes,
  workflowFileSchema,
  workflowNodeSchema,
  workflowNodeOutputSchema,
  workflowReviewModes,
  workflowVersions
} from "./workflow-file.js";

export type {
  WorkflowAgent,
  WorkflowArtifact,
  WorkflowArtifactType,
  WorkflowFile,
  WorkflowHumanReview,
  WorkflowInput,
  WorkflowInstruction,
  WorkflowNode,
  WorkflowNodeOutput,
  WorkflowReviewMode,
  WorkflowSkill,
  WorkflowVersion
} from "./workflow-file.js";

export {
  getNextRunnableNode,
  nodeStatuses,
  planWorkflowDag,
  type NodeStatus,
  type RunnableNodeRun
} from "./workflow-run.js";
