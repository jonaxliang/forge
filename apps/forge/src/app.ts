import {
  createHealthPayload,
  parseWorkflowFile,
  planWorkflowDag,
  readLegacyWorkflowScope,
  workflowFileSchema,
  type WorkflowFile
} from "@forge/core";
import {
  artifactStorageModes,
  agentConnectorTypes,
  createInMemoryDecompositionResultRepository,
  createInMemoryBridgeRepository,
  createInMemoryExecutionSettingsRepository,
  createInMemoryProjectRepository,
  createInMemoryRequirementRepository,
  createInMemoryTaskRepository,
  createInMemoryWorkflowRunRepository,
  createInMemoryWorkflowFileRepository,
  dbStrategies,
  modelProviderDefaults,
  modelProviderKinds,
  type ExecutionSettings,
  type ExecutionSettingsRepository,
  type AgentBinding,
  type BridgeJob,
  type BridgeRepository,
  type DecompositionResult,
  type DecompositionResultItem,
  type DecompositionResultRepository,
  type ModelProviderKind,
  type ProjectRepository,
  type RequirementRepository,
  type Task,
  type TaskRepository,
  type WorkflowFileMetadata,
  type WorkflowRun,
  type WorkflowRunRepository,
  type WorkflowFileRepository
} from "@forge/db";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { serveStatic } from "@hono/node-server/serve-static";
import { generateText, Output, type LanguageModel } from "ai";
import { Hono } from "hono";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  artifactStorageMode: z.enum(artifactStorageModes).optional(),
  dbStrategy: z.enum(dbStrategies).optional()
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(1)
});

const importWorkflowFileSchema = z.object({
  source: z.string().trim().min(1),
  templateType: z.enum(["builtin", "custom"]).optional()
});

const updateWorkflowFileSchema = z.object({
  name: z.string().trim().min(1)
});

const createRequirementSchema = z.object({
  projectId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  workflowFileId: z.string().trim().min(1)
});

const updateRequirementSchema = z.object({
  title: z.string().trim().min(1)
});

const updateExecutionSettingsSchema = z.object({
  agentProxyUrl: z.string().trim().optional(),
  modelApiKey: z.string().trim().optional(),
  modelBaseUrl: z.string().trim().min(1).optional(),
  modelName: z.string().trim().min(1).optional(),
  modelProvider: z.enum(modelProviderKinds).optional()
});

function deduplicateWorkflowName(baseName: string, existingNames: string[]) {
  const trimmedBaseName = baseName.trim();
  const usedNames = new Set(existingNames.map((name) => name.trim()));

  if (!usedNames.has(trimmedBaseName)) {
    return trimmedBaseName;
  }

  let suffix = 2;
  let candidateName = `${trimmedBaseName} ${suffix}`;

  while (usedNames.has(candidateName)) {
    suffix += 1;
    candidateName = `${trimmedBaseName} ${suffix}`;
  }

  return candidateName;
}

const baseWorkflowTemplateSemanticKeyByName: Record<string, string> = {
  "autonomous research plan": "research-analysis",
  "code implementation": "software-task",
  "creative writing requirement": "creative-writing-task",
  "creative writing task": "creative-writing-task",
  "human approval": "review-approval",
  "research & writing requirement": "research-writing-task",
  "research & writing task": "research-writing-task",
  "research analysis": "research-analysis",
  "software change task": "software-task",
  "travel guide coding test": "travel-guide-coding-test",
  "writing review": "writing-editing",
  "代码编写模板": "software-task",
  "创意写作拆解模板": "creative-writing-task",
  "创意写作模板": "creative-writing-task",
  "调研分析模板": "research-analysis",
  "调研写作拆解模板": "research-writing-task",
  "调研写作模板": "research-writing-task",
  "评审审批模板": "review-approval",
  "写作编辑模板": "writing-editing",
  "旅行指南编写测试模板": "travel-guide-coding-test",
  "自主测试任务完成": "travel-guide-coding-test"
};
const baseWorkflowTemplateDisplayNameBySemanticKey: Record<string, string> = {
  "creative-writing-task": "创意写作模板",
  "research-analysis": "调研分析模板",
  "research-writing-task": "调研写作模板",
  "review-approval": "评审审批模板",
  "software-task": "代码编写模板",
  "travel-guide-coding-test": "旅行指南编写测试模板",
  "writing-editing": "写作编辑模板"
};

function normalizeBaseWorkflowTemplateName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+\d+$/, "");
}

function parseStoredWorkflowDefinition(definition: string): WorkflowFile | null {
  try {
    const parsed = JSON.parse(definition) as WorkflowFile;

    if (
      typeof parsed.name !== "string" ||
      !Array.isArray(parsed.nodes)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isLegacyRequirementWorkflowDefinition(definition: string) {
  return readLegacyWorkflowScope(definition) === "requirement";
}

function getBaseWorkflowTemplateSemanticKey(workflowFile: WorkflowFileMetadata) {
  const parsedWorkflow = parseStoredWorkflowDefinition(workflowFile.definition);
  const names = [workflowFile.name, parsedWorkflow?.name ?? ""];

  for (const name of names) {
    const key =
      baseWorkflowTemplateSemanticKeyByName[
        normalizeBaseWorkflowTemplateName(name)
      ];

    if (key) {
      return key;
    }
  }

  return "";
}

function selectWorkflowFileToKeep(
  currentWorkflowFile: WorkflowFileMetadata,
  candidateWorkflowFile: WorkflowFileMetadata
) {
  if (candidateWorkflowFile.nodeCount !== currentWorkflowFile.nodeCount) {
    return candidateWorkflowFile.nodeCount > currentWorkflowFile.nodeCount
      ? candidateWorkflowFile
      : currentWorkflowFile;
  }

  return candidateWorkflowFile.createdAt < currentWorkflowFile.createdAt
    ? candidateWorkflowFile
    : currentWorkflowFile;
}

async function deleteDuplicateBaseWorkflowTemplates(
  workflowFiles: WorkflowFileRepository
) {
  const existingWorkflowFiles = await workflowFiles.listWorkflowFileMetadata();
  const keptWorkflowFileBySemanticKey = new Map<string, WorkflowFileMetadata>();
  const duplicateWorkflowFileIds = new Set<string>();

  for (const workflowFile of existingWorkflowFiles) {
    const semanticKey = getBaseWorkflowTemplateSemanticKey(workflowFile);

    if (!semanticKey) {
      continue;
    }

    const currentWorkflowFile = keptWorkflowFileBySemanticKey.get(semanticKey);

    if (!currentWorkflowFile) {
      keptWorkflowFileBySemanticKey.set(semanticKey, workflowFile);
      continue;
    }

    const workflowFileToKeep = selectWorkflowFileToKeep(
      currentWorkflowFile,
      workflowFile
    );
    const workflowFileToDelete =
      workflowFileToKeep.id === currentWorkflowFile.id
        ? workflowFile
        : currentWorkflowFile;

    keptWorkflowFileBySemanticKey.set(semanticKey, workflowFileToKeep);
    duplicateWorkflowFileIds.add(workflowFileToDelete.id);
  }

  await Promise.all(
    [...duplicateWorkflowFileIds].map((workflowFileId) =>
      workflowFiles.deleteWorkflowFileMetadata(workflowFileId)
    )
  );

  await Promise.all(
    [...keptWorkflowFileBySemanticKey.entries()].map(
      ([semanticKey, workflowFile]) => {
        const displayName = baseWorkflowTemplateDisplayNameBySemanticKey[semanticKey];

        if (!displayName || workflowFile.name === displayName) {
          return Promise.resolve();
        }

        return workflowFiles.updateWorkflowFileMetadata({
          id: workflowFile.id,
          name: displayName
        });
      }
    )
  );

  return (await workflowFiles.listWorkflowFileMetadata()).map((workflowFile) =>
    getBaseWorkflowTemplateSemanticKey(workflowFile)
      ? { ...workflowFile, templateType: "builtin" as const }
      : workflowFile
  );
}

const bridgeAgentSchema = z.object({
  capabilities: z.array(z.string().trim().min(1)).optional(),
  command: z.string().trim().min(1),
  connector: z.enum(agentConnectorTypes),
  name: z.string().trim().min(1)
});

const bridgeRegisterSchema = z.object({
  agents: z.array(bridgeAgentSchema).min(1),
  bridgeId: z.string().trim().min(1)
});

const bridgeJobCompletionSchema = z.object({
  errorMessage: z.string().trim().nullable().optional(),
  output: z.string().optional(),
  status: z.enum(["succeeded", "failed"])
});

const plannedTasksSchema = z.object({
  summary: z.string().trim().optional(),
  tasks: z
    .array(
      z.object({
        body: z.string().trim().min(1),
        title: z.string().trim().min(1)
      })
    )
    .min(1)
});

type AppDependencies = {
  agentProxyClient?: AgentProxyClient;
  bridgeRepository?: BridgeRepository;
  decompositionResultRepository?: DecompositionResultRepository;
  executionSettingsRepository?: ExecutionSettingsRepository;
  modelApiTester?: ModelApiTester;
  projectRepository?: ProjectRepository;
  requirementPlanner?: RequirementPlanner;
  requirementRepository?: RequirementRepository;
  taskRepository?: TaskRepository;
  workflowRunRepository?: WorkflowRunRepository;
  workflowFileRepository?: WorkflowFileRepository;
  webAssetsRoot?: string;
};

type RequirementPlanner = (input: {
  requirement: {
    id: string;
    title: string;
    body: string;
  };
  settings: ExecutionSettings;
  workflowFile: WorkflowFileMetadata;
}) => Promise<{
  items: DecompositionResultItem[];
  summary: string;
}>;

type AgentProxyClient = (input: {
  agentProxyUrl: string;
  nodeRuns: Array<{
    dependsOn: string[];
    id: string;
    nodeId: string;
    sortOrder: number;
    status: string;
  }>;
  task: Task;
  workflowFile: WorkflowFileMetadata;
  workflowRun: WorkflowRun;
}) => Promise<void>;

type ModelApiTester = (settings: ExecutionSettings) => Promise<void>;

export function createApp({
  agentProxyClient,
  bridgeRepository,
  decompositionResultRepository,
  executionSettingsRepository,
  modelApiTester,
  projectRepository,
  requirementPlanner,
  requirementRepository,
  taskRepository,
  workflowRunRepository,
  workflowFileRepository,
  webAssetsRoot
}: AppDependencies = {}) {
  const app = new Hono();
  const api = new Hono();
  const executionSettings =
    executionSettingsRepository ?? createInMemoryExecutionSettingsRepository();
  const bridges = bridgeRepository ?? createInMemoryBridgeRepository();
  const decompositionResults =
    decompositionResultRepository ?? createInMemoryDecompositionResultRepository();
  const projects = projectRepository ?? createInMemoryProjectRepository();
  const requirements =
    requirementRepository ?? createInMemoryRequirementRepository();
  const tasks = taskRepository ?? createInMemoryTaskRepository();
  const workflowRuns =
    workflowRunRepository ?? createInMemoryWorkflowRunRepository();
  const workflowFiles =
    workflowFileRepository ?? createInMemoryWorkflowFileRepository();
  const planner = requirementPlanner ?? planRequirementWithModel;
  const proxyClient = agentProxyClient ?? startWorkflowRunViaAgentProxy;
  const testModelApi = modelApiTester ?? testModelApiWithProvider;

  async function createDecompositionResultForRequirement(requirement: {
    id: string;
    projectId: string | null;
    workflowFileId: string;
    title: string;
    body: string;
  }) {
    const workflowFile = await workflowFiles.getWorkflowFileMetadata(
      requirement.workflowFileId
    );

    if (!workflowFile) {
      throw new Error("Selected workflow file was not found");
    }

    const settings = await executionSettings.getExecutionSettings();

    if (!isModelConfigured(settings)) {
      throw new Error("Model configuration is required before decomposing requirements");
    }

    const plannedDecomposition = await planner({
      requirement,
      settings,
      workflowFile
    });
    const decompositionResult =
      await decompositionResults.saveDecompositionResult({
        items: plannedDecomposition.items,
        projectId: requirement.projectId,
        requirementId: requirement.id,
        summary: plannedDecomposition.summary
      });

    const updatedRequirement = await requirements.updateRequirementStatus({
      id: requirement.id,
      status: "ready_to_generate_tasks"
    });

    return { decompositionResult, requirement: updatedRequirement };
  }

  api.get("/health", (c) => c.json(createHealthPayload()));

  api.get("/execution-settings", async (c) => {
    return c.json({
      executionSettings: serializeExecutionSettings(
        await executionSettings.getExecutionSettings()
      )
    });
  });

  api.patch("/execution-settings", async (c) => {
    const payload = updateExecutionSettingsSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid execution settings payload" }, 400);
    }

    return c.json({
      executionSettings: serializeExecutionSettings(
        await executionSettings.updateExecutionSettings(payload.data)
      )
    });
  });

  api.post("/execution-settings/model/test", async (c) => {
    const payload = updateExecutionSettingsSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid model API test payload", ok: false }, 400);
    }

    const settings = createTransientModelSettings(
      await executionSettings.getExecutionSettings(),
      payload.data
    );

    try {
      if (!isModelConfigured(settings)) {
        throw new Error("Model API key is required for this provider");
      }

      await testModelApi(settings);

      return c.json({ ok: true });
    } catch (error) {
      return c.json({ error: getErrorMessage(error), ok: false }, 400);
    }
  });

  api.get("/projects", async (c) => {
    return c.json({ projects: await projects.listProjects() });
  });

  api.post("/projects", async (c) => {
    const payload = createProjectSchema.safeParse(await c.req.json().catch(() => null));

    if (!payload.success) {
      return c.json({ error: "Invalid project payload" }, 400);
    }

    try {
      const project = await projects.createProject(payload.data);

      return c.json(project, 201);
    } catch (error) {
      const message = getErrorMessage(error);

      return c.json(
        { error: message },
        message.toLowerCase().includes("already exists") ? 409 : 400
      );
    }
  });

  api.patch("/projects/:id", async (c) => {
    const payload = updateProjectSchema.safeParse(await c.req.json().catch(() => null));

    if (!payload.success) {
      return c.json({ error: "Invalid project payload" }, 400);
    }

    try {
      const project = await projects.updateProject({
        id: c.req.param("id"),
        name: payload.data.name
      });

      return c.json(project);
    } catch (error) {
      const message = getErrorMessage(error);
      const status = message.toLowerCase().includes("already exists")
        ? 409
        : message.toLowerCase().includes("not found")
          ? 404
          : 400;

      return c.json({ error: message }, status);
    }
  });

  api.get("/agent-bindings", async (c) => {
    return c.json({
      agentBindings: (await bridges.listAgentBindings()).map(serializeAgentBinding)
    });
  });

  api.post("/bridges/register", async (c) => {
    const payload = bridgeRegisterSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid local bridge registration payload" }, 400);
    }

    const agents = [];

    for (const agent of payload.data.agents) {
      agents.push(
        await bridges.upsertAgentBinding({
          capabilities: agent.capabilities ?? [agent.connector],
          command: agent.command,
          connector: agent.connector,
          name: agent.name,
          status: "online"
        })
      );
    }

    return c.json({
      agents: agents.map(serializeAgentBinding),
      bridgeId: payload.data.bridgeId
    });
  });

  api.post("/bridges/:bridgeId/heartbeat", async (c) => {
    const payload = bridgeRegisterSchema
      .omit({ bridgeId: true })
      .safeParse(await c.req.json().catch(() => null));

    if (!payload.success) {
      return c.json({ error: "Invalid local bridge heartbeat payload" }, 400);
    }

    const agents = [];

    for (const agent of payload.data.agents) {
      agents.push(
        await bridges.upsertAgentBinding({
          capabilities: agent.capabilities ?? [agent.connector],
          command: agent.command,
          connector: agent.connector,
          name: agent.name,
          status: "online"
        })
      );
    }

    return c.json({
      agents: agents.map(serializeAgentBinding),
      bridgeId: c.req.param("bridgeId")
    });
  });

  api.get("/bridges/:bridgeId/jobs/next", async (c) => {
    const job = await bridges.claimNextBridgeJob(c.req.param("bridgeId"));

    if (!job) {
      return c.json({ job: null });
    }

    return c.json({ job: serializeBridgeJob(job) });
  });

  api.post("/bridges/:bridgeId/jobs/:jobId/complete", async (c) => {
    const payload = bridgeJobCompletionSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid local bridge job completion payload" }, 400);
    }

    try {
      const job = await bridges.completeBridgeJob({
        errorMessage: payload.data.errorMessage ?? null,
        id: c.req.param("jobId"),
        output: payload.data.output ?? null,
        status: payload.data.status
      });
      const nodeStatus = payload.data.status === "succeeded" ? "succeeded" : "failed";
      const workflowStatus =
        payload.data.status === "succeeded" ? "succeeded" : "failed";

      await workflowRuns.updateNodeRunStatus({
        id: job.nodeRunId,
        status: nodeStatus
      });
      await workflowRuns.updateWorkflowRunStatus({
        id: job.workflowRunId,
        status: workflowStatus
      });

      return c.json({ job: serializeBridgeJob(job) });
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 404);
    }
  });

  api.get("/workflow-files", async (c) => {
    const metadata = await deleteDuplicateBaseWorkflowTemplates(workflowFiles);

    return c.json({
      workflowFiles: metadata.filter(
        (workflowFile) =>
          !isLegacyRequirementWorkflowDefinition(workflowFile.definition)
      )
    });
  });

  api.post("/workflow-files/import", async (c) => {
    const payload = importWorkflowFileSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid workflow import payload" }, 400);
    }

    try {
      if (readLegacyWorkflowScope(payload.data.source) === "requirement") {
        throw new Error("Requirement-scoped Workflow Files are no longer supported");
      }

      const workflow = parseWorkflowFile(payload.data.source);
      const existingWorkflowFiles = await workflowFiles.listWorkflowFileMetadata();
      const workflowName = deduplicateWorkflowName(
        workflow.name,
        existingWorkflowFiles.map((workflowFile) => workflowFile.name)
      );
      const storedWorkflow = { ...workflow, name: workflowName };
      const workflowFile = await workflowFiles.createWorkflowFileMetadata({
        definition: JSON.stringify(storedWorkflow),
        name: storedWorkflow.name,
        nodeCount: storedWorkflow.nodes.length,
        templateType: payload.data.templateType
      });

      return c.json({ workflow: storedWorkflow, workflowFile }, 201);
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 400);
    }
  });

  api.patch("/workflow-files/:id", async (c) => {
    const payload = updateWorkflowFileSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid workflow update payload" }, 400);
    }

    try {
      const workflowFile = await workflowFiles.getWorkflowFileMetadata(
        c.req.param("id")
      );

      if (!workflowFile) {
        return c.json({ error: "Workflow file was not found" }, 404);
      }

      const existingWorkflowFiles = await workflowFiles.listWorkflowFileMetadata();
      const workflowName = deduplicateWorkflowName(
        payload.data.name,
        existingWorkflowFiles
          .filter((existingWorkflowFile) => existingWorkflowFile.id !== workflowFile.id)
          .map((existingWorkflowFile) => existingWorkflowFile.name)
      );
      const updatedWorkflowFile = await workflowFiles.updateWorkflowFileMetadata({
        id: workflowFile.id,
        name: workflowName
      });

      return c.json({ workflowFile: updatedWorkflowFile });
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 400);
    }
  });

  api.get("/requirements", async (c) => {
    return c.json({ requirements: await requirements.listRequirements() });
  });

  api.post("/requirements", async (c) => {
    const payload = createRequirementSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid requirement payload" }, 400);
    }

    let requirement;

    try {
      requirement = await requirements.createRequirement(payload.data);
    } catch (error) {
      const message = getErrorMessage(error);

      return c.json(
        { error: message },
        message.toLowerCase().includes("already exists") ? 409 : 400
      );
    }

    return c.json(
      {
        decompositionResult: null,
        requirement
      },
      201
    );
  });

  api.patch("/requirements/:id", async (c) => {
    const payload = updateRequirementSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid requirement payload" }, 400);
    }

    try {
      return c.json(
        await requirements.updateRequirement({
          id: c.req.param("id"),
          title: payload.data.title
        })
      );
    } catch (error) {
      const message = getErrorMessage(error);
      const status = message.toLowerCase().includes("already exists")
        ? 409
        : message.toLowerCase().includes("not found")
          ? 404
          : 400;

      return c.json({ error: message }, status);
    }
  });

  api.delete("/requirements/:id", async (c) => {
    const requirementId = c.req.param("id");

    try {
      await requirements.deleteRequirement(requirementId);
      await tasks.deleteTasksForRequirement(requirementId);

      return c.body(null, 204);
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 404);
    }
  });

  api.post("/requirements/:id/decomposition-result", async (c) => {
    const requirement = (await requirements.listRequirements()).find(
      (currentRequirement) => currentRequirement.id === c.req.param("id")
    );

    if (!requirement) {
      return c.json({ error: "Requirement not found" }, 404);
    }

    const existingTasks = (await tasks.listTasks()).filter(
      (task) => task.requirementId === requirement.id
    );

    if (existingTasks.length > 0) {
      return c.json({ error: "Requirement already has generated tasks" }, 409);
    }

    await requirements.updateRequirementStatus({
      id: requirement.id,
      status: "decomposing"
    });

    try {
      return c.json(await createDecompositionResultForRequirement(requirement), 201);
    } catch (error) {
      const message = getErrorMessage(error);
      const failedRequirement = await requirements.updateRequirementStatus({
        errorMessage: message,
        id: requirement.id,
        status: "decomposition_failed"
      });

      return c.json(
        {
          decompositionResult: null,
          error: message,
          requirement: failedRequirement
        },
        400
      );
    }
  });

  api.get("/decomposition-results", async (c) => {
    const results = await Promise.all(
      (await requirements.listRequirements()).map((requirement) =>
        decompositionResults.getDecompositionResultForRequirement(requirement.id)
      )
    );

    return c.json({
      decompositionResults: results.filter(
        (result): result is DecompositionResult => result !== null
      )
    });
  });

  api.patch("/decomposition-results/:id", async (c) => {
    const payload = plannedTasksSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid decomposition result payload" }, 400);
    }

    try {
      return c.json({
        decompositionResult:
          await decompositionResults.updateDecompositionResult({
            id: c.req.param("id"),
            items: payload.data.tasks.map((task, index) => ({
              body: task.body,
              sortOrder: index,
              title: task.title
            })),
            summary: payload.data.summary ?? ""
          })
      });
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 404);
    }
  });

  api.post("/decomposition-results/:id/generate-tasks", async (c) => {
    const decompositionResult = await decompositionResults.getDecompositionResult(
      c.req.param("id")
    );

    if (!decompositionResult) {
      return c.json({ error: "Decomposition result not found" }, 404);
    }

    const existingTasks = (await tasks.listTasks()).filter(
      (task) => task.requirementId === decompositionResult.requirementId
    );

    if (existingTasks.length > 0) {
      return c.json({ error: "Requirement already has generated tasks" }, 409);
    }

    const generatedTasks = await tasks.createTasksFromDecompositionResult({
      items: decompositionResult.items,
      projectId: decompositionResult.projectId,
      requirementId: decompositionResult.requirementId
    });
    const requirement = await requirements.updateRequirementStatus({
      id: decompositionResult.requirementId,
      status: "tasks_generated"
    });

    return c.json({ requirement, tasks: generatedTasks }, 201);
  });

  api.get("/tasks", async (c) => {
    return c.json({ tasks: await tasks.listTasks() });
  });

  api.post("/tasks/:id/workflow-runs", async (c) => {
    const payload = z
      .object({
        workflowFileId: z.string().trim().min(1)
      })
      .safeParse(await c.req.json().catch(() => null));

    if (!payload.success) {
      return c.json({ error: "Invalid workflow run payload" }, 400);
    }

    try {
      const task = await tasks.getTask(c.req.param("id"));

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const workflowFile = await workflowFiles.getWorkflowFileMetadata(
        payload.data.workflowFileId
      );

      if (!workflowFile) {
        throw new Error("Selected workflow file was not found");
      }

      const settings = await executionSettings.getExecutionSettings();
      const hasOnlineBridgeAgents = await bridges.hasOnlineAgentBindings();

      if (!settings.agentProxyUrl && !hasOnlineBridgeAgents) {
        return c.json(
          {
            error:
              "Configure local bridge before starting Task Workflows"
          },
          409
        );
      }

      const workflow = workflowFileSchema.parse(JSON.parse(workflowFile.definition));
      const workflowRun = await workflowRuns.createWorkflowRun({
        taskId: c.req.param("id"),
        workflowFileId: workflowFile.id
      });
      const plannedNodes = planWorkflowDag(workflow);
      const nodeRuns = [];

      for (const [index, node] of plannedNodes.entries()) {
        nodeRuns.push(
          await workflowRuns.createNodeRun({
            dependsOn: node.dependsOn,
            nodeId: node.id,
            sortOrder: index,
            status: "queued",
            workflowRunId: workflowRun.id
          })
        );
      }

      if (settings.agentProxyUrl) {
        await proxyClient({
          agentProxyUrl: settings.agentProxyUrl,
          nodeRuns,
          task,
          workflowFile,
          workflowRun
        });
      } else {
        const agentBindings = await bridges.listAgentBindings();

        for (const [index, nodeRun] of nodeRuns.entries()) {
          await bridges.createBridgeJob({
            agentName: resolveAgentName(plannedNodes[index].executor, agentBindings),
            nodeRunId: nodeRun.id,
            payload: {
              nodeRun,
              task,
              workflowFile,
              workflowRun
            },
            workflowRunId: workflowRun.id
          });
        }
      }

      return c.json(
        {
          nodeRuns,
          workflowRun
        },
        201
      );
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 400);
    }
  });

  api.get("/tasks/:id/workflow-runs", async (c) => {
    const task = await tasks.getTask(c.req.param("id"));

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    const runs = await workflowRuns.listWorkflowRuns(c.req.param("id"));
    const workflowRunsWithNodes = await Promise.all(
      runs.map(async (workflowRun) => ({
        nodeRuns: await workflowRuns.listNodeRuns(workflowRun.id),
        workflowRun
      }))
    );

    return c.json({ workflowRuns: workflowRunsWithNodes });
  });

  app.route("/api", api);
  app.all("/api/*", (c) => c.json({ error: "API route not found" }, 404));

  if (webAssetsRoot) {
    app.use(
      "*",
      serveStatic({
        root: webAssetsRoot,
        rewriteRequestPath: (path) => (path === "/" ? "/index.html" : path)
      })
    );
    app.get("*", async (c, next) =>
      serveStatic({ path: "index.html", root: webAssetsRoot })(c, next)
    );
  }

  return app;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function serializeExecutionSettings(settings: ExecutionSettings) {
  return {
    agentProxyConfigured: settings.agentProxyUrl.length > 0,
    agentProxyUrl: settings.agentProxyUrl,
    modelBaseUrl: settings.modelBaseUrl,
    modelConfigured: isModelConfigured(settings),
    modelName: settings.modelName,
    modelProvider: settings.modelProvider,
    updatedAt: settings.updatedAt
  };
}

function serializeAgentBinding(agent: AgentBinding) {
  return {
    capabilities: agent.capabilities,
    command: agent.command,
    connector: agent.connector,
    errorMessage: agent.errorMessage,
    id: agent.id,
    lastSeenAt: agent.lastSeenAt,
    name: agent.name,
    status: agent.status,
    updatedAt: agent.updatedAt
  };
}

function serializeBridgeJob(job: BridgeJob) {
  return {
    ...(job.payload && typeof job.payload === "object" ? job.payload : {}),
    agentName: job.agentName,
    bridgeId: job.bridgeId,
    errorMessage: job.errorMessage,
    id: job.id,
    output: job.output,
    status: job.status,
    workflowRunId: job.workflowRunId
  };
}

function resolveAgentName(executor: string, agentBindings: AgentBinding[]) {
  if (executor.startsWith("agent:")) {
    return executor.slice("agent:".length);
  }

  const onlineAgent = agentBindings.find((agent) => agent.status === "online");

  if (!onlineAgent) {
    throw new Error("No online Agent Binding is available for this Workflow Node");
  }

  return onlineAgent.name;
}

function isModelConfigured(settings: ExecutionSettings) {
  return (
    !modelProviderDefaults[settings.modelProvider].requiresApiKey ||
    settings.modelApiKey.length > 0
  );
}

function createTransientModelSettings(
  current: ExecutionSettings,
  input: z.infer<typeof updateExecutionSettingsSchema>
): ExecutionSettings {
  const nextModelProvider = input.modelProvider ?? current.modelProvider;
  const providerChanged =
    input.modelProvider !== undefined && input.modelProvider !== current.modelProvider;
  const providerDefaults = modelProviderDefaults[nextModelProvider];
  const nextModelApiKey = input.modelApiKey?.trim();

  return {
    ...current,
    modelApiKey: nextModelApiKey ? nextModelApiKey : current.modelApiKey,
    modelBaseUrl:
      input.modelBaseUrl?.trim() ??
      (providerChanged ? providerDefaults.baseUrl : current.modelBaseUrl),
    modelName:
      input.modelName?.trim() ??
      (providerChanged ? providerDefaults.modelName : current.modelName),
    modelProvider: nextModelProvider
  };
}

async function testModelApiWithProvider(settings: ExecutionSettings) {
  await generateText({
    model: createPlanningLanguageModel(settings),
    prompt: "Reply with exactly: ok",
    system: "You are validating that a model API key and endpoint work.",
    temperature: 0
  });
}

async function planRequirementWithModel({
  requirement,
  settings,
  workflowFile
}: Parameters<RequirementPlanner>[0]) {
  const { output } = await generateText({
    model: createPlanningLanguageModel(settings),
    output: Output.object({
      description:
        "An editable decomposition result with executable Forge Tasks planned from a Requirement.",
      name: "forgeRequirementPlan",
      schema: plannedTasksSchema
    }),
    prompt: JSON.stringify({
      requirement: {
        body: requirement.body,
        title: requirement.title
      },
      workflowFile: {
        name: workflowFile.name
      }
    }),
    system:
      "You split Forge Requirements into executable Tasks. Return concise Task titles and actionable Task bodies.",
    temperature: 0.2
  });

  const tasks = output.tasks;

  if (tasks.length === 0) {
    throw new Error("Model returned no decomposition result items");
  }

  return {
    items: tasks.map((task, index) => {
      if (!task.title?.trim() || !task.body?.trim()) {
        throw new Error("Model returned an invalid decomposition result item");
      }

      return {
        body: task.body.trim(),
        sortOrder: index,
        title: task.title.trim()
      };
    }),
    summary:
      output.summary?.trim() ||
      `拆解出 ${tasks.length} 个任务，确认后可生成任务。`
  };
}

type ProviderOptions = {
  apiKey?: string;
  baseURL?: string;
};

const planningLanguageModelFactories: Record<
  ModelProviderKind,
  (settings: ExecutionSettings) => LanguageModel
> = {
  anthropic: (settings) =>
    createAnthropic(createProviderOptions(settings)).chat(settings.modelName),
  deepseek: (settings) =>
    createDeepSeek(createProviderOptions(settings)).chat(settings.modelName),
  google: (settings) =>
    createGoogleGenerativeAI(createProviderOptions(settings)).chat(settings.modelName),
  groq: (settings) => createGroq(createProviderOptions(settings))(settings.modelName),
  lmstudio: (settings) => createOpenAICompatibleModel(settings, "lmstudio"),
  mistral: (settings) =>
    createMistral(createProviderOptions(settings)).chat(settings.modelName),
  ollama: (settings) => createOpenAICompatibleModel(settings, "ollama"),
  openai: (settings) =>
    createOpenAI(createProviderOptions(settings)).chat(settings.modelName),
  "openai-compatible": (settings) =>
    createOpenAICompatibleModel(settings, "openai-compatible"),
  openrouter: (settings) => createOpenAICompatibleModel(settings, "openrouter")
};

function createPlanningLanguageModel(settings: ExecutionSettings) {
  return planningLanguageModelFactories[settings.modelProvider](settings);
}

function createProviderOptions(settings: ExecutionSettings): ProviderOptions {
  return {
    ...(settings.modelApiKey ? { apiKey: settings.modelApiKey } : {}),
    ...(settings.modelBaseUrl ? { baseURL: settings.modelBaseUrl } : {})
  };
}

function createOpenAICompatibleModel(
  settings: ExecutionSettings,
  name: string
): LanguageModel {
  const provider = createOpenAICompatible({
    ...createProviderOptions(settings),
    baseURL:
      settings.modelBaseUrl || modelProviderDefaults[settings.modelProvider].baseUrl,
    name
  });

  return provider.chatModel(settings.modelName);
}

async function startWorkflowRunViaAgentProxy({
  agentProxyUrl,
  nodeRuns,
  task,
  workflowFile,
  workflowRun
}: Parameters<AgentProxyClient>[0]) {
  const response = await fetch(
    `${agentProxyUrl.replace(/\/$/, "")}/workflow-runs`,
    {
      body: JSON.stringify({
        nodeRuns,
        task,
        workflowFile,
        workflowRun
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    }
  );

  if (!response.ok) {
    throw new Error(`Local executor rejected Task Workflow with status ${response.status}`);
  }
}
