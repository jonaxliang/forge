import { createHealthPayload, parseWorkflowFile } from "@forge/core";
import {
  artifactStorageModes,
  createInMemoryProjectRepository,
  createInMemoryWorkflowFileRepository,
  dbStrategies,
  type ProjectRepository,
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

type AppDependencies = {
  projectRepository?: ProjectRepository;
  workflowFileRepository?: WorkflowFileRepository;
};

export function createApp({
  projectRepository,
  workflowFileRepository
}: AppDependencies = {}) {
  const app = new Hono();
  const projects = projectRepository ?? createInMemoryProjectRepository();
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

  return app;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
