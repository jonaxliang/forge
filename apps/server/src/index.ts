import {
  createSqliteProjectRepository,
  createSqliteRequirementRepository,
  createSqliteTaskRepository,
  createSqliteTaskDraftRepository,
  createSqliteWorkflowFileRepository
} from "@forge/db";
import { serve } from "@hono/node-server";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3001);
const app = createApp({
  projectRepository: createSqliteProjectRepository(),
  requirementRepository: createSqliteRequirementRepository(),
  taskDraftRepository: createSqliteTaskDraftRepository(),
  taskRepository: createSqliteTaskRepository(),
  workflowFileRepository: createSqliteWorkflowFileRepository()
});

serve({
  fetch: app.fetch,
  port
});

console.log(`Forge server listening on http://localhost:${port}`);
