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
import { resolveForgeServerSecurity } from "./server-security.js";
import { resolveForgeSqlitePath } from "./sqlite-path.js";
import { resolveWebAssetsRoot } from "./web-assets.js";

const port = Number(process.env.PORT ?? 3001);
const serverSecurity = resolveForgeServerSecurity({
  configuredHost: process.env.FORGE_HOST,
  configuredToken: process.env.FORGE_AUTH_TOKEN
});
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
  apiToken: serverSecurity.authToken,
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
  requireApiToken: serverSecurity.requireApiToken,
  workflowRunRepository: createSqliteWorkflowRunRepository(sqlitePath),
  workflowFileRepository: createSqliteWorkflowFileRepository(sqlitePath),
  webAssetsRoot
});

serve({
  fetch: app.fetch,
  hostname: serverSecurity.host,
  port
});

const browserHost =
  serverSecurity.host.includes(":")
    ? `[${serverSecurity.host}]`
    : serverSecurity.host;
const browserUrl = `http://${browserHost}:${port}`;

console.log(`Forge server listening on ${browserUrl}`);

if (webAssetsRoot) {
  console.log(`Forge Web console available at ${browserUrl}`);
} else {
  console.log(
    "Forge Web console assets not found. Run `pnpm --filter @forge/forge build` to bundle the Web console into Forge."
  );
}

if (serverSecurity.requireApiToken) {
  console.log(
    serverSecurity.authTokenPath
      ? `Remote API authentication is enabled. The token is stored at ${serverSecurity.authTokenPath}.`
      : "Remote API authentication is enabled with FORGE_AUTH_TOKEN."
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
