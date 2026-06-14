import { describe, expect, it } from "vitest";
import {
  createInMemoryExecutionSettingsRepository,
  createInMemoryProjectRepository,
  createInMemoryRequirementRepository,
  createInMemoryTaskRepository,
  createInMemoryTaskDraftRepository,
  createInMemoryWorkflowRunRepository,
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
      definition: JSON.stringify({
        name: "Coding workflow",
        nodes: [],
        scope: "task"
      }),
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

describe("ExecutionSettingsRepository", () => {
  it("persists model and local Agent proxy settings", async () => {
    const repository = createInMemoryExecutionSettingsRepository();

    const defaults = await repository.getExecutionSettings();

    expect(defaults).toMatchObject({
      agentProxyUrl: "",
      id: "default",
      modelApiKey: "",
      modelBaseUrl: "https://api.openai.com/v1",
      modelName: "gpt-4.1-mini",
      modelProvider: "openai-compatible"
    });

    const updated = await repository.updateExecutionSettings({
      agentProxyUrl: "http://127.0.0.1:8787",
      modelApiKey: "secret-key",
      modelBaseUrl: "https://models.example/v1",
      modelName: "planner-model"
    });

    expect(updated).toMatchObject({
      agentProxyUrl: "http://127.0.0.1:8787",
      modelApiKey: "secret-key",
      modelBaseUrl: "https://models.example/v1",
      modelName: "planner-model"
    });
    await expect(repository.getExecutionSettings()).resolves.toEqual(updated);
  });
});

describe("WorkflowRunRepository", () => {
  it("persists workflow runs and node runs in DAG order", async () => {
    const repository = createInMemoryWorkflowRunRepository();

    const workflowRun = await repository.createWorkflowRun({
      taskId: "tsk_task",
      workflowFileId: "wff_task"
    });
    const firstNode = await repository.createNodeRun({
      dependsOn: [],
      nodeId: "plan",
      sortOrder: 0,
      status: "queued",
      workflowRunId: workflowRun.id
    });
    const secondNode = await repository.createNodeRun({
      dependsOn: ["plan"],
      nodeId: "code",
      sortOrder: 1,
      status: "queued",
      workflowRunId: workflowRun.id
    });

    await repository.updateNodeRunStatus({
      id: firstNode.id,
      status: "succeeded"
    });
    await repository.updateNodeRunStatus({
      id: secondNode.id,
      status: "succeeded"
    });
    const completedRun = await repository.updateWorkflowRunStatus({
      id: workflowRun.id,
      status: "succeeded"
    });

    expect(completedRun).toMatchObject({
      id: workflowRun.id,
      status: "succeeded"
    });
    await expect(repository.listWorkflowRuns()).resolves.toMatchObject([
      {
        id: workflowRun.id,
        taskId: "tsk_task",
        workflowFileId: "wff_task"
      }
    ]);
    await expect(repository.listNodeRuns(workflowRun.id)).resolves.toMatchObject([
      {
        nodeId: "plan",
        status: "succeeded"
      },
      {
        nodeId: "code",
        status: "succeeded"
      }
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
      status: "open",
      title: "Draft task generation",
      workflowFileId: "wff_requirement"
    });
    expect(requirement.id).toMatch(/^req_/);

    const failed = await repository.updateRequirementStatus({
      errorMessage: "Planner failed",
      id: requirement.id,
      status: "failed"
    });

    expect(failed).toMatchObject({
      errorMessage: "Planner failed",
      id: requirement.id,
      status: "failed"
    });
    expect(failed.updatedAt).not.toBe(requirement.updatedAt);

    await expect(repository.listRequirements()).resolves.toEqual([failed]);
  });

  it("soft deletes requirements from active lists", async () => {
    const repository = createInMemoryRequirementRepository();
    const requirement = await repository.createRequirement({
      body: "Remove this requirement without losing audit history.",
      title: "Soft delete requirement",
      workflowFileId: "wff_requirement"
    });

    await repository.deleteRequirement(requirement.id);

    await expect(repository.listRequirements()).resolves.toEqual([]);
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
    await expect(tasks.getTask(task.id)).resolves.toEqual(task);
    await expect(tasks.getTask("tsk_missing")).resolves.toBeNull();

    await taskDrafts.deleteTaskDraft(second.id);
    await expect(taskDrafts.getTaskDraft(second.id)).resolves.toBeNull();
    await expect(tasks.listTasks()).resolves.toEqual([task]);
  });
});

describe("TaskRepository", () => {
  it("soft deletes tasks associated with a requirement", async () => {
    const repository = createInMemoryTaskRepository();
    const task = await repository.createTaskFromDraft({
      body: "Generated task body",
      createdAt: new Date().toISOString(),
      id: "tdf_task",
      requirementId: "req_requirement",
      sortOrder: 0,
      status: "draft",
      title: "Generated task",
      updatedAt: new Date().toISOString()
    });

    await repository.deleteTasksForRequirement("req_requirement");

    await expect(repository.listTasks()).resolves.toEqual([]);
    await expect(repository.getTask(task.id)).resolves.toBeNull();
  });
});
