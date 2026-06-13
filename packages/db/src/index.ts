import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { asc } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const artifactStorageModes = ["local-only", "cloud"] as const;
export const dbStrategies = ["sqlite", "postgres", "mysql"] as const;

export type ArtifactStorageMode = (typeof artifactStorageModes)[number];
export type DbStrategy = (typeof dbStrategies)[number];

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

const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  artifactStorageMode: text("artifact_storage_mode").notNull(),
  dbStrategy: text("db_strategy").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

type ProjectRow = typeof projects.$inferSelect;

export function createDatabaseStatus(): DatabaseStatus {
  return {
    configured: false,
    dialect: "unconfigured"
  };
}

export function createInMemoryProjectRepository(): ProjectRepository {
  return createProjectRepository(new Database(":memory:"));
}

export function createSqliteProjectRepository(
  filename = ".forge/forge.sqlite"
): ProjectRepository {
  mkdirSync(dirname(filename), { recursive: true });
  return createProjectRepository(new Database(filename));
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
