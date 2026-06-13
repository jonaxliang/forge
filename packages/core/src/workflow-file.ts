import { parse } from "yaml";
import { z } from "zod";

export const workflowScopes = ["requirement", "task"] as const;

const stringListSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    return [value];
  }

  return value;
}, z.array(z.string().trim().min(1))).optional();

const workflowNodeInputSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1),
  after: stringListSchema,
  dependsOn: stringListSchema,
  executor: z.string().trim().min(1),
  outputs: z.array(z.string().trim().min(1)).optional().default([]),
  exit: z.object({
    maxRetries: z.number().int().min(0)
  })
});

const workflowFileInputSchema = z.object({
  name: z.string().trim().min(1),
  scope: z.enum(workflowScopes),
  nodes: z.array(workflowNodeInputSchema).min(1)
});

export const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  dependsOn: z.array(z.string()),
  executor: z.string(),
  outputs: z.array(z.string()),
  exit: z.object({
    maxRetries: z.number().int().min(0)
  })
});

export const workflowFileSchema = z.object({
  name: z.string(),
  scope: z.enum(workflowScopes),
  nodes: z.array(workflowNodeSchema).min(1)
});

export type WorkflowScope = (typeof workflowScopes)[number];
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowFile = z.infer<typeof workflowFileSchema>;

export function parseWorkflowFile(source: string): WorkflowFile {
  let parsed: unknown;

  try {
    parsed = parse(source);
  } catch (error) {
    throw new Error(`Invalid workflow YAML: ${getErrorMessage(error)}`);
  }

  const result = workflowFileInputSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid workflow file: ${result.error.issues[0]?.message ?? "unknown error"}`);
  }

  const workflow: WorkflowFile = {
    name: result.data.name,
    scope: result.data.scope,
    nodes: result.data.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      dependsOn: node.dependsOn ?? node.after ?? [],
      executor: node.executor,
      outputs: node.outputs,
      exit: node.exit
    }))
  };

  validateUniqueNodeIds(workflow.nodes);
  validateKnownDependencies(workflow.nodes);
  validateDag(workflow.nodes);

  return workflowFileSchema.parse(workflow);
}

function validateUniqueNodeIds(nodes: WorkflowNode[]) {
  const seen = new Set<string>();

  for (const node of nodes) {
    if (seen.has(node.id)) {
      throw new Error(`Duplicate workflow node id: ${node.id}`);
    }

    seen.add(node.id);
  }
}

function validateKnownDependencies(nodes: WorkflowNode[]) {
  const ids = new Set(nodes.map((node) => node.id));

  for (const node of nodes) {
    for (const dependency of node.dependsOn) {
      if (!ids.has(dependency)) {
        throw new Error(`Unknown dependency "${dependency}" for workflow node "${node.id}"`);
      }
    }
  }
}

function validateDag(nodes: WorkflowNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(nodeId: string, path: string[]) {
    if (visited.has(nodeId)) {
      return;
    }

    if (visiting.has(nodeId)) {
      throw new Error(`Workflow dependency cycle detected: ${[...path, nodeId].join(" -> ")}`);
    }

    const node = byId.get(nodeId);

    if (!node) {
      return;
    }

    visiting.add(nodeId);

    for (const dependency of node.dependsOn) {
      visit(dependency, [...path, nodeId]);
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const node of nodes) {
    visit(node.id, []);
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
