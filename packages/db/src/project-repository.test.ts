import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  createInMemoryExecutionSettingsRepository,
  createInMemoryBridgeRepository,
  createInMemoryProjectRepository,
  createInMemoryRequirementRepository,
  createInMemoryTaskRepository,
  createInMemoryTaskDraftRepository,
  createInMemoryWorkflowRunRepository,
  createInMemoryWorkflowFileRepository,
  createSqliteWorkflowFileRepository,
  type WorkflowFileRepository
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

  it("rejects duplicate project names", async () => {
    const repository = createInMemoryProjectRepository();

    await repository.createProject({ name: "自主测试" });

    await expect(repository.createProject({ name: "自主测试" })).rejects.toThrow(
      /already exists/i
    );
    await expect(repository.listProjects()).resolves.toHaveLength(1);
  });

  it("updates a project name and keeps names unique", async () => {
    const repository = createInMemoryProjectRepository();

    const project = await repository.createProject({ name: "Forge" });
    await repository.createProject({ name: "Control Room" });

    const updated = await repository.updateProject({
      id: project.id,
      name: "Forge Ops"
    });

    expect(updated).toMatchObject({
      id: project.id,
      name: "Forge Ops"
    });
    expect(updated.updatedAt).not.toBe(project.updatedAt);
    await expect(repository.listProjects()).resolves.toMatchObject([
      {
        id: project.id,
        name: "Forge Ops"
      },
      {
        name: "Control Room"
      }
    ]);
    await expect(
      repository.updateProject({ id: project.id, name: "Control Room" })
    ).rejects.toThrow(/already exists/i);
  });
});

describe("WorkflowFileRepository", () => {
  async function expectRequirementWorkflowScopePersists(
    createRepository: () => WorkflowFileRepository
  ) {
    const repository = createRepository();
    const definition = JSON.stringify({
      name: "Requirement workflow",
      nodes: [],
      scope: "requirement"
    });

    const workflowFile = await repository.createWorkflowFileMetadata({
      definition,
      name: "Requirement workflow",
      nodeCount: 1,
      scope: "requirement"
    });

    expect(workflowFile).toMatchObject({
      name: "Requirement workflow",
      scope: "requirement"
    });
    expect(JSON.parse(workflowFile.definition)).toMatchObject({
      scope: "requirement"
    });
    await expect(repository.listWorkflowFileMetadata()).resolves.toMatchObject([
      {
        id: workflowFile.id,
        scope: "requirement"
      }
    ]);
    await expect(
      repository.getWorkflowFileMetadata(workflowFile.id)
    ).resolves.toMatchObject({
      scope: "requirement"
    });
  }

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

  it("updates workflow file names", async () => {
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

    const updated = await repository.updateWorkflowFileMetadata({
      id: workflowFile.id,
      name: "Code delivery"
    });

    expect(updated).toMatchObject({
      id: workflowFile.id,
      name: "Code delivery"
    });
    expect(JSON.parse(updated.definition)).toMatchObject({
      name: "Code delivery"
    });
    await expect(repository.getWorkflowFileMetadata(workflowFile.id)).resolves.toMatchObject({
      name: "Code delivery"
    });
  });

  it("persists requirement-scoped workflow file metadata in memory", async () => {
    await expectRequirementWorkflowScopePersists(createInMemoryWorkflowFileRepository);
  });

  it("persists requirement-scoped workflow file metadata in SQLite", async () => {
    const directory = await mkdtemp(join(tmpdir(), "forge-db-"));

    try {
      const filename = join(directory, "forge.sqlite");

      await expectRequirementWorkflowScopePersists(() =>
        createSqliteWorkflowFileRepository(filename)
      );

      const reopenedRepository = createSqliteWorkflowFileRepository(filename);
      const [workflowFile] = await reopenedRepository.listWorkflowFileMetadata();

      expect(workflowFile).toMatchObject({
        scope: "requirement"
      });
      expect(JSON.parse(workflowFile?.definition ?? "{}")).toMatchObject({
        scope: "requirement"
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
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

describe("BridgeRepository", () => {
  it("registers local Agent Bindings and queues Bridge jobs", async () => {
    const repository = createInMemoryBridgeRepository();

    const agent = await repository.upsertAgentBinding({
      capabilities: ["cli"],
      command: "coco run",
      connector: "cli",
      name: "coco",
      status: "online"
    });
    const job = await repository.createBridgeJob({
      agentName: "coco",
      nodeRunId: "ndr_1",
      payload: {
        nodeRun: {
          id: "ndr_1",
          nodeId: "implement"
        },
        task: {
          id: "tsk_1",
          title: "Run local agent"
        }
      },
      workflowRunId: "wfr_1"
    });

    expect(agent).toMatchObject({
      command: "coco run",
      connector: "cli",
      name: "coco",
      status: "online"
    });
    expect(job).toMatchObject({
      agentName: "coco",
      status: "queued"
    });
    await expect(repository.listAgentBindings()).resolves.toMatchObject([
      {
        name: "coco",
        status: "online"
      }
    ]);

    const claimed = await repository.claimNextBridgeJob("bridge_local");

    expect(claimed).toMatchObject({
      bridgeId: "bridge_local",
      id: job.id,
      status: "claimed"
    });

    const completed = await repository.completeBridgeJob({
      errorMessage: null,
      id: job.id,
      output: "done",
      status: "succeeded"
    });

    expect(completed).toMatchObject({
      output: "done",
      status: "succeeded"
    });
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
  it("persists project ownership for requirements, task drafts, and tasks", async () => {
    const requirements = createInMemoryRequirementRepository();
    const taskDrafts = createInMemoryTaskDraftRepository();
    const tasks = createInMemoryTaskRepository();

    const requirement = await requirements.createRequirement({
      body: "Plan a Ningbo travel guide.",
      projectId: "proj_autonomous",
      title: "Ningbo guide",
      workflowFileId: "wff_requirement"
    });
    const taskDraft = await taskDrafts.createTaskDraft({
      body: "Write the guide.",
      projectId: requirement.projectId,
      requirementId: requirement.id,
      sortOrder: 0,
      title: "Write Ningbo guide"
    });
    const task = await tasks.createTaskFromDraft(taskDraft);

    expect(requirement.projectId).toBe("proj_autonomous");
    expect(taskDraft.projectId).toBe("proj_autonomous");
    expect(task.projectId).toBe("proj_autonomous");
  });

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

  it("updates requirement titles and keeps active project requirement names unique", async () => {
    const repository = createInMemoryRequirementRepository();

    const requirement = await repository.createRequirement({
      body: "Original requirement body.",
      projectId: "proj_forge",
      title: "Draft task generation",
      workflowFileId: "wff_requirement"
    });
    await repository.createRequirement({
      body: "Second requirement body.",
      projectId: "proj_forge",
      title: "Review work",
      workflowFileId: "wff_requirement"
    });
    await repository.createRequirement({
      body: "Another project can reuse the title.",
      projectId: "proj_other",
      title: "Review work",
      workflowFileId: "wff_requirement"
    });

    const updated = await repository.updateRequirement({
      id: requirement.id,
      title: "Implementation plan"
    });

    expect(updated).toMatchObject({
      body: "Original requirement body.",
      id: requirement.id,
      title: "Implementation plan"
    });
    expect(updated.updatedAt).not.toBe(requirement.updatedAt);
    await expect(
      repository.updateRequirement({
        id: requirement.id,
        title: "Review work"
      })
    ).rejects.toThrow(/already exists/i);
  });

  it("rejects duplicate active requirement names in the same project", async () => {
    const repository = createInMemoryRequirementRepository();

    const deleted = await repository.createRequirement({
      body: "Deleted requirement body.",
      projectId: "proj_forge",
      title: "Reusable requirement",
      workflowFileId: "wff_requirement"
    });

    await repository.deleteRequirement(deleted.id);
    await expect(
      repository.createRequirement({
        body: "Recreated requirement body.",
        projectId: "proj_forge",
        title: "Reusable requirement",
        workflowFileId: "wff_requirement"
      })
    ).resolves.toMatchObject({
      title: "Reusable requirement"
    });
    await expect(
      repository.createRequirement({
        body: "Duplicate requirement body.",
        projectId: "proj_forge",
        title: "Reusable requirement",
        workflowFileId: "wff_requirement"
      })
    ).rejects.toThrow(/already exists/i);
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
      projectId: null,
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
