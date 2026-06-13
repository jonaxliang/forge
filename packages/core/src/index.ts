export function createHealthPayload() {
  return {
    ok: true,
    service: "forge",
    status: "healthy"
  } as const;
}

export {
  parseWorkflowFile,
  workflowFileSchema,
  workflowNodeSchema,
  workflowScopes,
  type WorkflowFile,
  type WorkflowNode,
  type WorkflowScope
} from "./workflow-file";

export {
  getNextRunnableNode,
  nodeStatuses,
  planWorkflowDag,
  type NodeStatus,
  type RunnableNodeRun
} from "./workflow-run";
