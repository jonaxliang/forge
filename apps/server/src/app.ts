import { createHealthPayload, parseWorkflowFile } from "@forge/core";
import {
  artifactStorageModes,
  createInMemoryProjectRepository,
  createInMemoryRequirementRepository,
  createInMemoryTaskDraftRepository,
  createInMemoryWorkflowFileRepository,
  dbStrategies,
  type ProjectRepository,
  type Requirement,
  type RequirementRepository,
  type TaskDraft,
  type TaskDraftRepository,
  type WorkflowFileRepository
} from "@forge/db";
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

type AppDependencies = {
  projectRepository?: ProjectRepository;
  requirementRepository?: RequirementRepository;
  taskDraftRepository?: TaskDraftRepository;
  workflowFileRepository?: WorkflowFileRepository;
};

export function createApp({
  projectRepository,
  requirementRepository,
  taskDraftRepository,
  workflowFileRepository
}: AppDependencies = {}) {
  const app = new Hono();
  const projects = projectRepository ?? createInMemoryProjectRepository();
  const requirements =
    requirementRepository ?? createInMemoryRequirementRepository();
  const taskDrafts = taskDraftRepository ?? createInMemoryTaskDraftRepository();
  const workflowFiles =
    workflowFileRepository ?? createInMemoryWorkflowFileRepository();

  app.get("/health", (c) => c.json(createHealthPayload()));

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

      const generatedTaskDrafts = await runMockRequirementWorkflow(
        requirement,
        async (taskDraft) => taskDrafts.createTaskDraft(taskDraft)
      );
      const completedRequirement = await requirements.updateRequirementStatus({
        id: requirement.id,
        status: "completed"
      });

      return c.json(
        {
          requirement: completedRequirement,
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

  app.get("/task-drafts", async (c) => {
    return c.json({ taskDrafts: await taskDrafts.listTaskDrafts() });
  });

  return app;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function runMockRequirementWorkflow(
  requirement: Requirement,
  createTaskDraft: (
    input: Pick<TaskDraft, "body" | "requirementId" | "sortOrder" | "title">
  ) => Promise<TaskDraft>
) {
  return [
    await createTaskDraft({
      body: `Generated from requirement: ${requirement.body}`,
      requirementId: requirement.id,
      sortOrder: 0,
      title: `Draft: ${requirement.title}`
    })
  ];
}
