import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  createInMemoryExecutionSettingsRepository,
  createInMemoryBridgeRepository,
  createInMemoryDecompositionResultRepository,
  createInMemoryProjectRepository,
  createInMemoryRequirementRepository,
  createInMemoryTaskRepository,
  createInMemoryWorkflowRunRepository,
  createInMemoryWorkflowFileRepository,
  createSqliteWorkflowFileRepository
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
    await repository.createProject({ name: "Forge Board" });

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
        name: "Forge Board"
      }
    ]);
    await expect(
      repository.updateProject({ id: project.id, name: "Forge Board" })
    ).rejects.toThrow(/already exists/i);
  });
});

describe("WorkflowFileRepository", () => {
  it("persists workflow file metadata", async () => {
    const repository = createInMemoryWorkflowFileRepository();

    const workflowFile = await repository.createWorkflowFileMetadata({
      definition: JSON.stringify({
        name: "Coding workflow",
        nodes: []
      }),
      name: "Coding workflow",
      nodeCount: 2,
      templateType: "builtin"
    });

    expect(workflowFile).toMatchObject({
      name: "Coding workflow",
      nodeCount: 2,
      templateType: "builtin"
    });
    expect("scope" in workflowFile).toBe(false);
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
        nodes: []
      }),
      name: "Coding workflow",
      nodeCount: 2
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

  it("deletes workflow file metadata", async () => {
    const repository = createInMemoryWorkflowFileRepository();
    const workflowFile = await repository.createWorkflowFileMetadata({
      definition: JSON.stringify({
        name: "Coding workflow",
        nodes: []
      }),
      name: "Coding workflow",
      nodeCount: 2
    });

    await repository.deleteWorkflowFileMetadata(workflowFile.id);

    await expect(repository.getWorkflowFileMetadata(workflowFile.id)).resolves.toBeNull();
    await expect(repository.listWorkflowFileMetadata()).resolves.toEqual([]);
  });

  it("migrates legacy SQLite workflow file scope columns away", async () => {
    const directory = await mkdtemp(join(tmpdir(), "forge-db-"));

    try {
      const filename = join(directory, "forge.sqlite");
      const legacyDb = new Database(filename);

      legacyDb.exec(`
        CREATE TABLE workflow_files (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          scope TEXT NOT NULL,
          node_count INTEGER NOT NULL,
          definition TEXT NOT NULL DEFAULT '{}',
          template_type TEXT NOT NULL DEFAULT 'custom',
          created_at TEXT NOT NULL
        );
        INSERT INTO workflow_files (
          id,
          name,
          scope,
          node_count,
          definition,
          template_type,
          created_at
        )
        VALUES (
          'wff_legacy',
          'Coding workflow',
          'task',
          2,
          '{"name":"Coding workflow","nodes":[]}',
          'custom',
          '2026-01-01T00:00:00.000Z'
        );
      `);
      legacyDb.close();

      const reopenedRepository = createSqliteWorkflowFileRepository(filename);
      const [workflowFile] = await reopenedRepository.listWorkflowFileMetadata();

      expect(workflowFile).toMatchObject({
        id: "wff_legacy",
        name: "Coding workflow",
        nodeCount: 2
      });
      expect("scope" in (workflowFile ?? {})).toBe(false);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

describe("ExecutionSettingsRepository", () => {
  it("persists model and local execution settings", async () => {
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
  it("persists project ownership for requirements, decomposition results, and tasks", async () => {
    const requirements = createInMemoryRequirementRepository();
    const decompositionResults = createInMemoryDecompositionResultRepository();
    const tasks = createInMemoryTaskRepository();

    const requirement = await requirements.createRequirement({
      body: "Plan a Ningbo travel guide.",
      projectId: "proj_autonomous",
      title: "Ningbo guide",
      workflowFileId: "wff_requirement"
    });
    const decompositionResult = await decompositionResults.saveDecompositionResult({
      items: [
        {
          body: "Write the guide.",
          sortOrder: 0,
          title: "Write Ningbo guide"
        }
      ],
      projectId: requirement.projectId,
      requirementId: requirement.id,
      summary: "One guide writing task."
    });
    const [task] = await tasks.createTasksFromDecompositionResult({
      items: decompositionResult.items,
      projectId: decompositionResult.projectId,
      requirementId: decompositionResult.requirementId
    });

    expect(requirement.projectId).toBe("proj_autonomous");
    expect(decompositionResult.projectId).toBe("proj_autonomous");
    expect(task.projectId).toBe("proj_autonomous");
  });

  it("persists requirements and updates decomposition status", async () => {
    const repository = createInMemoryRequirementRepository();

    const requirement = await repository.createRequirement({
      body: "Let users turn a requirement into decomposition results.",
      title: "Decomposition result generation",
      workflowFileId: "wff_requirement"
    });

    expect(requirement).toMatchObject({
      body: "Let users turn a requirement into decomposition results.",
      errorMessage: null,
      status: "init",
      title: "Decomposition result generation",
      workflowFileId: "wff_requirement"
    });
    expect(requirement.id).toMatch(/^req_/);

    const failed = await repository.updateRequirementStatus({
      errorMessage: "Planner failed",
      id: requirement.id,
      status: "decomposition_failed"
    });

    expect(failed).toMatchObject({
      errorMessage: "Planner failed",
      id: requirement.id,
      status: "decomposition_failed"
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

describe("DecompositionResultRepository", () => {
  it("persists editable decomposition results for a requirement", async () => {
    const repository = createInMemoryDecompositionResultRepository();

    const result = await repository.saveDecompositionResult({
      items: [
        {
          body: "Implement the minimum requirement workflow.",
          sortOrder: 0,
          title: "Implement workflow"
        }
      ],
      projectId: "proj_forge",
      requirementId: "req_requirement",
      summary: "Split this requirement into one implementation task."
    });

    expect(result).toMatchObject({
      items: [
        {
          body: "Implement the minimum requirement workflow.",
          sortOrder: 0,
          title: "Implement workflow"
        }
      ],
      projectId: "proj_forge",
      requirementId: "req_requirement",
      summary: "Split this requirement into one implementation task."
    });
    expect(result.id).toMatch(/^dcr_/);

    await expect(
      repository.getDecompositionResultForRequirement("req_requirement")
    ).resolves.toEqual(result);
  });

  it("updates decomposition result structure without creating tasks", async () => {
    const repository = createInMemoryDecompositionResultRepository();
    const result = await repository.saveDecompositionResult({
      items: [
        {
          body: "First body",
          sortOrder: 0,
          title: "First"
        }
      ],
      requirementId: "req_requirement",
      summary: "Initial split"
    });

    await expect(
      repository.updateDecompositionResult({
        id: result.id,
        items: [
          {
            body: "Second body",
            sortOrder: 0,
            title: "Second"
          }
        ],
        summary: "Edited split"
      })
    ).resolves.toMatchObject({
      items: [
        {
          body: "Second body",
          sortOrder: 0,
          title: "Second"
        }
      ],
      summary: "Edited split"
    });
  });
});

describe("TaskRepository", () => {
  it("creates initialized tasks from decomposition result items", async () => {
    const repository = createInMemoryTaskRepository();
    const tasks = await repository.createTasksFromDecompositionResult({
      items: [
        {
          body: "Generated task body",
          sortOrder: 0,
          title: "Generated task"
        }
      ],
      projectId: null,
      requirementId: "req_requirement"
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      requirementId: "req_requirement",
      status: "init",
      title: "Generated task"
    });
    expect(tasks[0]?.id).toMatch(/^tsk_/);
    await expect(repository.getTask(tasks[0]!.id)).resolves.toEqual(tasks[0]);
    await expect(repository.getTask("tsk_missing")).resolves.toBeNull();
  });

  it("soft deletes tasks associated with a requirement", async () => {
    const repository = createInMemoryTaskRepository();
    const [task] = await repository.createTasksFromDecompositionResult({
      items: [
        {
          body: "Generated task body",
          sortOrder: 0,
          title: "Generated task"
        }
      ],
      projectId: null,
      requirementId: "req_requirement",
    });

    await repository.deleteTasksForRequirement("req_requirement");

    await expect(repository.listTasks()).resolves.toEqual([]);
    await expect(repository.getTask(task.id)).resolves.toBeNull();
  });
});
