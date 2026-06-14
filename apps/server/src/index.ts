import {
  createSqliteExecutionSettingsRepository,
  createSqliteProjectRepository,
  createSqliteRequirementRepository,
  createSqliteTaskRepository,
  createSqliteTaskDraftRepository,
  createSqliteWorkflowRunRepository,
  createSqliteWorkflowFileRepository
} from "@forge/db";
import { serve } from "@hono/node-server";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const webAssetsRoot = getWebAssetsRoot();
const app = createApp({
  executionSettingsRepository: createSqliteExecutionSettingsRepository(),
  projectRepository: createSqliteProjectRepository(),
  requirementRepository: createSqliteRequirementRepository(),
  taskDraftRepository: createSqliteTaskDraftRepository(),
  taskRepository: createSqliteTaskRepository(),
  workflowRunRepository: createSqliteWorkflowRunRepository(),
  workflowFileRepository: createSqliteWorkflowFileRepository(),
  webAssetsRoot
});

serve({
  fetch: app.fetch,
  port
});

console.log(`Forge server listening on http://localhost:${port}`);

if (webAssetsRoot) {
  console.log(`Forge Web console available at http://localhost:${port}`);
} else {
  console.log(
    "Forge Web console assets not found. Run `pnpm --filter @forge/web build` to bundle the Web console into the server."
  );
}

function getWebAssetsRoot() {
  const configuredRoot = process.env.FORGE_WEB_ASSETS_ROOT;

  if (configuredRoot && existsSync(join(configuredRoot, "index.html"))) {
    return configuredRoot;
  }

  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const bundledRoot = join(currentDirectory, "../../web/dist");

  if (existsSync(join(bundledRoot, "index.html"))) {
    return bundledRoot;
  }

  return undefined;
}
