import { describe, expect, it } from "vitest";
import {
  createInMemoryProjectRepository,
  createInMemoryWorkflowFileRepository
} from "./index";

describe("ProjectRepository", () => {
  it("persists projects with artifact storage mode and database strategy", async () => {
    const repository = createInMemoryProjectRepository();

    const project = await repository.createProject({
      artifactStorageMode: "cloud",
      dbStrategy: "postgres",
      name: "Forge"
    });

    expect(project).toMatchObject({
      artifactStorageMode: "cloud",
      dbStrategy: "postgres",
      name: "Forge"
    });
    expect(project.id).toMatch(/^proj_/);
    expect(project.createdAt).toEqual(project.updatedAt);

    await expect(repository.listProjects()).resolves.toEqual([project]);
  });

  it("defaults new projects to local-only artifacts and sqlite", async () => {
    const repository = createInMemoryProjectRepository();

    const project = await repository.createProject({ name: "Local Forge" });

    expect(project.artifactStorageMode).toBe("local-only");
    expect(project.dbStrategy).toBe("sqlite");
  });
});

describe("WorkflowFileRepository", () => {
  it("persists workflow file metadata", async () => {
    const repository = createInMemoryWorkflowFileRepository();

    const workflowFile = await repository.createWorkflowFileMetadata({
      name: "Coding workflow",
      nodeCount: 2,
      scope: "task"
    });

    expect(workflowFile).toMatchObject({
      name: "Coding workflow",
      nodeCount: 2,
      scope: "task"
    });
    expect(workflowFile.id).toMatch(/^wff_/);

    await expect(repository.listWorkflowFileMetadata()).resolves.toEqual([
      workflowFile
    ]);
  });
});
