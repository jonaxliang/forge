import Database from "better-sqlite3";
import type { ExitReviewResult, NodeRunAttempt } from "@forge/core";
import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export * from "./domain.js";
export * from "./model-providers.js";
export type * from "./contracts.js";

import { executorTypes } from "./domain.js";
import { modelProviderDefaults } from "./model-providers.js";
import type {
  AgentBindingStatus,
  AgentConnectorType,
  ArtifactStorageMode,
  BridgeJobStatus,
  DbStrategy,
  ExecutorType,
  ModelProviderKind,
  NodeRunStatus,
  RequirementStatus,
  TaskStatus,
  WorkflowRunStatus
} from "./domain.js";
import type {
  AgentBinding,
  BridgeJob,
  BridgeRepository,
  DatabaseStatus,
  DecompositionResult,
  DecompositionResultItem,
  DecompositionResultItemInput,
  DecompositionResultRepository,
  ExecutionSettings,
  ExecutionSettingsRepository,
  NodeRun,
  Project,
  ProjectRepository,
  Requirement,
  RequirementRepository,
  Skill,
  SkillRepository,
  Task,
  TaskRepository,
  WorkflowFileMetadata,
  WorkflowFileRepository,
  WorkflowRun,
  WorkflowRunRepository
} from "./contracts.js";

const agentBindingOnlineTtlMs = 30_000;

const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  artifactStorageMode: text("artifact_storage_mode").notNull(),
  dbStrategy: text("db_strategy").notNull(),
  defaultExecutorType: text("default_executor_type").notNull(),
  defaultExecutorAgentBindingId: text("default_executor_agent_binding_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type ProjectRow = typeof projects.$inferSelect;

const workflowFiles = sqliteTable("workflow_files", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nodeCount: integer("node_count").notNull(),
  definition: text("definition").notNull(),
  templateType: text("template_type").notNull(),
  createdAt: text("created_at").notNull()
});

type WorkflowFileRow = typeof workflowFiles.$inferSelect;

const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  name: text("name").notNull(),
  ref: text("ref").notNull(),
  description: text("description").notNull(),
  body: text("body").notNull(),
  files: text("files").notNull(),
  sourceUrl: text("source_url"),
  storagePath: text("storage_path").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type SkillRow = typeof skills.$inferSelect;

const executionSettings = sqliteTable("execution_settings", {
  id: text("id").primaryKey(),
  defaultExecutorType: text("default_executor_type").notNull(),
  defaultExecutorAgentBindingId: text("default_executor_agent_binding_id"),
  modelProvider: text("model_provider").notNull(),
  modelBaseUrl: text("model_base_url").notNull(),
  modelName: text("model_name").notNull(),
  modelApiKey: text("model_api_key").notNull(),
  agentProxyUrl: text("agent_proxy_url").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type ExecutionSettingsRow = typeof executionSettings.$inferSelect;

const requirements = sqliteTable("requirements", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  workflowFileId: text("workflow_file_id").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type RequirementRow = typeof requirements.$inferSelect;

const decompositionResults = sqliteTable("decomposition_results", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  requirementId: text("requirement_id").notNull(),
  summary: text("summary").notNull(),
  items: text("items").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type DecompositionResultRow = typeof decompositionResults.$inferSelect;

const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  requirementId: text("requirement_id").notNull(),
  sourceItemId: text("source_item_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  dependsOn: text("depends_on").notNull(),
  executorType: text("executor_type").notNull(),
  executorAgentBindingId: text("executor_agent_binding_id"),
  executorLabel: text("executor_label").notNull(),
  status: text("status").notNull(),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type TaskRow = typeof tasks.$inferSelect;

const workflowRuns = sqliteTable("workflow_runs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  workflowFileId: text("workflow_file_id").notNull(),
  executorAssignments: text("executor_assignments").notNull(),
  correctionFeedback: text("correction_feedback"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type WorkflowRunRow = typeof workflowRuns.$inferSelect;

const nodeRuns = sqliteTable("node_runs", {
  id: text("id").primaryKey(),
  workflowRunId: text("workflow_run_id").notNull(),
  nodeId: text("node_id").notNull(),
  dependsOn: text("depends_on").notNull(),
  attempt: integer("attempt").notNull(),
  attempts: text("attempts").notNull(),
  exitReview: text("exit_review"),
  retryCount: integer("retry_count").notNull(),
  status: text("status").notNull(),
  sortOrder: integer("sort_order").notNull(),
  output: text("output"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type NodeRunRow = typeof nodeRuns.$inferSelect;

const agentBindings = sqliteTable("agent_bindings", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  connector: text("connector").notNull(),
  command: text("command").notNull(),
  capabilities: text("capabilities").notNull(),
  status: text("status").notNull(),
  lastSeenAt: text("last_seen_at"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type AgentBindingRow = typeof agentBindings.$inferSelect;

const bridgeJobs = sqliteTable("bridge_jobs", {
  id: text("id").primaryKey(),
  workflowRunId: text("workflow_run_id").notNull(),
  nodeRunId: text("node_run_id").notNull(),
  agentName: text("agent_name").notNull(),
  bridgeId: text("bridge_id"),
  status: text("status").notNull(),
  payload: text("payload").notNull(),
  output: text("output"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type BridgeJobRow = typeof bridgeJobs.$inferSelect;

export function createDatabaseStatus(): DatabaseStatus {
  return {
    configured: false,
    dialect: "unconfigured"
  };
}

export function createInMemoryProjectRepository(): ProjectRepository {
  return createProjectRepository(new Database(":memory:"));
}

export function createInMemoryWorkflowFileRepository(): WorkflowFileRepository {
  return createWorkflowFileRepository(new Database(":memory:"));
}

export function createInMemorySkillRepository(): SkillRepository {
  return createSkillRepository(new Database(":memory:"));
}

export function createInMemoryExecutionSettingsRepository(): ExecutionSettingsRepository {
  return createExecutionSettingsRepository(new Database(":memory:"));
}

export function createInMemoryRequirementRepository(): RequirementRepository {
  return createRequirementRepository(new Database(":memory:"));
}

export function createInMemoryDecompositionResultRepository(): DecompositionResultRepository {
  return createDecompositionResultRepository(new Database(":memory:"));
}

export function createInMemoryTaskRepository(): TaskRepository {
  return createTaskRepository(new Database(":memory:"));
}

export function createInMemoryWorkflowRunRepository(): WorkflowRunRepository {
  return createWorkflowRunRepository(new Database(":memory:"));
}

export function createInMemoryBridgeRepository(): BridgeRepository {
  return createBridgeRepository(new Database(":memory:"));
}

export function createSqliteProjectRepository(
  filename = ".forge/forge.sqlite"
): ProjectRepository {
  return createProjectRepository(openSqliteDatabase(filename));
}

export function createSqliteWorkflowFileRepository(
  filename = ".forge/forge.sqlite"
): WorkflowFileRepository {
  return createWorkflowFileRepository(openSqliteDatabase(filename));
}

export function createSqliteSkillRepository(
  filename = ".forge/forge.sqlite"
): SkillRepository {
  return createSkillRepository(openSqliteDatabase(filename));
}

export function createSqliteExecutionSettingsRepository(
  filename = ".forge/forge.sqlite"
): ExecutionSettingsRepository {
  return createExecutionSettingsRepository(openSqliteDatabase(filename));
}

export function createSqliteRequirementRepository(
  filename = ".forge/forge.sqlite"
): RequirementRepository {
  return createRequirementRepository(openSqliteDatabase(filename));
}

export function createSqliteDecompositionResultRepository(
  filename = ".forge/forge.sqlite"
): DecompositionResultRepository {
  return createDecompositionResultRepository(openSqliteDatabase(filename));
}

export function createSqliteTaskRepository(
  filename = ".forge/forge.sqlite"
): TaskRepository {
  return createTaskRepository(openSqliteDatabase(filename));
}

export function createSqliteWorkflowRunRepository(
  filename = ".forge/forge.sqlite"
): WorkflowRunRepository {
  return createWorkflowRunRepository(openSqliteDatabase(filename));
}

export function createSqliteBridgeRepository(
  filename = ".forge/forge.sqlite"
): BridgeRepository {
  return createBridgeRepository(openSqliteDatabase(filename));
}

function openSqliteDatabase(filename: string) {
  mkdirSync(dirname(filename), { recursive: true });
  const sqlite = new Database(filename);

  chmodSync(filename, 0o600);

  return sqlite;
}

function createProjectRepository(sqlite: Database.Database): ProjectRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db, sqlite);

  return {
    async createProject(input) {
      const now = new Date().toISOString();
      const name = input.name.trim();
      const existing = await db
        .select()
        .from(projects)
        .where(eq(projects.name, name))
        .get();

      if (existing) {
        throw new Error(`Project already exists: ${name}`);
      }

      const project: Project = {
        id: `proj_${randomUUID()}`,
        name,
        artifactStorageMode: input.artifactStorageMode ?? "local-only",
        dbStrategy: input.dbStrategy ?? "sqlite",
        defaultExecutorAgentBindingId:
          input.defaultExecutorType === "agent-binding"
            ? input.defaultExecutorAgentBindingId?.trim() || null
            : null,
        defaultExecutorType: input.defaultExecutorType ?? "model-api",
        createdAt: now,
        updatedAt: now
      };

      await db.insert(projects).values(project).run();

      return project;
    },

    async listProjects() {
      const rows = await db.select().from(projects).orderBy(asc(projects.createdAt));

      return rows.map(toProject);
    },

    async updateProject(input) {
      const current = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.id))
        .get();

      if (!current) {
        throw new Error(`Project not found: ${input.id}`);
      }

      const name = input.name === undefined ? current.name : input.name.trim();

      if (!name) {
        throw new Error("Project name is required");
      }

      if (name !== current.name) {
        const existing = await db
          .select()
          .from(projects)
          .where(eq(projects.name, name))
          .get();

        if (existing && existing.id !== input.id) {
          throw new Error(`Project already exists: ${name}`);
        }
      }

      const updatedAt = createNextTimestamp(current.updatedAt);
      const defaultExecutorType =
        input.defaultExecutorType ??
        (current.defaultExecutorType as ExecutorType | null) ??
        "model-api";
      const requestedDefaultExecutorAgentBindingId =
        input.defaultExecutorAgentBindingId === undefined
          ? current.defaultExecutorAgentBindingId
          : input.defaultExecutorAgentBindingId?.trim() || null;
      const defaultExecutorAgentBindingId =
        defaultExecutorType === "agent-binding"
          ? requestedDefaultExecutorAgentBindingId
          : null;

      await db
        .update(projects)
        .set({
          defaultExecutorAgentBindingId,
          defaultExecutorType,
          name,
          updatedAt
        })
        .where(eq(projects.id, input.id))
        .run();

      return {
        ...toProject(current),
        defaultExecutorAgentBindingId,
        defaultExecutorType,
        name,
        updatedAt
      };
    }
  };
}

function createNextTimestamp(previousTimestamp: string) {
  const now = new Date();
  const previousTime = Date.parse(previousTimestamp);

  if (Number.isFinite(previousTime) && now.getTime() <= previousTime) {
    return new Date(previousTime + 1).toISOString();
  }

  return now.toISOString();
}

function initializeSqliteSchema(db: BetterSQLite3Database, sqlite: Database.Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      artifact_storage_mode TEXT NOT NULL,
      db_strategy TEXT NOT NULL,
      default_executor_type TEXT NOT NULL DEFAULT 'model-api',
      default_executor_agent_binding_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  ensureSqliteColumn(
    db,
    "projects",
    "default_executor_type",
    "TEXT NOT NULL DEFAULT 'model-api'"
  );
  ensureSqliteColumn(
    db,
    "projects",
    "default_executor_agent_binding_id",
    "TEXT"
  );
  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_files (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      node_count INTEGER NOT NULL,
      definition TEXT NOT NULL DEFAULT '{}',
      template_type TEXT NOT NULL DEFAULT 'custom',
      created_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT,
      name TEXT NOT NULL,
      ref TEXT NOT NULL,
      description TEXT NOT NULL,
      body TEXT NOT NULL,
      files TEXT NOT NULL DEFAULT '[]',
      source_url TEXT,
      storage_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  ensureSqliteColumn(db, "skills", "files", "TEXT NOT NULL DEFAULT '[]'");
  ensureSqliteColumn(db, "skills", "source_url", "TEXT");
  ensureSqliteColumn(db, "skills", "storage_path", "TEXT NOT NULL DEFAULT ''");
  db.run(`
    CREATE TABLE IF NOT EXISTS execution_settings (
      id TEXT PRIMARY KEY NOT NULL,
      default_executor_type TEXT NOT NULL DEFAULT 'model-api',
      default_executor_agent_binding_id TEXT,
      model_provider TEXT NOT NULL,
      model_base_url TEXT NOT NULL,
      model_name TEXT NOT NULL,
      model_api_key TEXT NOT NULL,
      agent_proxy_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS requirements (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      workflow_file_id TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS decomposition_results (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT,
      requirement_id TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      items TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT,
      requirement_id TEXT NOT NULL,
      source_item_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      depends_on TEXT NOT NULL DEFAULT '[]',
      executor_type TEXT NOT NULL DEFAULT 'model-api',
      executor_agent_binding_id TEXT,
      executor_label TEXT NOT NULL DEFAULT 'Model API',
      status TEXT NOT NULL,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      workflow_file_id TEXT NOT NULL,
      executor_assignments TEXT NOT NULL DEFAULT '{}',
      correction_feedback TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  ensureSqliteColumn(
    db,
    "workflow_runs",
    "executor_assignments",
    "TEXT NOT NULL DEFAULT '{}'"
  );
  ensureSqliteColumn(db, "workflow_runs", "correction_feedback", "TEXT");
  db.run(`
    CREATE TABLE IF NOT EXISTS node_runs (
      id TEXT PRIMARY KEY NOT NULL,
      workflow_run_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      depends_on TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 1,
      attempts TEXT NOT NULL DEFAULT '[]',
      exit_review TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      output TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  ensureSqliteColumn(db, "node_runs", "output", "TEXT");
  ensureSqliteColumn(db, "node_runs", "error_message", "TEXT");
  ensureSqliteColumn(db, "node_runs", "attempt", "INTEGER NOT NULL DEFAULT 1");
  ensureSqliteColumn(db, "node_runs", "attempts", "TEXT NOT NULL DEFAULT '[]'");
  ensureSqliteColumn(db, "node_runs", "exit_review", "TEXT");
  ensureSqliteColumn(db, "node_runs", "retry_count", "INTEGER NOT NULL DEFAULT 0");
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_bindings (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      connector TEXT NOT NULL,
      command TEXT NOT NULL,
      capabilities TEXT NOT NULL,
      status TEXT NOT NULL,
      last_seen_at TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS bridge_jobs (
      id TEXT PRIMARY KEY NOT NULL,
      workflow_run_id TEXT NOT NULL,
      node_run_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      bridge_id TEXT,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      output TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  ensureSqliteColumn(
    db,
    "execution_settings",
    "default_executor_type",
    "TEXT NOT NULL DEFAULT 'model-api'"
  );
  ensureSqliteColumn(
    db,
    "execution_settings",
    "default_executor_agent_binding_id",
    "TEXT"
  );
  ensureSqliteColumn(
    db,
    "tasks",
    "executor_type",
    "TEXT NOT NULL DEFAULT 'model-api'"
  );
  ensureSqliteColumn(db, "tasks", "executor_agent_binding_id", "TEXT");
  ensureSqliteColumn(
    db,
    "tasks",
    "executor_label",
    "TEXT NOT NULL DEFAULT 'Model API'"
  );
  ensureSqliteColumn(db, "workflow_files", "template_type", "TEXT NOT NULL DEFAULT 'custom'");
  dropLegacyWorkflowFileScopeColumn(sqlite);
  ensureSqliteColumn(db, "requirements", "project_id", "TEXT");
  ensureSqliteColumn(db, "tasks", "project_id", "TEXT");
  ensureSqliteColumn(db, "tasks", "source_item_id", "TEXT NOT NULL DEFAULT ''");
  ensureSqliteColumn(db, "tasks", "depends_on", "TEXT NOT NULL DEFAULT '[]'");
  ensureSqliteColumn(db, "requirements", "deleted_at", "TEXT");
  ensureSqliteColumn(db, "tasks", "deleted_at", "TEXT");
}

function dropLegacyWorkflowFileScopeColumn(sqlite: Database.Database) {
  const columns = sqlite
    .prepare("PRAGMA table_info(workflow_files)")
    .all() as Array<{ name: string }>;

  if (!columns.some((column) => column.name === "scope")) {
    return;
  }

  sqlite.exec(`
    CREATE TABLE workflow_files_next (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      node_count INTEGER NOT NULL,
      definition TEXT NOT NULL DEFAULT '{}',
      template_type TEXT NOT NULL DEFAULT 'custom',
      created_at TEXT NOT NULL
    );
    INSERT INTO workflow_files_next (
      id,
      name,
      node_count,
      definition,
      template_type,
      created_at
    )
    SELECT
      id,
      name,
      node_count,
      definition,
      template_type,
      created_at
    FROM workflow_files;
    DROP TABLE workflow_files;
    ALTER TABLE workflow_files_next RENAME TO workflow_files;
  `);
}

function ensureSqliteColumn(
  db: BetterSQLite3Database,
  tableName: string,
  columnName: string,
  definition: string
) {
  try {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  } catch (error) {
    if (!getSqliteErrorMessage(error).includes("duplicate column name")) {
      throw error;
    }
  }
}

function getSqliteErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const causeMessage: string =
      "cause" in error && error.cause
        ? ` ${getSqliteErrorMessage(error.cause)}`
        : "";

    return `${error.message}${causeMessage}`;
  }

  return String(error);
}

function updateWorkflowDefinitionName(definition: string, name: string) {
  const parsed = JSON.parse(definition) as { name?: unknown };

  if (parsed && typeof parsed === "object") {
    return JSON.stringify({
      ...parsed,
      name
    });
  }

  return definition;
}

async function ensureExecutionSettings(
  db: BetterSQLite3Database
): Promise<ExecutionSettings> {
  const existing = await db
    .select()
    .from(executionSettings)
    .where(eq(executionSettings.id, "default"))
    .get();

  if (existing) {
    return toExecutionSettings(existing);
  }

  const now = new Date().toISOString();
  const settings: ExecutionSettings = {
    agentProxyUrl: "",
    createdAt: now,
    defaultExecutorAgentBindingId: null,
    defaultExecutorType: "model-api",
    id: "default",
    modelApiKey: "",
    modelBaseUrl: modelProviderDefaults["openai-compatible"].baseUrl,
    modelName: modelProviderDefaults["openai-compatible"].modelName,
    modelProvider: "openai-compatible",
    updatedAt: now
  };

  await db.insert(executionSettings).values(settings).run();

  return settings;
}

function createWorkflowFileRepository(
  sqlite: Database.Database
): WorkflowFileRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db, sqlite);

  return {
    async createWorkflowFileMetadata(input) {
      const workflowFile: WorkflowFileMetadata = {
        id: `wff_${randomUUID()}`,
        name: input.name.trim(),
        nodeCount: input.nodeCount,
        definition: input.definition ?? "{}",
        templateType: input.templateType ?? "custom",
        createdAt: new Date().toISOString()
      };

      await db
        .insert(workflowFiles)
        .values(workflowFile)
        .run();

      return workflowFile;
    },

    async deleteWorkflowFileMetadata(id) {
      await db
        .delete(workflowFiles)
        .where(eq(workflowFiles.id, id))
        .run();
    },

    async getWorkflowFileMetadata(id) {
      const row = await db
        .select()
        .from(workflowFiles)
        .where(eq(workflowFiles.id, id))
        .get();

      return row ? toWorkflowFileMetadata(row) : null;
    },

    async listWorkflowFileMetadata() {
      const rows = await db
        .select()
        .from(workflowFiles)
        .orderBy(asc(workflowFiles.createdAt));

      return rows.map(toWorkflowFileMetadata);
    },

    async updateWorkflowFileMetadata(input) {
      const name = input.name.trim();

      if (!name) {
        throw new Error("Workflow name is required");
      }

      const row = await db
        .select()
        .from(workflowFiles)
        .where(eq(workflowFiles.id, input.id))
        .get();

      if (!row) {
        throw new Error(`Workflow file not found: ${input.id}`);
      }

      const definition = updateWorkflowDefinitionName(
        input.definition ?? row.definition,
        name
      );
      const nodeCount = input.nodeCount ?? row.nodeCount;
      const updated = {
        ...row,
        definition,
        name,
        nodeCount
      };

      await db
        .update(workflowFiles)
        .set({
          definition,
          name,
          nodeCount
        })
        .where(eq(workflowFiles.id, input.id))
        .run();

      return toWorkflowFileMetadata(updated);
    }
  };
}

function createSkillRepository(sqlite: Database.Database): SkillRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db, sqlite);

  return {
    async createSkill(input) {
      const name = input.name.trim();
      const ref = input.ref.trim();
      const body = input.body.trim();

      if (!name) {
        throw new Error("Skill name is required");
      }
      if (!ref) {
        throw new Error("Skill ref is required");
      }
      if (!body) {
        throw new Error("Skill body is required");
      }

      const now = new Date().toISOString();
      const skill: Skill = {
        body,
        createdAt: now,
        description: input.description?.trim() ?? "",
        files: input.files ?? [{ content: body, path: "SKILL.md" }],
        id: `skl_${randomUUID()}`,
        name,
        projectId: input.projectId?.trim() || null,
        ref,
        sourceUrl: input.sourceUrl?.trim() || null,
        storagePath: input.storagePath?.trim() ?? "",
        updatedAt: now
      };

      await db.insert(skills).values({
        ...skill,
        files: JSON.stringify(skill.files)
      }).run();

      return skill;
    },

    async deleteSkill(id) {
      const row = await db
        .select()
        .from(skills)
        .where(eq(skills.id, id))
        .get();

      if (!row) {
        throw new Error(`Skill not found: ${id}`);
      }

      await db.delete(skills).where(eq(skills.id, id)).run();
    },

    async listSkills(projectId) {
      const query = db
        .select()
        .from(skills)
        .orderBy(asc(skills.createdAt));
      const normalizedProjectId =
        typeof projectId === "string" ? projectId.trim() : projectId;
      const rows =
        normalizedProjectId === undefined
          ? await query
          : normalizedProjectId
            ? await query.where(
                or(
                  isNull(skills.projectId),
                  eq(skills.projectId, normalizedProjectId)
                )
              )
            : await query.where(isNull(skills.projectId));

      return rows.map(toSkill);
    },

    async updateSkill(id, input) {
      const current = await db
        .select()
        .from(skills)
        .where(eq(skills.id, id))
        .get();

      if (!current) {
        throw new Error(`Skill not found: ${id}`);
      }

      const body = input.body.trim();
      const name = input.name?.trim() || current.name;
      const ref = input.ref?.trim() || current.ref;

      if (!body) {
        throw new Error("Skill body is required");
      }
      if (!name) {
        throw new Error("Skill name is required");
      }
      if (!ref) {
        throw new Error("Skill ref is required");
      }

      const updatedSkill: Skill = {
        body,
        createdAt: current.createdAt,
        description: input.description?.trim() ?? current.description,
        files: input.files ?? parseJsonArray(current.files).map((file) => ({
          content: typeof file.content === "string" ? file.content : "",
          path: typeof file.path === "string" ? file.path : "SKILL.md"
        })),
        id: current.id,
        name,
        projectId: current.projectId,
        ref,
        sourceUrl:
          input.sourceUrl === undefined
            ? current.sourceUrl
            : input.sourceUrl?.trim() || null,
        storagePath: input.storagePath?.trim() ?? current.storagePath,
        updatedAt: createNextTimestamp(current.updatedAt)
      };

      await db
        .update(skills)
        .set({
          body: updatedSkill.body,
          description: updatedSkill.description,
          files: JSON.stringify(updatedSkill.files),
          name: updatedSkill.name,
          ref: updatedSkill.ref,
          sourceUrl: updatedSkill.sourceUrl,
          storagePath: updatedSkill.storagePath,
          updatedAt: updatedSkill.updatedAt
        })
        .where(eq(skills.id, id))
        .run();

      return updatedSkill;
    }
  };
}

function createExecutionSettingsRepository(
  sqlite: Database.Database
): ExecutionSettingsRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db, sqlite);

  return {
    async getExecutionSettings() {
      return ensureExecutionSettings(db);
    },

    async updateExecutionSettings(input) {
      const current = await ensureExecutionSettings(db);
      const updatedAt = nextTimestamp(current.updatedAt);
      const nextModelApiKey = input.modelApiKey?.trim();
      const defaultExecutorType =
        input.defaultExecutorType ?? current.defaultExecutorType;
      const requestedDefaultExecutorAgentBindingId =
        input.defaultExecutorAgentBindingId === undefined
          ? current.defaultExecutorAgentBindingId
          : input.defaultExecutorAgentBindingId?.trim() || null;
      const modelProvider = input.modelProvider ?? current.modelProvider;
      const providerChanged =
        input.modelProvider !== undefined && input.modelProvider !== current.modelProvider;
      const providerDefaults = modelProviderDefaults[modelProvider];
      const modelBaseUrl =
        input.modelBaseUrl?.trim() ??
        (providerChanged ? providerDefaults.baseUrl : current.modelBaseUrl);
      const modelConnectionChanged =
        providerChanged || modelBaseUrl !== current.modelBaseUrl;
      const updated: ExecutionSettings = {
        ...current,
        agentProxyUrl: input.agentProxyUrl?.trim() ?? current.agentProxyUrl,
        defaultExecutorAgentBindingId:
          defaultExecutorType === "agent-binding"
            ? requestedDefaultExecutorAgentBindingId
            : null,
        defaultExecutorType,
        modelApiKey: nextModelApiKey
          ? nextModelApiKey
          : modelConnectionChanged
            ? ""
            : current.modelApiKey,
        modelBaseUrl,
        modelName:
          input.modelName?.trim() ??
          (providerChanged ? providerDefaults.modelName : current.modelName),
        modelProvider,
        updatedAt
      };

      await db
        .update(executionSettings)
        .set({
          agentProxyUrl: updated.agentProxyUrl,
          defaultExecutorAgentBindingId: updated.defaultExecutorAgentBindingId,
          defaultExecutorType: updated.defaultExecutorType,
          modelApiKey: updated.modelApiKey,
          modelBaseUrl: updated.modelBaseUrl,
          modelName: updated.modelName,
          modelProvider: updated.modelProvider,
          updatedAt
        })
        .where(eq(executionSettings.id, updated.id))
        .run();

      return updated;
    }
  };
}

function createRequirementRepository(
  sqlite: Database.Database
): RequirementRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db, sqlite);

  return {
    async createRequirement(input) {
      const now = new Date().toISOString();
      const projectId = input.projectId?.trim() || null;
      const title = input.title.trim();
      const existing = await findActiveRequirementByProjectAndTitle(
        db,
        projectId,
        title
      );

      if (existing) {
        throw new Error(`Requirement already exists: ${title}`);
      }

      const requirement: Requirement = {
        id: `req_${randomUUID()}`,
        projectId,
        title,
        body: input.body.trim(),
        workflowFileId: input.workflowFileId,
        status: "init",
        errorMessage: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      };

      await db.insert(requirements).values(requirement).run();

      return requirement;
    },

    async deleteRequirement(id) {
      const row = await db
        .select()
        .from(requirements)
        .where(and(eq(requirements.id, id), isNull(requirements.deletedAt)))
        .get();

      if (!row) {
        throw new Error(`Requirement not found: ${id}`);
      }

      const deletedAt = nextTimestamp(row.updatedAt);

      await db
        .update(requirements)
        .set({
          deletedAt,
          updatedAt: deletedAt
        })
        .where(eq(requirements.id, id))
        .run();
    },

    async listRequirements() {
      const rows = await db
        .select()
        .from(requirements)
        .where(isNull(requirements.deletedAt))
        .orderBy(asc(requirements.createdAt));

      return rows.map(toRequirement);
    },

    async updateRequirement(input) {
      const title = input.title.trim();
      const body = input.body.trim();

      if (!title) {
        throw new Error("Requirement title is required");
      }
      if (!body) {
        throw new Error("Requirement body is required");
      }

      const row = await db
        .select()
        .from(requirements)
        .where(and(eq(requirements.id, input.id), isNull(requirements.deletedAt)))
        .get();

      if (!row) {
        throw new Error(`Requirement not found: ${input.id}`);
      }

      const existing = await findActiveRequirementByProjectAndTitle(
        db,
        row.projectId,
        title
      );

      if (existing && existing.id !== input.id) {
        throw new Error(`Requirement already exists: ${title}`);
      }

      const updatedAt = nextTimestamp(row.updatedAt);

      await db
        .update(requirements)
        .set({
          body,
          title,
          updatedAt
        })
        .where(eq(requirements.id, input.id))
        .run();

      return toRequirement({
        ...row,
        body,
        title,
        updatedAt
      });
    },

    async updateRequirementStatus(input) {
      const row = await db
        .select()
        .from(requirements)
        .where(and(eq(requirements.id, input.id), isNull(requirements.deletedAt)))
        .get();

      if (!row) {
        throw new Error(`Requirement not found: ${input.id}`);
      }

      const updatedAt = nextTimestamp(row.updatedAt);
      const updated = {
        ...row,
        status: input.status,
        errorMessage: input.errorMessage ?? null,
        updatedAt
      };

      await db
        .update(requirements)
        .set({
          errorMessage: updated.errorMessage,
          status: updated.status,
          updatedAt
        })
        .where(eq(requirements.id, input.id))
        .run();

      return toRequirement(updated);
    }
  };
}

async function findActiveRequirementByProjectAndTitle(
  db: BetterSQLite3Database,
  projectId: string | null,
  title: string
) {
  return db
    .select()
    .from(requirements)
    .where(
      and(
        projectId === null
          ? isNull(requirements.projectId)
          : eq(requirements.projectId, projectId),
        eq(requirements.title, title),
        isNull(requirements.deletedAt)
      )
    )
    .get();
}

function normalizeDecompositionItems(items: DecompositionResultItemInput[]) {
  const itemIds = items.map((item, index) => item.id?.trim() || `item_${index + 1}`);
  const knownIds = new Set(itemIds);

  const normalizedItems = items.map((item, index) => {
    const id = itemIds[index]!;
    const dependsOn = (item.dependsOn ?? []).map((dependency) => dependency.trim());
    const unknownDependency = dependsOn.find((dependency) => !knownIds.has(dependency));

    if (unknownDependency) {
      throw new Error(
        `Unknown decomposition item dependency "${unknownDependency}" for item "${id}"`
      );
    }

    if (dependsOn.includes(id)) {
      throw new Error(`Decomposition item "${id}" cannot depend on itself`);
    }

    return {
      id,
      body: item.body.trim(),
      dependsOn,
      executorAgentBindingId:
        item.executorType === "agent-binding"
          ? item.executorAgentBindingId?.trim() || null
          : null,
      executorLabel:
        item.executorLabel?.trim() ||
        (item.executorType === "agent-binding" ? "Agent Binding" : "Model API"),
      executorType: executorTypes.includes(item.executorType)
        ? item.executorType
        : "model-api",
      sortOrder: item.sortOrder ?? index,
      title: item.title.trim()
    };
  });

  assertNoDecompositionItemDependencyCycles(normalizedItems);

  return normalizedItems;
}

function assertNoDecompositionItemDependencyCycles(
  items: DecompositionResultItem[]
) {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(itemId: string, path: string[]) {
    if (visiting.has(itemId)) {
      throw new Error(
        `Decomposition item dependency cycle detected: ${[...path, itemId].join(" -> ")}`
      );
    }

    if (visited.has(itemId)) {
      return;
    }

    const item = itemsById.get(itemId);

    if (!item) {
      return;
    }

    visiting.add(itemId);

    for (const dependency of item.dependsOn) {
      visit(dependency, [...path, itemId]);
    }

    visiting.delete(itemId);
    visited.add(itemId);
  }

  for (const item of items) {
    visit(item.id, []);
  }
}

function createDecompositionResultRepository(
  sqlite: Database.Database
): DecompositionResultRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db, sqlite);

  return {
    async deleteDecompositionResultForRequirement(requirementId) {
      await db
        .delete(decompositionResults)
        .where(eq(decompositionResults.requirementId, requirementId))
        .run();
    },

    async getDecompositionResult(id) {
      const row = await db
        .select()
        .from(decompositionResults)
        .where(eq(decompositionResults.id, id))
        .get();

      return row ? toDecompositionResult(row) : null;
    },

    async getDecompositionResultForRequirement(requirementId) {
      const row = await db
        .select()
        .from(decompositionResults)
        .where(eq(decompositionResults.requirementId, requirementId))
        .get();

      return row ? toDecompositionResult(row) : null;
    },

    async saveDecompositionResult(input) {
      const existing = await db
        .select()
        .from(decompositionResults)
        .where(eq(decompositionResults.requirementId, input.requirementId))
        .get();

      if (existing) {
        return this.updateDecompositionResult({
          id: existing.id,
          items: input.items,
          summary: input.summary
        });
      }

      const now = new Date().toISOString();
      const result: DecompositionResult = {
        id: `dcr_${randomUUID()}`,
        projectId: input.projectId?.trim() || null,
        requirementId: input.requirementId,
        summary: input.summary.trim(),
        items: normalizeDecompositionItems(input.items),
        createdAt: now,
        updatedAt: now
      };

      await db
        .insert(decompositionResults)
        .values({
          ...result,
          items: JSON.stringify(result.items)
        })
        .run();

      return result;
    },

    async updateDecompositionResult(input) {
      const row = await db
        .select()
        .from(decompositionResults)
        .where(eq(decompositionResults.id, input.id))
        .get();

      if (!row) {
        throw new Error(`Decomposition result not found: ${input.id}`);
      }

      const updated: DecompositionResult = {
        ...toDecompositionResult(row),
        summary: input.summary.trim(),
        items: normalizeDecompositionItems(input.items),
        updatedAt: nextTimestamp(row.updatedAt)
      };

      await db
        .update(decompositionResults)
        .set({
          items: JSON.stringify(updated.items),
          summary: updated.summary,
          updatedAt: updated.updatedAt
        })
        .where(eq(decompositionResults.id, input.id))
        .run();

      return updated;
    }
  };
}

function createTaskRepository(sqlite: Database.Database): TaskRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db, sqlite);

  return {
    async createTasksFromDecompositionResult(input) {
      const now = new Date().toISOString();
      const normalizedItems = normalizeDecompositionItems(input.items);
      const taskIdsByItemId = new Map(
        normalizedItems.map((item) => [item.id, `tsk_${randomUUID()}`])
      );
      const createdTasks = normalizedItems.map((item) => ({
        id: taskIdsByItemId.get(item.id)!,
        projectId: input.projectId,
        requirementId: input.requirementId,
        sourceItemId: item.id,
        title: item.title,
        body: item.body,
        dependsOn: item.dependsOn.map((dependency) => taskIdsByItemId.get(dependency)!),
        executorAgentBindingId: item.executorAgentBindingId,
        executorLabel: item.executorLabel,
        executorType: item.executorType,
        status: "init" as const,
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      }));

      if (createdTasks.length > 0) {
        await db
          .insert(tasks)
          .values(
            createdTasks.map((task) => ({
              ...task,
              dependsOn: JSON.stringify(task.dependsOn)
            }))
          )
          .run();
      }

      return createdTasks;
    },

    async deleteTasksForRequirement(requirementId) {
      const deletedAt = new Date().toISOString();

      await db
        .update(tasks)
        .set({
          deletedAt,
          updatedAt: deletedAt
        })
        .where(and(eq(tasks.requirementId, requirementId), isNull(tasks.deletedAt)))
        .run();
    },

    async getTask(id) {
      const row = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
        .get();

      return row ? toTask(row) : null;
    },

    async listTasks() {
      const rows = await db
        .select()
        .from(tasks)
        .where(isNull(tasks.deletedAt))
        .orderBy(asc(tasks.createdAt));

      return rows.map(toTask);
    },

    async updateTaskStatus(input) {
      const updatedAt = new Date().toISOString();

      const row = await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, input.id), isNull(tasks.deletedAt)))
        .get();

      if (!row) {
        throw new Error(`Task not found: ${input.id}`);
      }

      const updated = {
        ...row,
        status: input.status,
        updatedAt
      };

      await db
        .update(tasks)
        .set({
          status: input.status,
          updatedAt
        })
        .where(eq(tasks.id, input.id))
        .run();

      return toTask(updated);
    }
  };
}

function createWorkflowRunRepository(
  sqlite: Database.Database
): WorkflowRunRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db, sqlite);

  return {
    async createWorkflowRun(input) {
      const now = new Date().toISOString();
      const workflowRun: WorkflowRun = {
        id: `wfr_${randomUUID()}`,
        taskId: input.taskId,
        workflowFileId: input.workflowFileId,
        executorAssignments: input.executorAssignments ?? {},
        correctionFeedback: input.correctionFeedback?.trim() || null,
        status: "running",
        createdAt: now,
        updatedAt: now
      };

      await db
        .insert(workflowRuns)
        .values({
          ...workflowRun,
          executorAssignments: JSON.stringify(workflowRun.executorAssignments)
        })
        .run();

      return workflowRun;
    },

    async createNodeRun(input) {
      const now = new Date().toISOString();
      const nodeRun: NodeRun = {
        id: `ndr_${randomUUID()}`,
        workflowRunId: input.workflowRunId,
        nodeId: input.nodeId,
        dependsOn: input.dependsOn,
        attempt: 1,
        attempts: [],
        exitReview: null,
        retryCount: 0,
        status: input.status,
        sortOrder: input.sortOrder,
        output: null,
        errorMessage: null,
        createdAt: now,
        updatedAt: now
      };

      await db
        .insert(nodeRuns)
        .values({
          ...nodeRun,
          attempts: JSON.stringify(nodeRun.attempts),
          dependsOn: JSON.stringify(nodeRun.dependsOn),
          exitReview: null
        })
        .run();

      return nodeRun;
    },

    async listWorkflowRuns(taskId) {
      const query = db.select().from(workflowRuns);
      const rows = taskId
        ? await query.where(eq(workflowRuns.taskId, taskId)).orderBy(asc(workflowRuns.createdAt))
        : await query.orderBy(asc(workflowRuns.createdAt));

      return rows.map(toWorkflowRun);
    },

    async listNodeRuns(workflowRunId) {
      const rows = await db
        .select()
        .from(nodeRuns)
        .where(eq(nodeRuns.workflowRunId, workflowRunId))
        .orderBy(asc(nodeRuns.sortOrder));

      return rows.map(toNodeRun);
    },

    async updateWorkflowRunStatus(input) {
      const row = await db
        .select()
        .from(workflowRuns)
        .where(eq(workflowRuns.id, input.id))
        .get();

      if (!row) {
        throw new Error(`Workflow run not found: ${input.id}`);
      }

      const updated = {
        ...row,
        status: input.status,
        updatedAt: nextTimestamp(row.updatedAt)
      };

      await db
        .update(workflowRuns)
        .set({
          status: updated.status,
          updatedAt: updated.updatedAt
        })
        .where(eq(workflowRuns.id, input.id))
        .run();

      return toWorkflowRun(updated);
    },

    async updateNodeRunStatus(input) {
      const row = await db
        .select()
        .from(nodeRuns)
        .where(eq(nodeRuns.id, input.id))
        .get();

      if (!row) {
        throw new Error(`Node run not found: ${input.id}`);
      }

      const updated = {
        ...row,
        attempt: input.attempt === undefined ? row.attempt : input.attempt,
        attempts:
          input.attempts === undefined ? row.attempts : JSON.stringify(input.attempts),
        exitReview:
          input.exitReview === undefined
            ? row.exitReview
            : input.exitReview
              ? JSON.stringify(input.exitReview)
              : null,
        retryCount:
          input.retryCount === undefined ? row.retryCount : input.retryCount,
        status: input.status,
        output: input.output === undefined ? row.output : input.output,
        errorMessage:
          input.errorMessage === undefined ? row.errorMessage : input.errorMessage,
        updatedAt: nextTimestamp(row.updatedAt)
      };

      await db
        .update(nodeRuns)
        .set({
          attempt: updated.attempt,
          attempts: updated.attempts,
          errorMessage: updated.errorMessage,
          exitReview: updated.exitReview,
          output: updated.output,
          retryCount: updated.retryCount,
          status: updated.status,
          updatedAt: updated.updatedAt
        })
        .where(eq(nodeRuns.id, input.id))
        .run();

      return toNodeRun(updated);
    }
  };
}

function createBridgeRepository(sqlite: Database.Database): BridgeRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db, sqlite);

  return {
    async claimNextBridgeJob(
      bridgeId,
      eligibleNodeRunIds,
      eligibleAgentNames
    ) {
      const rows = await db
        .select()
        .from(bridgeJobs)
        .where(eq(bridgeJobs.status, "queued"))
        .orderBy(asc(bridgeJobs.createdAt))
        .all();
      const eligibleNodeRunIdSet = eligibleNodeRunIds
        ? new Set(eligibleNodeRunIds)
        : null;
      const eligibleAgentNameSet = eligibleAgentNames
        ? new Set(eligibleAgentNames)
        : null;
      const row = rows.find(
        (job) =>
          (!eligibleAgentNameSet || eligibleAgentNameSet.has(job.agentName)) &&
          (!eligibleNodeRunIdSet ||
            job.nodeRunId.startsWith("requirement:") ||
            eligibleNodeRunIdSet.has(job.nodeRunId))
      );

      if (!row) {
        return null;
      }

      const updatedAt = nextTimestamp(row.updatedAt);

      const result = await db
        .update(bridgeJobs)
        .set({
          bridgeId,
          status: "claimed",
          updatedAt
        })
        .where(
          and(eq(bridgeJobs.id, row.id), eq(bridgeJobs.status, "queued"))
        )
        .run();

      if (result.changes === 0) {
        return null;
      }

      return toBridgeJob({
        ...row,
        bridgeId,
        status: "claimed",
        updatedAt
      });
    },

    async completeBridgeJob(input) {
      const row = await db
        .select()
        .from(bridgeJobs)
        .where(eq(bridgeJobs.id, input.id))
        .get();

      if (!row) {
        throw new Error(`Bridge job not found: ${input.id}`);
      }

      if (row.bridgeId !== input.bridgeId || row.status !== "claimed") {
        throw new Error(
          `Bridge job ${input.id} is not claimed by bridge ${input.bridgeId}`
        );
      }

      const updatedAt = nextTimestamp(row.updatedAt);
      const updated = {
        ...row,
        errorMessage: input.errorMessage ?? null,
        output: input.output ?? null,
        status: input.status,
        updatedAt
      };

      await db
        .update(bridgeJobs)
        .set({
          errorMessage: updated.errorMessage,
          output: updated.output,
          status: updated.status,
          updatedAt
        })
        .where(
          and(
            eq(bridgeJobs.id, input.id),
            eq(bridgeJobs.bridgeId, input.bridgeId),
            eq(bridgeJobs.status, "claimed")
          )
        )
        .run();

      return toBridgeJob(updated);
    },

    async createBridgeJob(input) {
      const now = new Date().toISOString();
      const job = {
        agentName: input.agentName,
        bridgeId: null,
        createdAt: now,
        errorMessage: null,
        id: `brj_${randomUUID()}`,
        nodeRunId: input.nodeRunId,
        output: null,
        payload: JSON.stringify(input.payload),
        status: "queued",
        updatedAt: now,
        workflowRunId: input.workflowRunId
      };

      await db.insert(bridgeJobs).values(job).run();

      return toBridgeJob(job);
    },

    async hasOnlineAgentBindings() {
      const rows = await db
        .select()
        .from(agentBindings)
        .where(eq(agentBindings.status, "online"))
        .all();

      const now = Date.now();

      return rows.some((row) => isFreshAgentBinding(row.lastSeenAt, now));
    },

    async listAgentBindings() {
      const rows = await db
        .select()
        .from(agentBindings)
        .orderBy(asc(agentBindings.name));
      const now = Date.now();

      return rows.map((row) => toAgentBinding(row, now));
    },

    async upsertAgentBinding(input) {
      const now = new Date().toISOString();
      const existing = await db
        .select()
        .from(agentBindings)
        .where(eq(agentBindings.name, input.name))
        .get();

      if (existing) {
        const updatedAt = nextTimestamp(existing.updatedAt);
        const updated = {
          ...existing,
          capabilities: JSON.stringify(input.capabilities ?? []),
          command: input.command.trim(),
          connector: input.connector,
          errorMessage: input.errorMessage ?? null,
          lastSeenAt: now,
          status: input.status ?? "online",
          updatedAt
        };

        await db
          .update(agentBindings)
          .set({
            capabilities: updated.capabilities,
            command: updated.command,
            connector: updated.connector,
            errorMessage: updated.errorMessage,
            lastSeenAt: updated.lastSeenAt,
            status: updated.status,
            updatedAt: updated.updatedAt
          })
          .where(eq(agentBindings.id, existing.id))
          .run();

        return toAgentBinding(updated);
      }

      const agent = {
        capabilities: JSON.stringify(input.capabilities ?? []),
        command: input.command.trim(),
        connector: input.connector,
        createdAt: now,
        errorMessage: input.errorMessage ?? null,
        id: `agb_${randomUUID()}`,
        lastSeenAt: now,
        name: input.name.trim(),
        status: input.status ?? "online",
        updatedAt: now
      };

      await db.insert(agentBindings).values(agent).run();

      return toAgentBinding(agent);
    }
  };
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    artifactStorageMode: row.artifactStorageMode as ArtifactStorageMode,
    dbStrategy: row.dbStrategy as DbStrategy,
    defaultExecutorAgentBindingId: row.defaultExecutorAgentBindingId,
    defaultExecutorType: row.defaultExecutorType as ExecutorType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toWorkflowFileMetadata(row: WorkflowFileRow): WorkflowFileMetadata {
  return {
    id: row.id,
    name: row.name,
    nodeCount: row.nodeCount,
    definition: row.definition,
    templateType: row.templateType as WorkflowFileMetadata["templateType"],
    createdAt: row.createdAt
  };
}

function toSkill(row: SkillRow): Skill {
  return {
    body: row.body,
    createdAt: row.createdAt,
    description: row.description,
    files: parseJsonArray(row.files).map((file) => ({
      content: typeof file.content === "string" ? file.content : "",
      path: typeof file.path === "string" ? file.path : "SKILL.md"
    })),
    id: row.id,
    name: row.name,
    projectId: row.projectId,
    ref: row.ref,
    sourceUrl: row.sourceUrl,
    storagePath: row.storagePath,
    updatedAt: row.updatedAt
  };
}

function parseJsonArray(value: string): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseStringList(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function toExecutionSettings(row: ExecutionSettingsRow): ExecutionSettings {
  return {
    agentProxyUrl: row.agentProxyUrl,
    createdAt: row.createdAt,
    defaultExecutorAgentBindingId: row.defaultExecutorAgentBindingId,
    defaultExecutorType: row.defaultExecutorType as ExecutorType,
    id: "default",
    modelApiKey: row.modelApiKey,
    modelBaseUrl: row.modelBaseUrl,
    modelName: row.modelName,
    modelProvider: row.modelProvider as ModelProviderKind,
    updatedAt: row.updatedAt
  };
}

function toRequirement(row: RequirementRow): Requirement {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    body: row.body,
    workflowFileId: row.workflowFileId,
    status: row.status as RequirementStatus,
    errorMessage: row.errorMessage,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toDecompositionResult(
  row: DecompositionResultRow
): DecompositionResult {
  return {
    id: row.id,
    projectId: row.projectId,
    requirementId: row.requirementId,
    summary: row.summary,
    items: normalizeDecompositionItems(JSON.parse(row.items) as DecompositionResultItem[]),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    requirementId: row.requirementId,
    title: row.title,
    body: row.body,
    dependsOn: parseStringList(row.dependsOn),
    executorAgentBindingId: row.executorAgentBindingId,
    executorLabel: row.executorLabel,
    executorType: row.executorType as ExecutorType,
    sourceItemId: row.sourceItemId || row.id,
    status: row.status as TaskStatus,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toWorkflowRun(row: WorkflowRunRow): WorkflowRun {
  return {
    id: row.id,
    taskId: row.taskId,
    workflowFileId: row.workflowFileId,
    executorAssignments: JSON.parse(row.executorAssignments || "{}") as Record<
      string,
      unknown
    >,
    correctionFeedback: row.correctionFeedback,
    status: row.status as WorkflowRunStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toNodeRun(row: NodeRunRow): NodeRun {
  return {
    id: row.id,
    workflowRunId: row.workflowRunId,
    nodeId: row.nodeId,
    dependsOn: JSON.parse(row.dependsOn) as string[],
    attempt: row.attempt,
    attempts: parseNodeRunAttempts(row.attempts),
    errorMessage: row.errorMessage,
    exitReview: parseExitReviewResult(row.exitReview),
    retryCount: row.retryCount,
    status: row.status as NodeRunStatus,
    output: row.output,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function parseNodeRunAttempts(value: string): NodeRunAttempt[] {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed) ? (parsed as NodeRunAttempt[]) : [];
  } catch {
    return [];
  }
}

function parseExitReviewResult(value: string | null): ExitReviewResult | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as ExitReviewResult;
  } catch {
    return null;
  }
}

function toAgentBinding(row: AgentBindingRow, now = Date.now()): AgentBinding {
  const status =
    row.status === "online" && !isFreshAgentBinding(row.lastSeenAt, now)
      ? "offline"
      : row.status;

  return {
    capabilities: JSON.parse(row.capabilities) as string[],
    command: row.command,
    connector: row.connector as AgentConnectorType,
    createdAt: row.createdAt,
    errorMessage: row.errorMessage,
    id: row.id,
    lastSeenAt: row.lastSeenAt,
    name: row.name,
    status: status as AgentBindingStatus,
    updatedAt: row.updatedAt
  };
}

function isFreshAgentBinding(lastSeenAt: string | null, now = Date.now()) {
  if (!lastSeenAt) {
    return false;
  }

  const lastSeenTime = Date.parse(lastSeenAt);

  return (
    Number.isFinite(lastSeenTime) &&
    lastSeenTime >= now - agentBindingOnlineTtlMs
  );
}

function toBridgeJob(row: BridgeJobRow): BridgeJob {
  return {
    agentName: row.agentName,
    bridgeId: row.bridgeId,
    createdAt: row.createdAt,
    errorMessage: row.errorMessage,
    id: row.id,
    nodeRunId: row.nodeRunId,
    output: row.output,
    payload: JSON.parse(row.payload) as unknown,
    status: row.status as BridgeJobStatus,
    updatedAt: row.updatedAt,
    workflowRunId: row.workflowRunId
  };
}

function nextTimestamp(previous: string) {
  const now = new Date();
  const previousDate = new Date(previous);

  if (now <= previousDate) {
    return new Date(previousDate.getTime() + 1).toISOString();
  }

  return now.toISOString();
}
