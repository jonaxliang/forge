import { parse } from "yaml";
import { z } from "zod";

export const workflowScopes = ["requirement", "task"] as const;
export const workflowVersions = ["1", "1.1"] as const;
export const workflowReviewModes = ["model", "human", "none"] as const;
export const workflowArtifactTypes = [
  "markdown",
  "patch",
  "json",
  "report",
  "outline",
  "draft"
] as const;

const stringListSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    return [value];
  }

  return value;
}, z.array(z.string().trim().min(1))).optional();

const workflowInputSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1),
  required: z.boolean().optional().default(false)
});

const workflowSkillSchema = z.object({
  id: z.string().trim().min(1),
  ref: z.string().trim().min(1)
});

const workflowAgentSchema = z.object({
  id: z.string().trim().min(1),
  role: z.string().trim().min(1)
});

const workflowArtifactSchema = z.object({
  id: z.string().trim().min(1),
  type: z.enum(workflowArtifactTypes),
  path: z.string().trim().min(1)
});

const workflowInstructionSchema = z
  .object({
    ref: z.string().trim().min(1).optional(),
    text: z.string().trim().min(1).optional()
  })
  .refine((instruction) => instruction.ref || instruction.text, {
    message: "Workflow instruction must include ref or text"
  });

const workflowNodeOutputInputSchema = z.union([
  z.string().trim(),
  z.object({
    artifact: z.string().trim()
  }),
  z.object({
    kind: z.literal("file"),
    ref: z.string().trim().min(1)
  })
]);

export type WorkflowNodeOutput =
  | {
      artifact: string;
    }
  | {
      kind: "file";
      ref: string;
    };

export const workflowNodeOutputSchema =
  workflowNodeOutputInputSchema.transform(normalizeNodeOutput);

const workflowHumanReviewSchema = z.object({
  required: z.boolean().optional().default(false),
  reason: z.string().trim().optional().default("")
});

const workflowNodeExitSchema = z.object({
  maxRetries: z.number().int().min(0),
  criteria: z.array(z.string().trim().min(1)).optional().default([]),
  review: z.enum(workflowReviewModes).optional().default("model"),
  retryInstruction: z.string().trim().optional().default("")
});

export const workflowNodeSchema = z
  .object({
    id: z.string().trim().min(1),
    type: z.string().trim().min(1),
    description: z.string().trim().optional(),
    after: stringListSchema,
    dependsOn: stringListSchema,
    executor: z.string().trim().min(1),
    uses: stringListSchema.default([]),
    inputs: stringListSchema.default([]),
    instruction: workflowInstructionSchema.optional(),
    outputs: z.array(workflowNodeOutputSchema).optional().default([]),
    exit: workflowNodeExitSchema,
    humanReview: workflowHumanReviewSchema.optional()
  })
  .transform((node) => ({
    dependsOn: mergeDependencies(node.dependsOn, node.after),
    executor: node.executor,
    exit: node.exit,
    id: node.id,
    inputs: node.inputs,
    outputs: node.outputs,
    type: node.type,
    uses: node.uses,
    ...(node.description ? { description: node.description } : {}),
    ...(node.humanReview ? { humanReview: node.humanReview } : {}),
    ...(node.instruction ? { instruction: node.instruction } : {})
  }));

export const workflowFileSchema = z
  .object({
    name: z.string(),
    scope: z.enum(workflowScopes),
    version: z.enum(workflowVersions).optional().default("1"),
    inputs: z.array(workflowInputSchema).optional().default([]),
    skills: z.array(workflowSkillSchema).optional().default([]),
    agents: z.array(workflowAgentSchema).optional().default([]),
    artifacts: z.array(workflowArtifactSchema).optional().default([]),
    nodes: z.array(workflowNodeSchema).min(1)
  })
  .superRefine((workflow, context) => {
    validateWorkflowFile(workflow, (message) => {
      context.addIssue({
        code: "custom",
        message
      });
    });
  });

export type WorkflowScope = (typeof workflowScopes)[number];
export type WorkflowVersion = (typeof workflowVersions)[number];
export type WorkflowReviewMode = (typeof workflowReviewModes)[number];
export type WorkflowArtifactType = (typeof workflowArtifactTypes)[number];
export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type WorkflowSkill = z.infer<typeof workflowSkillSchema>;
export type WorkflowAgent = z.infer<typeof workflowAgentSchema>;
export type WorkflowArtifact = z.infer<typeof workflowArtifactSchema>;
export type WorkflowInstruction = z.infer<typeof workflowInstructionSchema>;
export type WorkflowHumanReview = z.infer<typeof workflowHumanReviewSchema>;
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowFile = z.infer<typeof workflowFileSchema>;

export function parseWorkflowFile(source: string): WorkflowFile {
  let parsed: unknown;

  try {
    parsed = parse(source);
  } catch (error) {
    throw new Error(`Invalid workflow YAML: ${getErrorMessage(error)}`);
  }

  const result = workflowFileSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid workflow file: ${result.error.issues[0]?.message ?? "unknown error"}`);
  }

  return result.data;
}

function mergeDependencies(dependsOn: string[] | undefined, after: string[] | undefined) {
  return [...new Set([...(dependsOn ?? []), ...(after ?? [])])];
}

function normalizeNodeOutput(
  output: z.infer<typeof workflowNodeOutputInputSchema>
): WorkflowNodeOutput {
  if (typeof output === "string") {
    if (output.startsWith("artifact:")) {
      return { artifact: output.slice("artifact:".length) };
    }

    return { kind: "file", ref: output };
  }

  if ("artifact" in output) {
    return { artifact: output.artifact };
  }

  return { kind: "file", ref: output.ref };
}

function validateWorkflowFile(workflow: WorkflowFile, addIssue: (message: string) => void) {
  validateWithIssue(() => validateUniqueResourceIds("workflow input", workflow.inputs), addIssue);
  validateWithIssue(() => validateUniqueResourceIds("workflow skill", workflow.skills), addIssue);
  validateWithIssue(() => validateUniqueResourceIds("workflow agent", workflow.agents), addIssue);
  validateWithIssue(
    () => validateUniqueResourceIds("workflow artifact", workflow.artifacts),
    addIssue
  );
  validateWithIssue(() => validateUniqueNodeIds(workflow.nodes), addIssue);
  validateWithIssue(() => validateKnownDependencies(workflow.nodes), addIssue);
  validateWithIssue(() => validateDag(workflow.nodes), addIssue);
  validateWithIssue(() => validateNodeSkillReferences(workflow.nodes, workflow.skills), addIssue);
  validateWithIssue(
    () => validateNodeArtifactReferences(workflow.nodes, workflow.artifacts),
    addIssue
  );
  validateWithIssue(() => validateHumanReviewConsistency(workflow.nodes), addIssue);
}

function validateWithIssue(validate: () => void, addIssue: (message: string) => void) {
  try {
    validate();
  } catch (error) {
    addIssue(getErrorMessage(error));
  }
}

function validateUniqueResourceIds(
  label: string,
  resources: Array<{ id: string }>
) {
  const seen = new Set<string>();

  for (const resource of resources) {
    if (seen.has(resource.id)) {
      throw new Error(`Duplicate ${label} id: ${resource.id}`);
    }

    seen.add(resource.id);
  }
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

function validateNodeSkillReferences(
  nodes: WorkflowNode[],
  skills: WorkflowSkill[]
) {
  const skillIds = new Set(skills.map((skill) => skill.id));

  for (const node of nodes) {
    for (const skillReference of node.uses ?? []) {
      if (!skillReference.startsWith("skill:")) {
        throw new Error(
          `Unknown skill reference "${skillReference}" for workflow node "${node.id}"`
        );
      }

      const skillId = skillReference.slice("skill:".length);

      if (!skillIds.has(skillId)) {
        throw new Error(
          `Unknown skill reference "${skillReference}" for workflow node "${node.id}"`
        );
      }
    }
  }
}

function validateNodeArtifactReferences(
  nodes: WorkflowNode[],
  artifacts: WorkflowArtifact[]
) {
  const artifactIds = new Set(artifacts.map((artifact) => artifact.id));

  for (const node of nodes) {
    for (const input of node.inputs ?? []) {
      if (input.startsWith("artifact:")) {
        const artifactId = input.slice("artifact:".length);

        if (!artifactIds.has(artifactId)) {
          throw new Error(
            `Unknown artifact input "${input}" for workflow node "${node.id}"`
          );
        }
      }
    }

    for (const output of node.outputs) {
      if ("kind" in output && output.ref.trim() === "") {
        throw new Error(
          `Invalid file output for workflow node "${node.id}"`
        );
      }

      if ("artifact" in output && output.artifact.trim() === "") {
        throw new Error(
          `Unknown artifact output "artifact:${output.artifact}" for workflow node "${node.id}"`
        );
      }

      if ("artifact" in output && !artifactIds.has(output.artifact)) {
        throw new Error(
          `Unknown artifact output "artifact:${output.artifact}" for workflow node "${node.id}"`
        );
      }
    }
  }
}

function validateHumanReviewConsistency(nodes: WorkflowNode[]) {
  for (const node of nodes) {
    if (node.humanReview?.required && node.exit.review !== "human") {
      throw new Error(
        `humanReview.required requires exit.review: human for workflow node "${node.id}"`
      );
    }
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
