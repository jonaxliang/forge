import { describe, expect, it } from "vitest";
import {
  createInMemoryProjectRepository,
  createInMemoryRequirementRepository,
  createInMemoryTaskRepository,
  createInMemoryTaskDraftRepository,
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

describe("RequirementRepository", () => {
  it("persists requirements and updates workflow execution status", async () => {
    const repository = createInMemoryRequirementRepository();

    const requirement = await repository.createRequirement({
      body: "Let users turn a requirement into draft tasks.",
      title: "Draft task generation",
      workflowFileId: "wff_requirement"
    });

    expect(requirement).toMatchObject({
      body: "Let users turn a requirement into draft tasks.",
      errorMessage: null,
      status: "running",
      title: "Draft task generation",
      workflowFileId: "wff_requirement"
    });
    expect(requirement.id).toMatch(/^req_/);

    const failed = await repository.updateRequirementStatus({
      errorMessage: "Mock executor failed",
      id: requirement.id,
      status: "failed"
    });

    expect(failed).toMatchObject({
      errorMessage: "Mock executor failed",
      id: requirement.id,
      status: "failed"
    });
    expect(failed.updatedAt).not.toBe(requirement.updatedAt);

    await expect(repository.listRequirements()).resolves.toEqual([failed]);
  });
});

describe("TaskDraftRepository", () => {
  it("persists task drafts for a requirement", async () => {
    const repository = createInMemoryTaskDraftRepository();

    const taskDraft = await repository.createTaskDraft({
      body: "Implement the minimum requirement workflow run.",
      requirementId: "req_requirement",
      sortOrder: 0,
      title: "Implement requirement workflow"
    });

    expect(taskDraft).toMatchObject({
      body: "Implement the minimum requirement workflow run.",
      requirementId: "req_requirement",
      sortOrder: 0,
      title: "Implement requirement workflow"
    });
    expect(taskDraft.id).toMatch(/^tdf_/);

    await expect(repository.listTaskDrafts()).resolves.toEqual([taskDraft]);
  });

  it("updates, reorders, deletes and approves task drafts", async () => {
    const taskDrafts = createInMemoryTaskDraftRepository();
    const tasks = createInMemoryTaskRepository();
    const first = await taskDrafts.createTaskDraft({
      body: "First draft body",
      requirementId: "req_requirement",
      sortOrder: 0,
      title: "First draft"
    });
    const second = await taskDrafts.createTaskDraft({
      body: "Second draft body",
      requirementId: "req_requirement",
      sortOrder: 1,
      title: "Second draft"
    });

    await expect(
      taskDrafts.updateTaskDraft({
        body: "Updated draft body",
        id: first.id,
        title: "Updated draft"
      })
    ).resolves.toMatchObject({
      body: "Updated draft body",
      title: "Updated draft"
    });

    await taskDrafts.reorderTaskDrafts([
      { id: second.id, sortOrder: 0 },
      { id: first.id, sortOrder: 1 }
    ]);
    await expect(taskDrafts.listTaskDrafts()).resolves.toMatchObject([
      { id: second.id, sortOrder: 0 },
      { id: first.id, sortOrder: 1 }
    ]);

    const approvedDraft = await taskDrafts.getTaskDraft(second.id);

    expect(approvedDraft).not.toBeNull();

    const task = await tasks.createTaskFromDraft(approvedDraft!);

    expect(task).toMatchObject({
      requirementId: "req_requirement",
      status: "todo",
      title: "Second draft"
    });
    expect(task.id).toMatch(/^tsk_/);

    await taskDrafts.deleteTaskDraft(second.id);
    await expect(taskDrafts.getTaskDraft(second.id)).resolves.toBeNull();
    await expect(tasks.listTasks()).resolves.toEqual([task]);
  });
});
