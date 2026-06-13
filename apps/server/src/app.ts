import { createHealthPayload } from "@forge/core";
import {
  artifactStorageModes,
  createInMemoryProjectRepository,
  dbStrategies,
  type ProjectRepository
} from "@forge/db";
import { Hono } from "hono";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  artifactStorageMode: z.enum(artifactStorageModes).optional(),
  dbStrategy: z.enum(dbStrategies).optional()
});

type AppDependencies = {
  projectRepository?: ProjectRepository;
};

export function createApp({ projectRepository }: AppDependencies = {}) {
  const app = new Hono();
  const projects = projectRepository ?? createInMemoryProjectRepository();

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

  return app;
}
