import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  );
});

async function createWebAssetsRoot(files: Record<string, string>) {
  const directory = await mkdtemp(join(tmpdir(), "forge-web-assets-"));
  temporaryDirectories.push(directory);

  await Promise.all(
    Object.entries(files).map(async ([filePath, content]) => {
      const absolutePath = join(directory, filePath);
      const parentDirectory = dirname(absolutePath);

      await mkdir(parentDirectory, { recursive: true });
      await writeFile(absolutePath, content);
    })
  );

  return directory;
}

async function configureModel(app: ReturnType<typeof createApp>) {
  await app.request("/execution-settings", {
    body: JSON.stringify({
      modelApiKey: "test-key"
    }),
    headers: {
      "content-type": "application/json"
    },
    method: "PATCH"
  });
}

function createPlanningApp(options: Parameters<typeof createApp>[0] = {}) {
  return createApp({
    requirementPlanner: async ({ requirement }) => [
      {
        body: `Planned from requirement: ${requirement.body}`,
        sortOrder: 0,
        title: `Task: ${requirement.title}`
      }
    ],
    ...options
  });
}

describe("GET /health", () => {
  it("returns the Forge server health payload", async () => {
    const app = createApp();
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "forge",
      status: "healthy"
    });
  });
});

describe("Web console assets", () => {
  it("serves the bundled Web console from the server root", async () => {
    const webAssetsRoot = await createWebAssetsRoot({
      "index.html": "<html><body><div id=\"root\">Forge Web</div></body></html>"
    });
    const app = createApp({ webAssetsRoot });

    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toContain("Forge Web");
  });

  it("serves nested Web asset files without intercepting API routes", async () => {
    const webAssetsRoot = await createWebAssetsRoot({
      "assets/app.js": "console.log('forge web');",
      "index.html": "<html><body>Forge Web</body></html>"
    });
    const app = createApp({ webAssetsRoot });

    const assetResponse = await app.request("/assets/app.js");
    const apiResponse = await app.request("/projects/missing");

    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("content-type")).toContain("javascript");
    await expect(assetResponse.text()).resolves.toContain("forge web");
    expect(apiResponse.status).toBe(404);
  });

  it("falls back to index.html for Web console routes", async () => {
    const webAssetsRoot = await createWebAssetsRoot({
      "index.html": "<html><body>Forge Web</body></html>"
    });
    const app = createApp({ webAssetsRoot });

    const response = await app.request("/control-room");

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("Forge Web");
  });
});

describe("Project API", () => {
  it("creates and lists projects", async () => {
    const app = createApp();

    const createResponse = await app.request("/projects", {
      body: JSON.stringify({
        artifactStorageMode: "cloud",
        dbStrategy: "mysql",
        name: "Forge"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(createResponse.status).toBe(201);
    await expect(createResponse.json()).resolves.toMatchObject({
      artifactStorageMode: "cloud",
      dbStrategy: "mysql",
      name: "Forge"
    });

    const listResponse = await app.request("/projects");

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      projects: [
        {
          artifactStorageMode: "cloud",
          dbStrategy: "mysql",
          name: "Forge"
        }
      ]
    });
  });

  it("rejects invalid project creation payloads", async () => {
    const app = createApp();

    const response = await app.request("/projects", {
      body: JSON.stringify({
        artifactStorageMode: "remote",
        name: ""
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(400);
  });
});

describe("Execution settings API", () => {
  it("updates model and local Agent proxy settings without returning the API key", async () => {
    const app = createApp();

    const updateResponse = await app.request("/execution-settings", {
      body: JSON.stringify({
        agentProxyUrl: "http://127.0.0.1:8787",
        modelApiKey: "secret-key",
        modelBaseUrl: "https://models.example/v1",
        modelName: "planner-model"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "PATCH"
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      executionSettings: {
        agentProxyConfigured: true,
        agentProxyUrl: "http://127.0.0.1:8787",
        modelBaseUrl: "https://models.example/v1",
        modelConfigured: true,
        modelName: "planner-model",
        modelProvider: "openai-compatible"
      }
    });

    const response = await app.request("/execution-settings");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("secret-key");
    expect(body).toMatchObject({
      executionSettings: {
        agentProxyConfigured: true,
        modelConfigured: true
      }
    });
  });

  it("preserves the configured model API key when settings are saved with an empty key field", async () => {
    const app = createApp();

    await app.request("/execution-settings", {
      body: JSON.stringify({
        modelApiKey: "secret-key",
        modelBaseUrl: "https://models.example/v1",
        modelName: "planner-model"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "PATCH"
    });

    const updateResponse = await app.request("/execution-settings", {
      body: JSON.stringify({
        modelApiKey: "",
        modelBaseUrl: "https://models.example/v2",
        modelName: "planner-model-v2"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "PATCH"
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      executionSettings: {
        modelBaseUrl: "https://models.example/v2",
        modelConfigured: true,
        modelName: "planner-model-v2"
      }
    });

    const response = await app.request("/execution-settings");
    const body = await response.json();

    expect(JSON.stringify(body)).not.toContain("secret-key");
    expect(body).toMatchObject({
      executionSettings: {
        modelConfigured: true
      }
    });
  });
});

describe("Workflow file API", () => {
  it("imports a valid workflow file and stores metadata", async () => {
    const app = createApp();

    const response = await app.request("/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Coding workflow
scope: task
nodes:
  - id: analyze
    type: requirement-analysis
    executor: skill:requirements
    outputs:
      - analysis.md
    exit:
      maxRetries: 2
  - id: implement
    type: coding
    after: analyze
    executor: skill:code
    outputs:
      - diff.patch
    exit:
      maxRetries: 1
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      workflow: {
        name: "Coding workflow",
        scope: "task",
        nodes: [
          {
            id: "analyze"
          },
          {
            id: "implement",
            dependsOn: ["analyze"]
          }
        ]
      },
      workflowFile: {
        name: "Coding workflow",
        nodeCount: 2,
        scope: "task"
      }
    });

    const listResponse = await app.request("/workflow-files");

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      workflowFiles: [
        {
          name: "Coding workflow",
          nodeCount: 2,
          scope: "task"
        }
      ]
    });
  });

  it("returns a clear validation error for invalid workflow files", async () => {
    const app = createApp();

    const response = await app.request("/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Bad workflow
scope: task
nodes:
  - id: implement
    type: coding
    after: missing
    executor: skill:code
    exit:
      maxRetries: 1
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/unknown dependency/i)
    });
  });
});

describe("Requirement API", () => {
  it("saves a requirement without generating tasks when the model is not configured", async () => {
    const app = createApp();

    const workflowResponse = await app.request("/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: requirement
nodes:
  - id: split
    type: task-drafting
    executor: skill:requirements
    exit:
      maxRetries: 1
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const workflowBody = (await workflowResponse.json()) as {
      workflowFile: { id: string };
    };

    const response = await app.request("/requirements", {
      body: JSON.stringify({
        body: "Build the minimum Requirement to Task Draft flow.",
        title: "Generate draft tasks",
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      planning: {
        reason: "model_not_configured",
        status: "blocked"
      },
      requirement: {
        body: "Build the minimum Requirement to Task Draft flow.",
        status: "open",
        title: "Generate draft tasks",
        workflowFileId: workflowBody.workflowFile.id
      },
      taskDrafts: []
    });

    const taskDraftsResponse = await app.request("/task-drafts");

    expect(taskDraftsResponse.status).toBe(200);
    await expect(taskDraftsResponse.json()).resolves.toEqual({ taskDrafts: [] });
  });

  it("uses a configured planner to create task drafts from a requirement", async () => {
    const app = createPlanningApp();
    await configureModel(app);

    const workflowResponse = await app.request("/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: requirement
nodes:
  - id: split
    type: task-drafting
    executor: skill:requirements
    exit:
      maxRetries: 1
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const workflowBody = (await workflowResponse.json()) as {
      workflowFile: { id: string };
    };

    const response = await app.request("/requirements", {
      body: JSON.stringify({
        body: "Build the minimum Requirement to Task flow.",
        title: "Generate tasks",
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      requirement: {
        status: "open",
        title: "Generate tasks"
      },
      taskDrafts: [
        {
          sortOrder: 0,
          title: "Task: Generate tasks"
        }
      ]
    });
  });

  it("marks the requirement failed when the selected workflow is not requirement-scoped", async () => {
    const app = createPlanningApp();
    await configureModel(app);

    const workflowResponse = await app.request("/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Task workflow
scope: task
nodes:
  - id: implement
    type: coding
    executor: skill:code
    exit:
      maxRetries: 1
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const workflowBody = (await workflowResponse.json()) as {
      workflowFile: { id: string };
    };

    const response = await app.request("/requirements", {
      body: JSON.stringify({
        body: "This should fail.",
        title: "Wrong workflow",
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      requirement: {
        status: "failed"
      },
      error: expect.stringMatching(/requirement-scoped/i)
    });
  });

  it("soft deletes a requirement and its generated tasks", async () => {
    const app = createPlanningApp();
    await configureModel(app);

    const workflowResponse = await app.request("/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: requirement
nodes:
  - id: split
    type: task-drafting
    executor: skill:requirements
    exit:
      maxRetries: 1
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const workflowBody = (await workflowResponse.json()) as {
      workflowFile: { id: string };
    };
    const requirementResponse = await app.request("/requirements", {
      body: JSON.stringify({
        body: "Create work then remove it.",
        title: "Disposable requirement",
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const requirementBody = (await requirementResponse.json()) as {
      requirement: { id: string };
      taskDrafts: [{ id: string }];
    };

    await app.request(`/task-drafts/${requirementBody.taskDrafts[0].id}/approve`, {
      method: "POST"
    });

    const deleteResponse = await app.request(
      `/requirements/${requirementBody.requirement.id}`,
      {
        method: "DELETE"
      }
    );

    expect(deleteResponse.status).toBe(204);
    await expect((await app.request("/requirements")).json()).resolves.toEqual({
      requirements: []
    });
    await expect((await app.request("/tasks")).json()).resolves.toEqual({
      tasks: []
    });
  });
});

describe("Task Draft approval API", () => {
  async function createDraft(app: ReturnType<typeof createApp>) {
    const workflowResponse = await app.request("/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: requirement
nodes:
  - id: split
    type: task-drafting
    executor: skill:requirements
    exit:
      maxRetries: 1
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const workflowBody = (await workflowResponse.json()) as {
      workflowFile: { id: string };
    };
    const requirementResponse = await app.request("/requirements", {
      body: JSON.stringify({
        body: "Turn this into a task.",
        title: "Approve this draft",
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    return (await requirementResponse.json()) as {
      taskDrafts: [{ id: string; requirementId: string }];
    };
  }

  it("edits, reorders, deletes and approves task drafts into tasks", async () => {
    const app = createPlanningApp();
    await configureModel(app);
    const created = await createDraft(app);
    const draftId = created.taskDrafts[0].id;

    const updateResponse = await app.request(`/task-drafts/${draftId}`, {
      body: JSON.stringify({
        body: "Updated body",
        title: "Updated title"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "PATCH"
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      body: "Updated body",
      title: "Updated title"
    });

    const reorderResponse = await app.request("/task-drafts/reorder", {
      body: JSON.stringify({
        order: [{ id: draftId, sortOrder: 3 }]
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(reorderResponse.status).toBe(200);
    await expect(reorderResponse.json()).resolves.toMatchObject({
      taskDrafts: [
        {
          id: draftId,
          sortOrder: 3
        }
      ]
    });

    const approveResponse = await app.request(`/task-drafts/${draftId}/approve`, {
      method: "POST"
    });

    expect(approveResponse.status).toBe(201);
    await expect(approveResponse.json()).resolves.toMatchObject({
      task: {
        requirementId: created.taskDrafts[0].requirementId,
        status: "todo",
        title: "Updated title"
      }
    });

    const tasksResponse = await app.request("/tasks");

    expect(tasksResponse.status).toBe(200);
    await expect(tasksResponse.json()).resolves.toMatchObject({
      tasks: [
        {
          requirementId: created.taskDrafts[0].requirementId,
          status: "todo",
          title: "Updated title"
        }
      ]
    });

    const secondCreated = await createDraft(app);
    const deleteResponse = await app.request(
      `/task-drafts/${secondCreated.taskDrafts[0].id}`,
      {
        method: "DELETE"
      }
    );

    expect(deleteResponse.status).toBe(204);
  });
});

describe("Workflow Run API", () => {
  async function createTask(app: ReturnType<typeof createApp>) {
    const workflowResponse = await app.request("/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: requirement
nodes:
  - id: split
    type: task-drafting
    executor: skill:requirements
    exit:
      maxRetries: 1
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const workflowBody = (await workflowResponse.json()) as {
      workflowFile: { id: string };
    };
    const requirementResponse = await app.request("/requirements", {
      body: JSON.stringify({
        body: "Turn this into a task.",
        title: "Run this task",
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const requirementBody = (await requirementResponse.json()) as {
      taskDrafts: [{ id: string }];
    };
    const approveResponse = await app.request(
      `/task-drafts/${requirementBody.taskDrafts[0].id}/approve`,
      {
        method: "POST"
      }
    );

    return (await approveResponse.json()) as {
      task: { id: string };
    };
  }

  it("starts a task workflow run by enqueueing nodes through the configured Agent proxy", async () => {
    const agentProxyRequests: unknown[] = [];
    const app = createPlanningApp({
      agentProxyClient: async (input) => {
        agentProxyRequests.push(input);
      }
    });
    await configureModel(app);
    const createdTask = await createTask(app);
    await app.request("/execution-settings", {
      body: JSON.stringify({
        agentProxyUrl: "http://127.0.0.1:8787"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "PATCH"
    });
    const taskWorkflowResponse = await app.request("/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Task implementation
scope: task
nodes:
  - id: plan
    type: planning
    executor: skill:plan
    exit:
      maxRetries: 1
  - id: code
    type: coding
    after: plan
    executor: skill:code
    exit:
      maxRetries: 1
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const taskWorkflowBody = (await taskWorkflowResponse.json()) as {
      workflowFile: { id: string };
    };

    const response = await app.request(
      `/tasks/${createdTask.task.id}/workflow-runs`,
      {
        body: JSON.stringify({
          workflowFileId: taskWorkflowBody.workflowFile.id
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      nodeRuns: [
        {
          nodeId: "plan",
          status: "queued"
        },
        {
          dependsOn: ["plan"],
          nodeId: "code",
          status: "queued"
        }
      ],
      workflowRun: {
        status: "running",
        taskId: createdTask.task.id,
        workflowFileId: taskWorkflowBody.workflowFile.id
      }
    });
    expect(agentProxyRequests).toHaveLength(1);

    const runsResponse = await app.request(
      `/tasks/${createdTask.task.id}/workflow-runs`
    );

    expect(runsResponse.status).toBe(200);
    await expect(runsResponse.json()).resolves.toMatchObject({
      workflowRuns: [
        {
          workflowRun: {
            status: "running"
          },
          nodeRuns: [
            {
              nodeId: "plan",
              status: "queued"
            },
            {
              nodeId: "code",
              status: "queued"
            }
          ]
        }
      ]
    });
  });

  it("rejects workflow run starts until a local Agent proxy is configured", async () => {
    const app = createPlanningApp();
    await configureModel(app);
    const createdTask = await createTask(app);
    const taskWorkflowResponse = await app.request("/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Task implementation
scope: task
nodes:
  - id: plan
    type: planning
    executor: skill:plan
    exit:
      maxRetries: 1
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const taskWorkflowBody = (await taskWorkflowResponse.json()) as {
      workflowFile: { id: string };
    };

    const response = await app.request(
      `/tasks/${createdTask.task.id}/workflow-runs`,
      {
        body: JSON.stringify({
          workflowFileId: taskWorkflowBody.workflowFile.id
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/Agent proxy/i)
    });
  });

  it("rejects non task-scoped workflow files", async () => {
    const app = createPlanningApp();
    await configureModel(app);
    const createdTask = await createTask(app);
    const requirementWorkflowResponse = await app.request("/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement workflow
scope: requirement
nodes:
  - id: split
    type: task-drafting
    executor: skill:requirements
    exit:
      maxRetries: 1
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const requirementWorkflowBody = (await requirementWorkflowResponse.json()) as {
      workflowFile: { id: string };
    };

    const response = await app.request(
      `/tasks/${createdTask.task.id}/workflow-runs`,
      {
        body: JSON.stringify({
          workflowFileId: requirementWorkflowBody.workflowFile.id
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/task-scoped/i)
    });
  });

  it("rejects workflow runs for missing tasks", async () => {
    const app = createApp();
    const taskWorkflowResponse = await app.request("/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Task implementation
scope: task
nodes:
  - id: plan
    type: planning
    executor: skill:plan
    exit:
      maxRetries: 1
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const taskWorkflowBody = (await taskWorkflowResponse.json()) as {
      workflowFile: { id: string };
    };

    const startResponse = await app.request("/tasks/tsk_missing/workflow-runs", {
      body: JSON.stringify({
        workflowFileId: taskWorkflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(startResponse.status).toBe(404);
    await expect(startResponse.json()).resolves.toMatchObject({
      error: "Task not found"
    });

    const listResponse = await app.request("/tasks/tsk_missing/workflow-runs");

    expect(listResponse.status).toBe(404);
    await expect(listResponse.json()).resolves.toMatchObject({
      error: "Task not found"
    });
  });
});
