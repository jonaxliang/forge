export function createHealthPayload() {
  return {
    ok: true,
    service: "forge",
    status: "healthy"
  } as const;
}

export {
  parseWorkflowFile,
  workflowArtifactTypes,
  workflowFileSchema,
  workflowNodeSchema,
  workflowNodeOutputSchema,
  workflowReviewModes,
  workflowScopes,
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
  WorkflowScope,
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
