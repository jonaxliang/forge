import type { WorkflowFile, WorkflowNode } from "./workflow-file";

export const nodeStatuses = [
  "idle",
  "queued",
  "running",
  "waiting",
  "blocked",
  "reviewing",
  "failed",
  "succeeded",
  "skipped"
] as const;

export type NodeStatus = (typeof nodeStatuses)[number];

export type RunnableNodeRun = {
  nodeId: string;
  dependsOn: string[];
  status: NodeStatus;
};

export function planWorkflowDag(workflow: WorkflowFile): WorkflowNode[] {
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  const planned: WorkflowNode[] = [];

  function visit(node: WorkflowNode) {
    if (visited.has(node.id)) {
      return;
    }

    for (const dependency of node.dependsOn) {
      const dependencyNode = nodesById.get(dependency);

      if (dependencyNode) {
        visit(dependencyNode);
      }
    }

    visited.add(node.id);
    planned.push(node);
  }

  for (const node of workflow.nodes) {
    visit(node);
  }

  return planned;
}

export function getNextRunnableNode(
  nodeRuns: RunnableNodeRun[]
): RunnableNodeRun | null {
  const statusByNodeId = new Map(
    nodeRuns.map((nodeRun) => [nodeRun.nodeId, nodeRun.status])
  );

  return (
    nodeRuns.find((nodeRun) => {
      if (nodeRun.status !== "queued") {
        return false;
      }

      return nodeRun.dependsOn.every(
        (dependency) => statusByNodeId.get(dependency) === "succeeded"
      );
    }) ?? null
  );
}
