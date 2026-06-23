import {
  createSqliteDecompositionResultRepository,
  createSqliteExecutionSettingsRepository,
  createSqliteBridgeRepository,
  createSqliteProjectRepository,
  createSqliteRequirementRepository,
  createSqliteSkillRepository,
  createSqliteTaskRepository,
  createSqliteWorkflowRunRepository,
  createSqliteWorkflowFileRepository
} from "@forge/db";
import { serve } from "@hono/node-server";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { loadForgeConfig } from "./forge-config.js";
import { resolveReleaseAssetsRoot } from "./release-assets.js";
import { resolveForgeSqlitePath } from "./sqlite-path.js";
import { resolveWebAssetsRoot } from "./web-assets.js";

const port = Number(process.env.PORT ?? 3001);
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const sqlitePath = resolveForgeSqlitePath({
  configuredPath: process.env.FORGE_SQLITE_PATH,
  currentDirectory
});
const forgeConfig = loadForgeConfig({
  configuredPath: process.env.FORGE_CONFIG_PATH
});
const releaseAssetsRoot = getReleaseAssetsRoot();
const webAssetsRoot = getWebAssetsRoot();
const app = createApp({
  bridgeRepository: createSqliteBridgeRepository(sqlitePath),
  decompositionResultRepository:
    createSqliteDecompositionResultRepository(sqlitePath),
  executionSettingsRepository: createSqliteExecutionSettingsRepository(sqlitePath),
  projectRepository: createSqliteProjectRepository(sqlitePath),
  requirementRepository: createSqliteRequirementRepository(sqlitePath),
  skillRepository: createSqliteSkillRepository(sqlitePath),
  skillStorageRoot: forgeConfig.skillsRoot,
  taskRepository: createSqliteTaskRepository(sqlitePath),
  releaseAssetsRoot,
  workflowRunRepository: createSqliteWorkflowRunRepository(sqlitePath),
  workflowFileRepository: createSqliteWorkflowFileRepository(sqlitePath),
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
    "Forge Web console assets not found. Run `pnpm --filter @forge/forge build` to bundle the Web console into Forge."
  );
}

function getWebAssetsRoot() {
  return resolveWebAssetsRoot({
    configuredRoot: process.env.FORGE_WEB_ASSETS_ROOT,
    currentDirectory
  });
}

function getReleaseAssetsRoot() {
  return resolveReleaseAssetsRoot({
    configuredRoot: process.env.FORGE_RELEASE_ASSETS_ROOT,
    currentDirectory
  });
}
