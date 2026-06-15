import {
  createHealthPayload,
  parseWorkflowFile,
  planWorkflowDag,
  workflowFileSchema
} from "@forge/core";
import {
  artifactStorageModes,
  agentConnectorTypes,
  createInMemoryBridgeRepository,
  createInMemoryExecutionSettingsRepository,
  createInMemoryProjectRepository,
  createInMemoryRequirementRepository,
  createInMemoryTaskRepository,
  createInMemoryTaskDraftRepository,
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
  type ModelProviderKind,
  type ProjectRepository,
  type RequirementRepository,
  type Task,
  type TaskDraft,
  type TaskDraftRepository,
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
  source: z.string().trim().min(1)
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

const updateTaskDraftSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1)
});

const reorderTaskDraftsSchema = z.object({
  order: z.array(
    z.object({
      id: z.string().trim().min(1),
      sortOrder: z.number().int().min(0)
    })
  )
});

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
  executionSettingsRepository?: ExecutionSettingsRepository;
  modelApiTester?: ModelApiTester;
  projectRepository?: ProjectRepository;
  requirementPlanner?: RequirementPlanner;
  requirementRepository?: RequirementRepository;
  taskDraftRepository?: TaskDraftRepository;
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
}) => Promise<Array<Pick<TaskDraft, "body" | "sortOrder" | "title">>>;

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
  executionSettingsRepository,
  modelApiTester,
  projectRepository,
  requirementPlanner,
  requirementRepository,
  taskDraftRepository,
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
  const projects = projectRepository ?? createInMemoryProjectRepository();
  const requirements =
    requirementRepository ?? createInMemoryRequirementRepository();
  const taskDrafts = taskDraftRepository ?? createInMemoryTaskDraftRepository();
  const tasks = taskRepository ?? createInMemoryTaskRepository();
  const workflowRuns =
    workflowRunRepository ?? createInMemoryWorkflowRunRepository();
  const workflowFiles =
    workflowFileRepository ?? createInMemoryWorkflowFileRepository();
  const planner = requirementPlanner ?? planRequirementWithModel;
  const proxyClient = agentProxyClient ?? startWorkflowRunViaAgentProxy;
  const testModelApi = modelApiTester ?? testModelApiWithProvider;

  async function planTaskDraftsForRequirement(requirement: {
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
      return {
        planning: {
          reason: "model_not_configured" as const,
          status: "blocked" as const
        },
        taskDrafts: []
      };
    }

    const plannedTaskDrafts = await planner({
      requirement,
      settings,
      workflowFile
    });
    const generatedTaskDrafts = [];

    for (const [index, taskDraft] of plannedTaskDrafts.entries()) {
      generatedTaskDrafts.push(
        await taskDrafts.createTaskDraft({
          body: taskDraft.body,
          projectId: requirement.projectId,
          requirementId: requirement.id,
          sortOrder: taskDraft.sortOrder ?? index,
          title: taskDraft.title
        })
      );
    }

    return { taskDrafts: generatedTaskDrafts };
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
      return c.json({ error: "Invalid Bridge registration payload" }, 400);
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
      return c.json({ error: "Invalid Bridge heartbeat payload" }, 400);
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
      return c.json({ error: "Invalid Bridge job completion payload" }, 400);
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
    return c.json({ workflowFiles: await workflowFiles.listWorkflowFileMetadata() });
  });

  api.post("/workflow-files/import", async (c) => {
    const payload = importWorkflowFileSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid workflow import payload" }, 400);
    }

    try {
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
        scope: storedWorkflow.scope
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

    try {
      const planningResult = await planTaskDraftsForRequirement(requirement);

      return c.json(
        {
          ...planningResult,
          requirement,
        },
        201
      );
    } catch (error) {
      const message = getErrorMessage(error);
      const failedRequirement = await requirements.updateRequirementStatus({
        errorMessage: message,
        id: requirement.id,
        status: "failed"
      });

      return c.json(
        {
          error: message,
          requirement: failedRequirement,
          taskDrafts: []
        },
        400
      );
    }
  });

  api.post("/requirements/:id/task-drafts", async (c) => {
    const requirement = (await requirements.listRequirements()).find(
      (currentRequirement) => currentRequirement.id === c.req.param("id")
    );

    if (!requirement) {
      return c.json({ error: "Requirement not found" }, 404);
    }

    const existingTaskDrafts = (await taskDrafts.listTaskDrafts()).filter(
      (taskDraft) => taskDraft.requirementId === requirement.id
    );
    const existingTasks = (await tasks.listTasks()).filter(
      (task) => task.requirementId === requirement.id
    );

    if (existingTaskDrafts.length > 0 || existingTasks.length > 0) {
      return c.json(
        { error: "Requirement already has generated work" },
        409
      );
    }

    try {
      const planningResult = await planTaskDraftsForRequirement(requirement);

      return c.json(
        {
          ...planningResult,
          requirement
        },
        201
      );
    } catch (error) {
      const message = getErrorMessage(error);
      const failedRequirement = await requirements.updateRequirementStatus({
        errorMessage: message,
        id: requirement.id,
        status: "failed"
      });

      return c.json(
        {
          error: message,
          requirement: failedRequirement,
          taskDrafts: []
        },
        400
      );
    }
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

  api.get("/task-drafts", async (c) => {
    return c.json({ taskDrafts: await taskDrafts.listTaskDrafts() });
  });

  api.patch("/task-drafts/:id", async (c) => {
    const payload = updateTaskDraftSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid task draft payload" }, 400);
    }

    try {
      return c.json(
        await taskDrafts.updateTaskDraft({
          id: c.req.param("id"),
          ...payload.data
        })
      );
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 404);
    }
  });

  api.delete("/task-drafts/:id", async (c) => {
    await taskDrafts.deleteTaskDraft(c.req.param("id"));

    return c.body(null, 204);
  });

  api.post("/task-drafts/reorder", async (c) => {
    const payload = reorderTaskDraftsSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid task draft order payload" }, 400);
    }

    return c.json({
      taskDrafts: await taskDrafts.reorderTaskDrafts(payload.data.order)
    });
  });

  api.post("/task-drafts/:id/approve", async (c) => {
    const taskDraft = await taskDrafts.getTaskDraft(c.req.param("id"));

    if (!taskDraft) {
      return c.json({ error: "Task draft not found" }, 404);
    }

    const task = await tasks.createTaskFromDraft(taskDraft);
    await taskDrafts.deleteTaskDraft(taskDraft.id);

    return c.json({ task }, 201);
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

      if (workflowFile.scope !== "task") {
        throw new Error("Selected workflow file must be task-scoped");
      }

      const settings = await executionSettings.getExecutionSettings();
      const hasOnlineBridgeAgents = await bridges.hasOnlineAgentBindings();

      if (!settings.agentProxyUrl && !hasOnlineBridgeAgents) {
        return c.json(
          {
            error:
              "Configure local Bridge or Agent proxy before starting Workflow Runs"
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
      description: "A list of executable Forge Tasks planned from a Requirement.",
      name: "forgeRequirementPlan",
      schema: plannedTasksSchema
    }),
    prompt: JSON.stringify({
      requirement: {
        body: requirement.body,
        title: requirement.title
      },
      workflowFile: {
        name: workflowFile.name,
        scope: workflowFile.scope
      }
    }),
    system:
      "You split Forge Requirements into executable Tasks. Return concise Task titles and actionable Task bodies.",
    temperature: 0.2
  });

  const tasks = output.tasks;

  if (tasks.length === 0) {
    throw new Error("Model planner returned no Tasks");
  }

  return tasks.map((task, index) => {
    if (!task.title?.trim() || !task.body?.trim()) {
      throw new Error("Model planner returned an invalid Task");
    }

    return {
      body: task.body.trim(),
      sortOrder: index,
      title: task.title.trim()
    };
  });
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
    throw new Error(`Agent proxy rejected Workflow Run with status ${response.status}`);
  }
}
