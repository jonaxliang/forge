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
export const requirementStatuses = ["open", "running", "completed", "failed"] as const;
export const taskDraftStatuses = ["draft"] as const;
export const taskStatuses = ["todo", "in_progress", "done"] as const;
export const workflowRunStatuses = ["running", "succeeded", "failed"] as const;
export const modelProviderKinds = ["openai-compatible"] as const;
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
export type TaskDraftStatus = (typeof taskDraftStatuses)[number];
export type TaskStatus = (typeof taskStatuses)[number];
export type WorkflowRunStatus = (typeof workflowRunStatuses)[number];
export type NodeRunStatus = (typeof nodeRunStatuses)[number];
export type ModelProviderKind = (typeof modelProviderKinds)[number];

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

export type ProjectRepository = {
  createProject(input: CreateProjectInput): Promise<Project>;
  listProjects(): Promise<Project[]>;
};

export type WorkflowFileMetadata = {
  id: string;
  name: string;
  scope: WorkflowScope;
  nodeCount: number;
  definition: string;
  createdAt: string;
};

export type CreateWorkflowFileMetadataInput = {
  name: string;
  scope: WorkflowScope;
  nodeCount: number;
  definition?: string;
};

export type WorkflowFileRepository = {
  createWorkflowFileMetadata(
    input: CreateWorkflowFileMetadataInput
  ): Promise<WorkflowFileMetadata>;
  getWorkflowFileMetadata(id: string): Promise<WorkflowFileMetadata | null>;
  listWorkflowFileMetadata(): Promise<WorkflowFileMetadata[]>;
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
  title: string;
  body: string;
  workflowFileId: string;
};

export type UpdateRequirementStatusInput = {
  id: string;
  status: RequirementStatus;
  errorMessage?: string | null;
};

export type RequirementRepository = {
  createRequirement(input: CreateRequirementInput): Promise<Requirement>;
  deleteRequirement(id: string): Promise<void>;
  listRequirements(): Promise<Requirement[]>;
  updateRequirementStatus(
    input: UpdateRequirementStatusInput
  ): Promise<Requirement>;
};

export type TaskDraft = {
  id: string;
  requirementId: string;
  title: string;
  body: string;
  sortOrder: number;
  status: TaskDraftStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskDraftInput = {
  requirementId: string;
  title: string;
  body: string;
  sortOrder: number;
};

export type TaskDraftRepository = {
  createTaskDraft(input: CreateTaskDraftInput): Promise<TaskDraft>;
  deleteTaskDraft(id: string): Promise<void>;
  getTaskDraft(id: string): Promise<TaskDraft | null>;
  listTaskDrafts(): Promise<TaskDraft[]>;
  reorderTaskDrafts(order: TaskDraftOrderInput[]): Promise<TaskDraft[]>;
  updateTaskDraft(input: UpdateTaskDraftInput): Promise<TaskDraft>;
};

export type UpdateTaskDraftInput = {
  id: string;
  title: string;
  body: string;
};

export type TaskDraftOrderInput = {
  id: string;
  sortOrder: number;
};

export type Task = {
  id: string;
  requirementId: string;
  title: string;
  body: string;
  status: TaskStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskRepository = {
  createTaskFromDraft(draft: TaskDraft): Promise<Task>;
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

const taskDrafts = sqliteTable("task_drafts", {
  id: text("id").primaryKey(),
  requirementId: text("requirement_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sortOrder: integer("sort_order").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type TaskDraftRow = typeof taskDrafts.$inferSelect;

const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
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

export function createInMemoryTaskDraftRepository(): TaskDraftRepository {
  return createTaskDraftRepository(new Database(":memory:"));
}

export function createInMemoryTaskRepository(): TaskRepository {
  return createTaskRepository(new Database(":memory:"));
}

export function createInMemoryWorkflowRunRepository(): WorkflowRunRepository {
  return createWorkflowRunRepository(new Database(":memory:"));
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

export function createSqliteTaskDraftRepository(
  filename = ".forge/forge.sqlite"
): TaskDraftRepository {
  mkdirSync(dirname(filename), { recursive: true });
  return createTaskDraftRepository(new Database(filename));
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

function createProjectRepository(sqlite: Database.Database): ProjectRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db);

  return {
    async createProject(input) {
      const now = new Date().toISOString();
      const project: Project = {
        id: `proj_${randomUUID()}`,
        name: input.name.trim(),
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
    }
  };
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
    CREATE TABLE IF NOT EXISTS task_drafts (
      id TEXT PRIMARY KEY NOT NULL,
      requirement_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
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
    modelBaseUrl: "https://api.openai.com/v1",
    modelName: "gpt-4.1-mini",
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
        createdAt: new Date().toISOString()
      };

      await db
        .insert(workflowFiles)
        .values(workflowFile)
        .run();

      return workflowFile;
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
      const updated: ExecutionSettings = {
        ...current,
        agentProxyUrl: input.agentProxyUrl?.trim() ?? current.agentProxyUrl,
        modelApiKey: nextModelApiKey ? nextModelApiKey : current.modelApiKey,
        modelBaseUrl: input.modelBaseUrl?.trim() ?? current.modelBaseUrl,
        modelName: input.modelName?.trim() ?? current.modelName,
        modelProvider: input.modelProvider ?? current.modelProvider,
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
      const requirement: Requirement = {
        id: `req_${randomUUID()}`,
        title: input.title.trim(),
        body: input.body.trim(),
        workflowFileId: input.workflowFileId,
        status: "open",
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

function createTaskDraftRepository(
  sqlite: Database.Database
): TaskDraftRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db);

  return {
    async createTaskDraft(input) {
      const now = new Date().toISOString();
      const taskDraft: TaskDraft = {
        id: `tdf_${randomUUID()}`,
        requirementId: input.requirementId,
        title: input.title.trim(),
        body: input.body.trim(),
        sortOrder: input.sortOrder,
        status: "draft",
        createdAt: now,
        updatedAt: now
      };

      await db.insert(taskDrafts).values(taskDraft).run();

      return taskDraft;
    },

    async deleteTaskDraft(id) {
      await db.delete(taskDrafts).where(eq(taskDrafts.id, id)).run();
    },

    async getTaskDraft(id) {
      const row = await db
        .select()
        .from(taskDrafts)
        .where(eq(taskDrafts.id, id))
        .get();

      return row ? toTaskDraft(row) : null;
    },

    async listTaskDrafts() {
      const rows = await db
        .select()
        .from(taskDrafts)
        .orderBy(asc(taskDrafts.sortOrder), asc(taskDrafts.createdAt));

      return rows.map(toTaskDraft);
    },

    async reorderTaskDrafts(order) {
      for (const item of order) {
        await db
          .update(taskDrafts)
          .set({
            sortOrder: item.sortOrder,
            updatedAt: new Date().toISOString()
          })
          .where(eq(taskDrafts.id, item.id))
          .run();
      }

      const rows = await db
        .select()
        .from(taskDrafts)
        .orderBy(asc(taskDrafts.sortOrder), asc(taskDrafts.createdAt));

      return rows.map(toTaskDraft);
    },

    async updateTaskDraft(input) {
      const row = await db
        .select()
        .from(taskDrafts)
        .where(eq(taskDrafts.id, input.id))
        .get();

      if (!row) {
        throw new Error(`Task draft not found: ${input.id}`);
      }

      const updated = {
        ...row,
        title: input.title.trim(),
        body: input.body.trim(),
        updatedAt: nextTimestamp(row.updatedAt)
      };

      await db
        .update(taskDrafts)
        .set({
          body: updated.body,
          title: updated.title,
          updatedAt: updated.updatedAt
        })
        .where(eq(taskDrafts.id, input.id))
        .run();

      return toTaskDraft(updated);
    }
  };
}

function createTaskRepository(sqlite: Database.Database): TaskRepository {
  const db = drizzle(sqlite);
  initializeSqliteSchema(db);

  return {
    async createTaskFromDraft(draft) {
      const now = new Date().toISOString();
      const task: Task = {
        id: `tsk_${randomUUID()}`,
        requirementId: draft.requirementId,
        title: draft.title,
        body: draft.body,
        status: "todo",
        deletedAt: null,
        createdAt: now,
        updatedAt: now
      };

      await db.insert(tasks).values(task).run();

      return task;
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

function toTaskDraft(row: TaskDraftRow): TaskDraft {
  return {
    id: row.id,
    requirementId: row.requirementId,
    title: row.title,
    body: row.body,
    sortOrder: row.sortOrder,
    status: row.status as TaskDraftStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
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

function nextTimestamp(previous: string) {
  const now = new Date();
  const previousDate = new Date(previous);

  if (now <= previousDate) {
    return new Date(previousDate.getTime() + 1).toISOString();
  }

  return now.toISOString();
}
