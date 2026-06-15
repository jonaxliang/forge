import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { and, asc, eq, isNull } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const artifactStorageModes = ["local-only", "cloud"] as const;
export const dbStrategies = ["sqlite", "postgres", "mysql"] as const;
export const workflowScopes = ["requirement", "task"] as const;
export const requirementStatuses = [
  "init",
  "decomposing",
  "decomposition_failed",
  "ready_to_generate_tasks",
  "tasks_generated",
  "completed"
] as const;
export const taskStatuses = [
  "init",
  "running",
  "failed",
  "pending_acceptance",
  "completed",
  "cancelled"
] as const;
export const workflowRunStatuses = ["running", "succeeded", "failed"] as const;
export const agentConnectorTypes = ["cli", "mcp"] as const;
export const agentBindingStatuses = ["online", "offline", "error"] as const;
export const bridgeJobStatuses = [
  "queued",
  "claimed",
  "succeeded",
  "failed"
] as const;
export const modelProviderKinds = [
  "openai-compatible",
  "openai",
  "anthropic",
  "google",
  "mistral",
  "groq",
  "deepseek",
  "openrouter",
  "ollama",
  "lmstudio"
] as const;
export const nodeRunStatuses = [
  "idle",
  "queued",
  "running",
  "waiting",
  "blocked",
  "reviewing",
  "failed",
  "succeeded",
  "skipped"
] as const;

export type ArtifactStorageMode = (typeof artifactStorageModes)[number];
export type DbStrategy = (typeof dbStrategies)[number];
export type WorkflowScope = (typeof workflowScopes)[number];
export type RequirementStatus = (typeof requirementStatuses)[number];
export type TaskStatus = (typeof taskStatuses)[number];
export type WorkflowRunStatus = (typeof workflowRunStatuses)[number];
export type NodeRunStatus = (typeof nodeRunStatuses)[number];
export type AgentConnectorType = (typeof agentConnectorTypes)[number];
export type AgentBindingStatus = (typeof agentBindingStatuses)[number];
export type BridgeJobStatus = (typeof bridgeJobStatuses)[number];
export type ModelProviderKind = (typeof modelProviderKinds)[number];

export const modelProviderDefaults: Record<
  ModelProviderKind,
  {
    baseUrl: string;
    modelName: string;
    requiresApiKey: boolean;
  }
> = {
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    modelName: "claude-sonnet-4-20250514",
    requiresApiKey: true
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    modelName: "deepseek-chat",
    requiresApiKey: true
  },
  google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelName: "gemini-2.5-flash",
    requiresApiKey: true
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    modelName: "llama-3.3-70b-versatile",
    requiresApiKey: true
  },
  lmstudio: {
    baseUrl: "http://localhost:1234/v1",
    modelName: "local-model",
    requiresApiKey: false
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1",
    modelName: "mistral-large-latest",
    requiresApiKey: true
  },
  ollama: {
    baseUrl: "http://127.0.0.1:11434/v1",
    modelName: "llama3.1",
    requiresApiKey: false
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    modelName: "gpt-4.1-mini",
    requiresApiKey: true
  },
  "openai-compatible": {
    baseUrl: "https://api.openai.com/v1",
    modelName: "gpt-4.1-mini",
    requiresApiKey: true
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    modelName: "openai/gpt-4.1-mini",
    requiresApiKey: true
  }
};

export type DatabaseStatus = {
  configured: boolean;
  dialect: DbStrategy | "unconfigured";
};

export type Project = {
  id: string;
  name: string;
  artifactStorageMode: ArtifactStorageMode;
  dbStrategy: DbStrategy;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  name: string;
  artifactStorageMode?: ArtifactStorageMode;
  dbStrategy?: DbStrategy;
};

export type UpdateProjectInput = {
  id: string;
  name: string;
};

export type ProjectRepository = {
  createProject(input: CreateProjectInput): Promise<Project>;
  listProjects(): Promise<Project[]>;
  updateProject(input: UpdateProjectInput): Promise<Project>;
};

export type WorkflowFileMetadata = {
  id: string;
  name: string;
  scope: WorkflowScope;
  nodeCount: number;
  definition: string;
  templateType: "builtin" | "custom";
  createdAt: string;
};

export type CreateWorkflowFileMetadataInput = {
  name: string;
  scope: WorkflowScope;
  nodeCount: number;
  definition?: string;
  templateType?: "builtin" | "custom";
};

export type UpdateWorkflowFileMetadataInput = {
  id: string;
  name: string;
};

export type WorkflowFileRepository = {
  createWorkflowFileMetadata(
    input: CreateWorkflowFileMetadataInput
  ): Promise<WorkflowFileMetadata>;
  deleteWorkflowFileMetadata(id: string): Promise<void>;
  getWorkflowFileMetadata(id: string): Promise<WorkflowFileMetadata | null>;
  listWorkflowFileMetadata(): Promise<WorkflowFileMetadata[]>;
  updateWorkflowFileMetadata(
    input: UpdateWorkflowFileMetadataInput
  ): Promise<WorkflowFileMetadata>;
};

export type ExecutionSettings = {
  id: "default";
  modelProvider: ModelProviderKind;
  modelBaseUrl: string;
  modelName: string;
  modelApiKey: string;
  agentProxyUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type UpdateExecutionSettingsInput = Partial<
  Pick<
    ExecutionSettings,
    "agentProxyUrl" | "modelApiKey" | "modelBaseUrl" | "modelName" | "modelProvider"
  >
>;

export type ExecutionSettingsRepository = {
  getExecutionSettings(): Promise<ExecutionSettings>;
  updateExecutionSettings(
    input: UpdateExecutionSettingsInput
  ): Promise<ExecutionSettings>;
};

export type Requirement = {
  id: string;
  projectId: string | null;
  title: string;
  body: string;
  workflowFileId: string;
  status: RequirementStatus;
  errorMessage: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateRequirementInput = {
  projectId?: string | null;
  title: string;
  body: string;
  workflowFileId: string;
};

export type UpdateRequirementStatusInput = {
  id: string;
  status: RequirementStatus;
  errorMessage?: string | null;
};

export type UpdateRequirementInput = {
  id: string;
  title: string;
};

export type RequirementRepository = {
  createRequirement(input: CreateRequirementInput): Promise<Requirement>;
  deleteRequirement(id: string): Promise<void>;
  listRequirements(): Promise<Requirement[]>;
  updateRequirement(input: UpdateRequirementInput): Promise<Requirement>;
  updateRequirementStatus(
    input: UpdateRequirementStatusInput
  ): Promise<Requirement>;
};

export type DecompositionResultItem = {
  title: string;
  body: string;
  sortOrder: number;
};

export type DecompositionResult = {
  id: string;
  projectId: string | null;
  requirementId: string;
  summary: string;
  items: DecompositionResultItem[];
  createdAt: string;
  updatedAt: string;
};

export type SaveDecompositionResultInput = {
  projectId?: string | null;
  requirementId: string;
  summary: string;
  items: DecompositionResultItem[];
};

export type UpdateDecompositionResultInput = {
  id: string;
  summary: string;
  items: DecompositionResultItem[];
};

export type DecompositionResultRepository = {
  getDecompositionResult(id: string): Promise<DecompositionResult | null>;
  getDecompositionResultForRequirement(
    requirementId: string
  ): Promise<DecompositionResult | null>;
  saveDecompositionResult(
    input: SaveDecompositionResultInput
  ): Promise<DecompositionResult>;
  updateDecompositionResult(
    input: UpdateDecompositionResultInput
  ): Promise<DecompositionResult>;
};

export type CreateTasksFromDecompositionResultInput = Pick<
  DecompositionResult,
  "items" | "projectId" | "requirementId"
>;

export type Task = {
  id: string;
  projectId: string | null;
  requirementId: string;
  title: string;
  body: string;
  status: TaskStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskRepository = {
  createTasksFromDecompositionResult(
    input: CreateTasksFromDecompositionResultInput
  ): Promise<Task[]>;
  deleteTasksForRequirement(requirementId: string): Promise<void>;
  getTask(id: string): Promise<Task | null>;
  listTasks(): Promise<Task[]>;
};

export type WorkflowRun = {
  id: string;
  taskId: string;
  workflowFileId: string;
  status: WorkflowRunStatus;
  createdAt: string;
  updatedAt: string;
};

export type NodeRun = {
  id: string;
  workflowRunId: string;
  nodeId: string;
  dependsOn: string[];
  status: NodeRunStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateWorkflowRunInput = {
  taskId: string;
  workflowFileId: string;
};

export type CreateNodeRunInput = {
  workflowRunId: string;
  nodeId: string;
  dependsOn: string[];
  status: NodeRunStatus;
  sortOrder: number;
};

export type UpdateWorkflowRunStatusInput = {
  id: string;
  status: WorkflowRunStatus;
};

export type UpdateNodeRunStatusInput = {
  id: string;
  status: NodeRunStatus;
};

export type WorkflowRunRepository = {
  createWorkflowRun(input: CreateWorkflowRunInput): Promise<WorkflowRun>;
  createNodeRun(input: CreateNodeRunInput): Promise<NodeRun>;
  listWorkflowRuns(taskId?: string): Promise<WorkflowRun[]>;
  listNodeRuns(workflowRunId: string): Promise<NodeRun[]>;
  updateWorkflowRunStatus(
    input: UpdateWorkflowRunStatusInput
  ): Promise<WorkflowRun>;
  updateNodeRunStatus(input: UpdateNodeRunStatusInput): Promise<NodeRun>;
};

export type AgentBinding = {
  id: string;
  name: string;
  connector: AgentConnectorType;
  command: string;
  capabilities: string[];
  status: AgentBindingStatus;
  lastSeenAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertAgentBindingInput = {
  name: string;
  connector: AgentConnectorType;
  command: string;
  capabilities?: string[];
  status?: AgentBindingStatus;
  errorMessage?: string | null;
};

export type BridgeJob = {
  id: string;
  workflowRunId: string;
  nodeRunId: string;
  agentName: string;
  bridgeId: string | null;
  status: BridgeJobStatus;
  payload: unknown;
  output: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateBridgeJobInput = {
  workflowRunId: string;
  nodeRunId: string;
  agentName: string;
  payload: unknown;
};

export type CompleteBridgeJobInput = {
  id: string;
  status: Extract<BridgeJobStatus, "succeeded" | "failed">;
  output?: string | null;
  errorMessage?: string | null;
};

export type BridgeRepository = {
  claimNextBridgeJob(bridgeId: string): Promise<BridgeJob | null>;
  completeBridgeJob(input: CompleteBridgeJobInput): Promise<BridgeJob>;
  createBridgeJob(input: CreateBridgeJobInput): Promise<BridgeJob>;
  listAgentBindings(): Promise<AgentBinding[]>;
  hasOnlineAgentBindings(): Promise<boolean>;
  upsertAgentBinding(input: UpsertAgentBindingInput): Promise<AgentBinding>;
};

const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  artifactStorageMode: text("artifact_storage_mode").notNull(),
  dbStrategy: text("db_strategy").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type ProjectRow = typeof projects.$inferSelect;

const workflowFiles = sqliteTable("workflow_files", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  scope: text("scope").notNull(),
  nodeCount: integer("node_count").notNull(),
  definition: text("definition").notNull(),
  templateType: text("template_type").notNull(),
  createdAt: text("created_at").notNull()
});

type WorkflowFileRow = typeof workflowFiles.$inferSelect;

const executionSettings = sqliteTable("execution_settings", {
  id: text("id").primaryKey(),
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
  title: text("title").notNull(),
  body: text("body").notNull(),
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
  status: text("status").notNull(),
  sortOrder: integer("sort_order").notNull(),
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
  mkdirSync(dirname(filename), { recursive: true });
  return createProjectRepository(new Database(filename));
}

export function createSqliteWorkflowFileRepository(
  filename = ".forge/forge.sqlite"
): WorkflowFileRepository {
  mkdirSync(dirname(filename), { recursive: true });
  return createWorkflowFileRepository(new Database(filename));
}

export function createSqliteExecutionSettingsRepository(
  filename = ".forge/forge.sqlite"
): ExecutionSettingsRepository {
  mkdirSync(dirname(filename), { recursive: true });
  return createExecutionSettingsRepository(new Database(filename));
}

export function createSqliteRequirementRepository(
  filename = ".forge/forge.sqlite"
): RequirementRepository {
  mkdirSync(dirname(filename), { recursive: true });
  return createRequirementRepository(new Database(filename));
}

export function createSqliteDecompositionResultRepository(
  filename = ".forge/forge.sqlite"
): DecompositionResultRepository {
  mkdirSync(dirname(filename), { recursive: true });
  return createDecompositionResultRepository(new Database(filename));
}

export function createSqliteTaskRepository(
  filename = ".forge/forge.sqlite"
): TaskRepository {
  mkdirSync(dirname(filename), { recursive: true });
  return createTaskRepository(new Database(filename));
}

export function createSqliteWorkflowRunRepository(
  filename = ".forge/forge.sqlite"
): WorkflowRunRepository {
  mkdirSync(dirname(filename), { recursive: true });
  return createWorkflowRunRepository(new Database(filename));
}

export function createSqliteBridgeRepository(
  filename = ".forge/forge.sqlite"
): BridgeRepository {
  mkdirSync(dirname(filename), { recursive: true });
  return createBridgeRepository(new Database(filename));
}

function createProjectRepository(sqlite: Database.Database): ProjectRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db);

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
      const name = input.name.trim();

      if (!name) {
        throw new Error("Project name is required");
      }

      const current = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.id))
        .get();

      if (!current) {
        throw new Error(`Project not found: ${input.id}`);
      }

      const existing = await db
        .select()
        .from(projects)
        .where(eq(projects.name, name))
        .get();

      if (existing && existing.id !== input.id) {
        throw new Error(`Project already exists: ${name}`);
      }

      const updatedAt = createNextTimestamp(current.updatedAt);

      await db
        .update(projects)
        .set({
          name,
          updatedAt
        })
        .where(eq(projects.id, input.id))
        .run();

      return {
        ...toProject(current),
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

function initializeSqliteSchema(db: BetterSQLite3Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      artifact_storage_mode TEXT NOT NULL,
      db_strategy TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_files (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      scope TEXT NOT NULL,
      node_count INTEGER NOT NULL,
      definition TEXT NOT NULL DEFAULT '{}',
      template_type TEXT NOT NULL DEFAULT 'custom',
      created_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS execution_settings (
      id TEXT PRIMARY KEY NOT NULL,
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
      title TEXT NOT NULL,
      body TEXT NOT NULL,
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
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS node_runs (
      id TEXT PRIMARY KEY NOT NULL,
      workflow_run_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      depends_on TEXT NOT NULL,
      status TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
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
  ensureSqliteColumn(db, "workflow_files", "template_type", "TEXT NOT NULL DEFAULT 'custom'");
  ensureSqliteColumn(db, "requirements", "project_id", "TEXT");
  ensureSqliteColumn(db, "tasks", "project_id", "TEXT");
  ensureSqliteColumn(db, "requirements", "deleted_at", "TEXT");
  ensureSqliteColumn(db, "tasks", "deleted_at", "TEXT");
  db.run("UPDATE requirements SET status = 'open' WHERE status = 'completed'");
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
  initializeSqliteSchema(db);

  return {
    async createWorkflowFileMetadata(input) {
      const workflowFile: WorkflowFileMetadata = {
        id: `wff_${randomUUID()}`,
        name: input.name.trim(),
        scope: input.scope,
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

      const definition = updateWorkflowDefinitionName(row.definition, name);
      const updated = {
        ...row,
        definition,
        name
      };

      await db
        .update(workflowFiles)
        .set({
          definition,
          name
        })
        .where(eq(workflowFiles.id, input.id))
        .run();

      return toWorkflowFileMetadata(updated);
    }
  };
}

function createExecutionSettingsRepository(
  sqlite: Database.Database
): ExecutionSettingsRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db);

  return {
    async getExecutionSettings() {
      return ensureExecutionSettings(db);
    },

    async updateExecutionSettings(input) {
      const current = await ensureExecutionSettings(db);
      const updatedAt = nextTimestamp(current.updatedAt);
      const nextModelApiKey = input.modelApiKey?.trim();
      const modelProvider = input.modelProvider ?? current.modelProvider;
      const providerChanged =
        input.modelProvider !== undefined && input.modelProvider !== current.modelProvider;
      const providerDefaults = modelProviderDefaults[modelProvider];
      const updated: ExecutionSettings = {
        ...current,
        agentProxyUrl: input.agentProxyUrl?.trim() ?? current.agentProxyUrl,
        modelApiKey: nextModelApiKey ? nextModelApiKey : current.modelApiKey,
        modelBaseUrl:
          input.modelBaseUrl?.trim() ??
          (providerChanged ? providerDefaults.baseUrl : current.modelBaseUrl),
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
  initializeSqliteSchema(db);

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

      if (!title) {
        throw new Error("Requirement title is required");
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
          title,
          updatedAt
        })
        .where(eq(requirements.id, input.id))
        .run();

      return toRequirement({
        ...row,
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

function normalizeDecompositionItems(items: DecompositionResultItem[]) {
  return items.map((item, index) => ({
    body: item.body.trim(),
    sortOrder: item.sortOrder ?? index,
    title: item.title.trim()
  }));
}

function createDecompositionResultRepository(
  sqlite: Database.Database
): DecompositionResultRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db);

  return {
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
  initializeSqliteSchema(db);

  return {
    async createTasksFromDecompositionResult(input) {
      const now = new Date().toISOString();
      const createdTasks = normalizeDecompositionItems(input.items).map((item) => ({
        id: `tsk_${randomUUID()}`,
        projectId: input.projectId,
        requirementId: input.requirementId,
        title: item.title,
        body: item.body,
        status: "init" as const,
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      }));

      if (createdTasks.length > 0) {
        await db.insert(tasks).values(createdTasks).run();
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
    }
  };
}

function createWorkflowRunRepository(
  sqlite: Database.Database
): WorkflowRunRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db);

  return {
    async createWorkflowRun(input) {
      const now = new Date().toISOString();
      const workflowRun: WorkflowRun = {
        id: `wfr_${randomUUID()}`,
        taskId: input.taskId,
        workflowFileId: input.workflowFileId,
        status: "running",
        createdAt: now,
        updatedAt: now
      };

      await db.insert(workflowRuns).values(workflowRun).run();

      return workflowRun;
    },

    async createNodeRun(input) {
      const now = new Date().toISOString();
      const nodeRun: NodeRun = {
        id: `ndr_${randomUUID()}`,
        workflowRunId: input.workflowRunId,
        nodeId: input.nodeId,
        dependsOn: input.dependsOn,
        status: input.status,
        sortOrder: input.sortOrder,
        createdAt: now,
        updatedAt: now
      };

      await db
        .insert(nodeRuns)
        .values({
          ...nodeRun,
          dependsOn: JSON.stringify(nodeRun.dependsOn)
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
        status: input.status,
        updatedAt: nextTimestamp(row.updatedAt)
      };

      await db
        .update(nodeRuns)
        .set({
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
  initializeSqliteSchema(db);

  return {
    async claimNextBridgeJob(bridgeId) {
      const row = await db
        .select()
        .from(bridgeJobs)
        .where(eq(bridgeJobs.status, "queued"))
        .orderBy(asc(bridgeJobs.createdAt))
        .get();

      if (!row) {
        return null;
      }

      const updatedAt = nextTimestamp(row.updatedAt);

      await db
        .update(bridgeJobs)
        .set({
          bridgeId,
          status: "claimed",
          updatedAt
        })
        .where(eq(bridgeJobs.id, row.id))
        .run();

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
        .where(eq(bridgeJobs.id, input.id))
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
      const row = await db
        .select()
        .from(agentBindings)
        .where(eq(agentBindings.status, "online"))
        .get();

      return Boolean(row);
    },

    async listAgentBindings() {
      const rows = await db
        .select()
        .from(agentBindings)
        .orderBy(asc(agentBindings.name));

      return rows.map(toAgentBinding);
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
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toWorkflowFileMetadata(row: WorkflowFileRow): WorkflowFileMetadata {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope as WorkflowScope,
    nodeCount: row.nodeCount,
    definition: row.definition,
    templateType: row.templateType as WorkflowFileMetadata["templateType"],
    createdAt: row.createdAt
  };
}

function toExecutionSettings(row: ExecutionSettingsRow): ExecutionSettings {
  return {
    agentProxyUrl: row.agentProxyUrl,
    createdAt: row.createdAt,
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
    items: JSON.parse(row.items) as DecompositionResultItem[],
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
    status: row.status as NodeRunStatus,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toAgentBinding(row: AgentBindingRow): AgentBinding {
  return {
    capabilities: JSON.parse(row.capabilities) as string[],
    command: row.command,
    connector: row.connector as AgentConnectorType,
    createdAt: row.createdAt,
    errorMessage: row.errorMessage,
    id: row.id,
    lastSeenAt: row.lastSeenAt,
    name: row.name,
    status: row.status as AgentBindingStatus,
    updatedAt: row.updatedAt
  };
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
