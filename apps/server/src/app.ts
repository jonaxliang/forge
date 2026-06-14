import {
  createHealthPayload,
  parseWorkflowFile,
  planWorkflowDag,
  workflowFileSchema
} from "@forge/core";
import {
  artifactStorageModes,
  createInMemoryExecutionSettingsRepository,
  createInMemoryProjectRepository,
  createInMemoryRequirementRepository,
  createInMemoryTaskRepository,
  createInMemoryTaskDraftRepository,
  createInMemoryWorkflowRunRepository,
  createInMemoryWorkflowFileRepository,
  dbStrategies,
  modelProviderKinds,
  type ExecutionSettings,
  type ExecutionSettingsRepository,
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
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  artifactStorageMode: z.enum(artifactStorageModes).optional(),
  dbStrategy: z.enum(dbStrategies).optional()
});

const importWorkflowFileSchema = z.object({
  source: z.string().trim().min(1)
});

const createRequirementSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  workflowFileId: z.string().trim().min(1)
});

const updateExecutionSettingsSchema = z.object({
  agentProxyUrl: z.string().trim().optional(),
  modelApiKey: z.string().trim().optional(),
  modelBaseUrl: z.string().trim().min(1).optional(),
  modelName: z.string().trim().min(1).optional(),
  modelProvider: z.enum(modelProviderKinds).optional()
});

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

type AppDependencies = {
  agentProxyClient?: AgentProxyClient;
  executionSettingsRepository?: ExecutionSettingsRepository;
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

export function createApp({
  agentProxyClient,
  executionSettingsRepository,
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
  const executionSettings =
    executionSettingsRepository ?? createInMemoryExecutionSettingsRepository();
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

  app.get("/health", (c) => c.json(createHealthPayload()));

  app.get("/execution-settings", async (c) => {
    return c.json({
      executionSettings: serializeExecutionSettings(
        await executionSettings.getExecutionSettings()
      )
    });
  });

  app.patch("/execution-settings", async (c) => {
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

  app.get("/projects", async (c) => {
    return c.json({ projects: await projects.listProjects() });
  });

  app.post("/projects", async (c) => {
    const payload = createProjectSchema.safeParse(await c.req.json().catch(() => null));

    if (!payload.success) {
      return c.json({ error: "Invalid project payload" }, 400);
    }

    const project = await projects.createProject(payload.data);

    return c.json(project, 201);
  });

  app.get("/workflow-files", async (c) => {
    return c.json({ workflowFiles: await workflowFiles.listWorkflowFileMetadata() });
  });

  app.post("/workflow-files/import", async (c) => {
    const payload = importWorkflowFileSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid workflow import payload" }, 400);
    }

    try {
      const workflow = parseWorkflowFile(payload.data.source);
      const workflowFile = await workflowFiles.createWorkflowFileMetadata({
        definition: JSON.stringify(workflow),
        name: workflow.name,
        nodeCount: workflow.nodes.length,
        scope: workflow.scope
      });

      return c.json({ workflow, workflowFile }, 201);
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 400);
    }
  });

  app.get("/requirements", async (c) => {
    return c.json({ requirements: await requirements.listRequirements() });
  });

  app.post("/requirements", async (c) => {
    const payload = createRequirementSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid requirement payload" }, 400);
    }

    const requirement = await requirements.createRequirement(payload.data);

    try {
      const workflowFile = await workflowFiles.getWorkflowFileMetadata(
        requirement.workflowFileId
      );

      if (!workflowFile) {
        throw new Error("Selected workflow file was not found");
      }

      if (workflowFile.scope !== "requirement") {
        throw new Error("Selected workflow file must be requirement-scoped");
      }

      const settings = await executionSettings.getExecutionSettings();

      if (!settings.modelApiKey) {
        return c.json(
          {
            planning: {
              reason: "model_not_configured",
              status: "blocked"
            },
            requirement,
            taskDrafts: []
          },
          201
        );
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
            requirementId: requirement.id,
            sortOrder: taskDraft.sortOrder ?? index,
            title: taskDraft.title
          })
        );
      }

      return c.json(
        {
          requirement,
          taskDrafts: generatedTaskDrafts
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

  app.delete("/requirements/:id", async (c) => {
    const requirementId = c.req.param("id");

    try {
      await requirements.deleteRequirement(requirementId);
      await tasks.deleteTasksForRequirement(requirementId);

      return c.body(null, 204);
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 404);
    }
  });

  app.get("/task-drafts", async (c) => {
    return c.json({ taskDrafts: await taskDrafts.listTaskDrafts() });
  });

  app.patch("/task-drafts/:id", async (c) => {
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

  app.delete("/task-drafts/:id", async (c) => {
    await taskDrafts.deleteTaskDraft(c.req.param("id"));

    return c.body(null, 204);
  });

  app.post("/task-drafts/reorder", async (c) => {
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

  app.post("/task-drafts/:id/approve", async (c) => {
    const taskDraft = await taskDrafts.getTaskDraft(c.req.param("id"));

    if (!taskDraft) {
      return c.json({ error: "Task draft not found" }, 404);
    }

    const task = await tasks.createTaskFromDraft(taskDraft);
    await taskDrafts.deleteTaskDraft(taskDraft.id);

    return c.json({ task }, 201);
  });

  app.get("/tasks", async (c) => {
    return c.json({ tasks: await tasks.listTasks() });
  });

  app.post("/tasks/:id/workflow-runs", async (c) => {
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

      if (!settings.agentProxyUrl) {
        return c.json(
          {
            error:
              "Configure local Agent proxy before starting Workflow Runs"
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

      await proxyClient({
        agentProxyUrl: settings.agentProxyUrl,
        nodeRuns,
        task,
        workflowFile,
        workflowRun
      });

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

  app.get("/tasks/:id/workflow-runs", async (c) => {
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

  if (webAssetsRoot) {
    app.use(
      "*",
      serveStatic({
        root: webAssetsRoot,
        rewriteRequestPath: (path) => (path === "/" ? "/index.html" : path)
      })
    );
    app.get("*", async (c, next) => {
      if (isApiPath(c.req.path)) {
        return next();
      }

      return serveStatic({ path: "index.html", root: webAssetsRoot })(c, next);
    });
  }

  return app;
}

const apiPathPrefixes = [
  "/execution-settings",
  "/health",
  "/projects",
  "/requirements",
  "/task-drafts",
  "/tasks",
  "/workflow-files"
];

function isApiPath(path: string) {
  return apiPathPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function serializeExecutionSettings(settings: ExecutionSettings) {
  return {
    agentProxyConfigured: settings.agentProxyUrl.length > 0,
    agentProxyUrl: settings.agentProxyUrl,
    modelBaseUrl: settings.modelBaseUrl,
    modelConfigured: settings.modelApiKey.length > 0,
    modelName: settings.modelName,
    modelProvider: settings.modelProvider,
    updatedAt: settings.updatedAt
  };
}

async function planRequirementWithModel({
  requirement,
  settings,
  workflowFile
}: Parameters<RequirementPlanner>[0]) {
  const response = await fetch(
    `${settings.modelBaseUrl.replace(/\/$/, "")}/chat/completions`,
    {
      body: JSON.stringify({
        messages: [
          {
            content:
              "You split Forge Requirements into executable Tasks. Return strict JSON only: {\"tasks\":[{\"title\":\"...\",\"body\":\"...\"}]}",
            role: "system"
          },
          {
            content: JSON.stringify({
              requirement: {
                body: requirement.body,
                title: requirement.title
              },
              workflowFile: {
                name: workflowFile.name,
                scope: workflowFile.scope
              }
            }),
            role: "user"
          }
        ],
        model: settings.modelName,
        response_format: { type: "json_object" },
        temperature: 0.2
      }),
      headers: {
        authorization: `Bearer ${settings.modelApiKey}`,
        "content-type": "application/json"
      },
      method: "POST"
    }
  );

  if (!response.ok) {
    throw new Error(`Model planner failed with status ${response.status}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Model planner returned an empty response");
  }

  const parsed = JSON.parse(content) as {
    tasks?: Array<{ body?: string; title?: string }>;
  };
  const tasks = parsed.tasks ?? [];

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
