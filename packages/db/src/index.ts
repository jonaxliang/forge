import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { asc, eq } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const artifactStorageModes = ["local-only", "cloud"] as const;
export const dbStrategies = ["sqlite", "postgres", "mysql"] as const;
export const workflowScopes = ["requirement", "task"] as const;
export const requirementStatuses = ["running", "completed", "failed"] as const;
export const taskDraftStatuses = ["draft"] as const;
export const taskStatuses = ["todo", "in_progress", "done"] as const;

export type ArtifactStorageMode = (typeof artifactStorageModes)[number];
export type DbStrategy = (typeof dbStrategies)[number];
export type WorkflowScope = (typeof workflowScopes)[number];
export type RequirementStatus = (typeof requirementStatuses)[number];
export type TaskDraftStatus = (typeof taskDraftStatuses)[number];
export type TaskStatus = (typeof taskStatuses)[number];

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
  createdAt: string;
};

export type CreateWorkflowFileMetadataInput = {
  name: string;
  scope: WorkflowScope;
  nodeCount: number;
};

export type WorkflowFileRepository = {
  createWorkflowFileMetadata(
    input: CreateWorkflowFileMetadataInput
  ): Promise<WorkflowFileMetadata>;
  getWorkflowFileMetadata(id: string): Promise<WorkflowFileMetadata | null>;
  listWorkflowFileMetadata(): Promise<WorkflowFileMetadata[]>;
};

export type Requirement = {
  id: string;
  title: string;
  body: string;
  workflowFileId: string;
  status: RequirementStatus;
  errorMessage: string | null;
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
  createdAt: string;
  updatedAt: string;
};

export type TaskRepository = {
  createTaskFromDraft(draft: TaskDraft): Promise<Task>;
  listTasks(): Promise<Task[]>;
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
  createdAt: text("created_at").notNull()
});

type WorkflowFileRow = typeof workflowFiles.$inferSelect;

const requirements = sqliteTable("requirements", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  workflowFileId: text("workflow_file_id").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
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
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type TaskRow = typeof tasks.$inferSelect;

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

export function createInMemoryRequirementRepository(): RequirementRepository {
  return createRequirementRepository(new Database(":memory:"));
}

export function createInMemoryTaskDraftRepository(): TaskDraftRepository {
  return createTaskDraftRepository(new Database(":memory:"));
}

export function createInMemoryTaskRepository(): TaskRepository {
  return createTaskRepository(new Database(":memory:"));
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
      created_at TEXT NOT NULL
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
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
        status: "running",
        errorMessage: null,
        createdAt: now,
        updatedAt: now
      };

      await db.insert(requirements).values(requirement).run();

      return requirement;
    },

    async listRequirements() {
      const rows = await db
        .select()
        .from(requirements)
        .orderBy(asc(requirements.createdAt));

      return rows.map(toRequirement);
    },

    async updateRequirementStatus(input) {
      const row = await db
        .select()
        .from(requirements)
        .where(eq(requirements.id, input.id))
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
        createdAt: now,
        updatedAt: now
      };

      await db.insert(tasks).values(task).run();

      return task;
    },

    async listTasks() {
      const rows = await db.select().from(tasks).orderBy(asc(tasks.createdAt));

      return rows.map(toTask);
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
    createdAt: row.createdAt
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
