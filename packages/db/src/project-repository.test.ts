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
  createInMemorySkillRepository,
  createInMemoryRequirementRepository,
  createInMemoryTaskRepository,
  createInMemoryWorkflowRunRepository,
  createInMemoryWorkflowFileRepository,
  createSqliteBridgeRepository,
  createSqliteWorkflowFileRepository
} from "./index";

describe("ProjectRepository", () => {
  it("persists projects with artifact storage mode and database strategy", async () => {
    const repository = createInMemoryProjectRepository();

    const project = await repository.createProject({
      artifactStorageMode: "cloud",
      dbStrategy: "postgres",
      defaultExecutorAgentBindingId: "agb_planner",
      defaultExecutorType: "agent-binding",
      name: "Forge"
    });

    expect(project).toMatchObject({
      artifactStorageMode: "cloud",
      dbStrategy: "postgres",
      defaultExecutorAgentBindingId: "agb_planner",
      defaultExecutorType: "agent-binding",
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
    expect(project.defaultExecutorAgentBindingId).toBeNull();
    expect(project.defaultExecutorType).toBe("model-api");
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

  it("updates a project default executor independently from the project name", async () => {
    const repository = createInMemoryProjectRepository();
    const project = await repository.createProject({ name: "Forge" });

    const updated = await repository.updateProject({
      defaultExecutorAgentBindingId: "agb_planner",
      defaultExecutorType: "agent-binding",
      id: project.id
    });

    expect(updated).toMatchObject({
      defaultExecutorAgentBindingId: "agb_planner",
      defaultExecutorType: "agent-binding",
      id: project.id,
      name: "Forge"
    });
    await expect(
      repository.updateProject({
        defaultExecutorType: "model-api",
        id: project.id
      })
    ).resolves.toMatchObject({
      defaultExecutorAgentBindingId: null,
      defaultExecutorType: "model-api"
    });
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

describe("SkillRepository", () => {
  it("persists uploaded Skill definitions", async () => {
    const repository = createInMemorySkillRepository();

    const skill = await repository.createSkill({
      body: "# Code Review\n\nReview changes for behavioral regressions.",
      description: "Reviews code changes before handoff.",
      files: [
        {
          content: "# Code Review\n\nReview changes for behavioral regressions.",
          path: "SKILL.md"
        }
      ],
      name: "Code Review",
      projectId: "proj_test",
      ref: "skill:code-review",
      storagePath: "/tmp/forge-skills/proj_test/code-review"
    });

    expect(skill).toMatchObject({
      body: "# Code Review\n\nReview changes for behavioral regressions.",
      description: "Reviews code changes before handoff.",
      files: [
        {
          content: "# Code Review\n\nReview changes for behavioral regressions.",
          path: "SKILL.md"
        }
      ],
      name: "Code Review",
      projectId: "proj_test",
      ref: "skill:code-review",
      storagePath: "/tmp/forge-skills/proj_test/code-review"
    });
    expect(skill.id).toMatch(/^skl_/);
    expect(skill.createdAt).toEqual(skill.updatedAt);

    await expect(repository.listSkills("proj_test")).resolves.toEqual([skill]);
    await expect(repository.listSkills("proj_other")).resolves.toEqual([]);
  });

  it("lists Project Skills together with system Skills only", async () => {
    const repository = createInMemorySkillRepository();
    const systemSkill = await repository.createSkill({
      body: "# System Skill",
      name: "system-skill",
      ref: "skill:system",
      storagePath: "/tmp/forge-skills/system/system-skill"
    });
    const projectSkill = await repository.createSkill({
      body: "# Project Skill",
      name: "project-skill",
      projectId: "proj_test",
      ref: "skill:project",
      storagePath: "/tmp/forge-skills/proj_test/project-skill"
    });
    await repository.createSkill({
      body: "# Other Project Skill",
      name: "other-project-skill",
      projectId: "proj_other",
      ref: "skill:other-project",
      storagePath: "/tmp/forge-skills/proj_other/other-project-skill"
    });

    await expect(repository.listSkills("proj_test")).resolves.toEqual([
      systemSkill,
      projectSkill
    ]);
    await expect(repository.listSkills(null)).resolves.toEqual([systemSkill]);
  });

  it("updates a Skill from its source URL", async () => {
    const repository = createInMemorySkillRepository();
    const skill = await repository.createSkill({
      body: "# Old Review",
      files: [{ content: "# Old Review", path: "SKILL.md" }],
      name: "code-review",
      projectId: "proj_test",
      ref: "skill:code-review",
      sourceUrl: "https://github.com/acme/forge-skills/tree/main/code-review",
      storagePath: "/tmp/forge-skills/proj_test/code-review"
    });

    const updatedSkill = await repository.updateSkill(skill.id, {
      body: "# New Review",
      description: "Reviews the latest code changes.",
      files: [
        {
          content: "# New Review",
          path: "SKILL.md"
        }
      ],
      name: "code-review",
      ref: "skill:code-review",
      sourceUrl: "https://github.com/acme/forge-skills/tree/main/code-review",
      storagePath: "/tmp/forge-skills/proj_test/code-review"
    });

    expect(updatedSkill).toMatchObject({
      body: "# New Review",
      description: "Reviews the latest code changes.",
      sourceUrl: "https://github.com/acme/forge-skills/tree/main/code-review"
    });
    expect(new Date(updatedSkill.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(skill.updatedAt).getTime()
    );
    await expect(repository.listSkills("proj_test")).resolves.toEqual([
      updatedSkill
    ]);
  });

  it("deletes uploaded Skill definitions", async () => {
    const repository = createInMemorySkillRepository();
    const skill = await repository.createSkill({
      body: "# Verification",
      files: [{ content: "# Verification", path: "SKILL.md" }],
      name: "Verification",
      projectId: "proj_test",
      ref: "skill:verification",
      storagePath: "/tmp/forge-skills/proj_test/verification"
    });

    await repository.deleteSkill(skill.id);

    await expect(repository.listSkills("proj_test")).resolves.toEqual([]);
  });
});

describe("ExecutionSettingsRepository", () => {
  it("persists model and local execution settings", async () => {
    const repository = createInMemoryExecutionSettingsRepository();

    const defaults = await repository.getExecutionSettings();

    expect(defaults).toMatchObject({
      agentProxyUrl: "",
      defaultExecutorAgentBindingId: null,
      defaultExecutorType: "model-api",
      id: "default",
      modelApiKey: "",
      modelBaseUrl: "https://api.openai.com/v1",
      modelName: "gpt-4.1-mini",
      modelProvider: "openai-compatible"
    });

    const updated = await repository.updateExecutionSettings({
      agentProxyUrl: "http://127.0.0.1:8787",
      defaultExecutorAgentBindingId: "agb_planner",
      defaultExecutorType: "agent-binding",
      modelApiKey: "secret-key",
      modelBaseUrl: "https://models.example/v1",
      modelName: "planner-model"
    });

    expect(updated).toMatchObject({
      agentProxyUrl: "http://127.0.0.1:8787",
      defaultExecutorAgentBindingId: "agb_planner",
      defaultExecutorType: "agent-binding",
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

  it("treats stale local Agent Binding heartbeats as offline", async () => {
    const directory = await mkdtemp(join(tmpdir(), "forge-db-bridge-"));
    const sqlitePath = join(directory, "forge.sqlite");
    const repository = createSqliteBridgeRepository(sqlitePath);

    await repository.upsertAgentBinding({
      capabilities: ["cli"],
      command: "coco run",
      connector: "cli",
      name: "coco",
      status: "online"
    });

    const staleLastSeenAt = new Date(Date.now() - 120_000).toISOString();
    const sqlite = new Database(sqlitePath);
    sqlite
      .prepare("UPDATE agent_bindings SET last_seen_at = ? WHERE name = ?")
      .run(staleLastSeenAt, "coco");
    sqlite.close();

    await expect(repository.listAgentBindings()).resolves.toMatchObject([
      {
        lastSeenAt: staleLastSeenAt,
        name: "coco",
        status: "offline"
      }
    ]);
    await expect(repository.hasOnlineAgentBindings()).resolves.toBe(false);
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
      output: "planned",
      status: "succeeded"
    });
    await repository.updateNodeRunStatus({
      errorMessage: "Code failed",
      id: secondNode.id,
      status: "failed"
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
        output: "planned",
        status: "succeeded"
      },
      {
        errorMessage: "Code failed",
        nodeId: "code",
        status: "failed"
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
          executorAgentBindingId: null,
          executorLabel: "Model API",
          executorType: "model-api",
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

  it("updates requirement details and keeps active project requirement names unique", async () => {
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
      body: "Updated requirement body.",
      id: requirement.id,
      title: "Implementation plan"
    });

    expect(updated).toMatchObject({
      body: "Updated requirement body.",
      id: requirement.id,
      title: "Implementation plan"
    });
    expect(updated.updatedAt).not.toBe(requirement.updatedAt);
    await expect(
      repository.updateRequirement({
        body: "Still duplicate.",
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
          executorAgentBindingId: "agb_planner",
          executorLabel: "Planner Agent",
          executorType: "agent-binding",
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
          executorAgentBindingId: "agb_planner",
          executorLabel: "Planner Agent",
          executorType: "agent-binding",
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
          executorAgentBindingId: null,
          executorLabel: "Model API",
          executorType: "model-api",
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
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
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
          executorAgentBindingId: null,
          executorLabel: "Model API",
          executorType: "model-api",
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
          executorAgentBindingId: "agb_executor",
          executorLabel: "Executor Agent",
          executorType: "agent-binding",
          sortOrder: 0,
          title: "Generated task"
        }
      ],
      projectId: null,
      requirementId: "req_requirement"
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      executorAgentBindingId: "agb_executor",
      executorLabel: "Executor Agent",
      executorType: "agent-binding",
      requirementId: "req_requirement",
      status: "init",
      title: "Generated task"
    });
    expect(tasks[0]?.id).toMatch(/^tsk_/);
    await expect(repository.getTask(tasks[0]!.id)).resolves.toEqual(tasks[0]);
    await expect(repository.getTask("tsk_missing")).resolves.toBeNull();
  });

  it("maps decomposition item dependencies to generated task dependencies", async () => {
    const repository = createInMemoryTaskRepository();
    const tasks = await repository.createTasksFromDecompositionResult({
      items: [
        {
          body: "Create the data model first.",
          dependsOn: [],
          executorAgentBindingId: null,
          executorLabel: "Model API",
          executorType: "model-api",
          id: "item_model",
          sortOrder: 0,
          title: "Model tasks"
        },
        {
          body: "Build the UI after the model exists.",
          dependsOn: ["item_model"],
          executorAgentBindingId: null,
          executorLabel: "Model API",
          executorType: "model-api",
          id: "item_ui",
          sortOrder: 1,
          title: "Build UI"
        }
      ],
      projectId: null,
      requirementId: "req_requirement"
    });

    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      dependsOn: [],
      sourceItemId: "item_model"
    });
    expect(tasks[1]).toMatchObject({
      dependsOn: [tasks[0]!.id],
      sourceItemId: "item_ui"
    });
    await expect(repository.listTasks()).resolves.toMatchObject([
      {
        dependsOn: [],
        sourceItemId: "item_model"
      },
      {
        dependsOn: [tasks[0]!.id],
        sourceItemId: "item_ui"
      }
    ]);
  });

  it("updates task status", async () => {
    const repository = createInMemoryTaskRepository();
    const [task] = await repository.createTasksFromDecompositionResult({
      items: [
        {
          body: "Run the task.",
          executorAgentBindingId: null,
          executorLabel: "Model API",
          executorType: "model-api",
          sortOrder: 0,
          title: "Runnable task"
        }
      ],
      projectId: null,
      requirementId: "req_requirement"
    });

    const updatedTask = await repository.updateTaskStatus({
      id: task!.id,
      status: "running"
    });

    expect(updatedTask).toMatchObject({
      id: task!.id,
      status: "running"
    });
    await expect(repository.getTask(task!.id)).resolves.toMatchObject({
      status: "running"
    });
  });

  it("rejects cyclic decomposition item dependencies", async () => {
    const repository = createInMemoryTaskRepository();

    await expect(
      repository.createTasksFromDecompositionResult({
        items: [
          {
            body: "First task.",
            dependsOn: ["item_b"],
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            id: "item_a",
            sortOrder: 0,
            title: "First"
          },
          {
            body: "Second task.",
            dependsOn: ["item_a"],
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            id: "item_b",
            sortOrder: 1,
            title: "Second"
          }
        ],
        projectId: null,
        requirementId: "req_requirement"
      })
    ).rejects.toThrow(/cycle/i);
  });

  it("soft deletes tasks associated with a requirement", async () => {
    const repository = createInMemoryTaskRepository();
    const [task] = await repository.createTasksFromDecompositionResult({
      items: [
        {
          body: "Generated task body",
          executorAgentBindingId: null,
          executorLabel: "Model API",
          executorType: "model-api",
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
