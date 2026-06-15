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
  await app.request("/api/execution-settings", {
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

describe("GET /api/health", () => {
  it("returns the Forge server health payload", async () => {
    const app = createApp();
    const response = await app.request("/api/health");

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
    const apiResponse = await app.request("/api/projects/missing");

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

  it("does not fall back to the Web console for unknown API routes", async () => {
    const webAssetsRoot = await createWebAssetsRoot({
      "index.html": "<html><body>Forge Web</body></html>"
    });
    const app = createApp({ webAssetsRoot });

    const response = await app.request("/api/projects/missing");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "API route not found" });

    const namespaceResponse = await app.request("/api");

    expect(namespaceResponse.status).toBe(404);
    await expect(namespaceResponse.json()).resolves.toEqual({
      error: "API route not found"
    });
  });
});

describe("Project API", () => {
  it("creates and lists projects", async () => {
    const app = createApp();

    const createResponse = await app.request("/api/projects", {
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

    const listResponse = await app.request("/api/projects");

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

    const response = await app.request("/api/projects", {
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

  it("rejects duplicate project names", async () => {
    const app = createApp();

    await app.request("/api/projects", {
      body: JSON.stringify({
        name: "自主测试"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const response = await app.request("/api/projects", {
      body: JSON.stringify({
        name: "自主测试"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/already exists/i)
    });
  });

  it("updates project names", async () => {
    const app = createApp();

    const createResponse = await app.request("/api/projects", {
      body: JSON.stringify({
        name: "Forge"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const project = await createResponse.json();

    const updateResponse = await app.request(`/api/projects/${project.id}`, {
      body: JSON.stringify({
        name: "Forge Ops"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "PATCH"
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      id: project.id,
      name: "Forge Ops"
    });

    const listResponse = await app.request("/api/projects");

    await expect(listResponse.json()).resolves.toMatchObject({
      projects: [
        {
          id: project.id,
          name: "Forge Ops"
        }
      ]
    });
  });
});

describe("Execution settings API", () => {
  it("updates model and local Agent proxy settings without returning the API key", async () => {
    const app = createApp();

    const updateResponse = await app.request("/api/execution-settings", {
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

    const response = await app.request("/api/execution-settings");
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

  it("accepts dedicated model providers for model planning", async () => {
    const app = createApp();

    const updateResponse = await app.request("/api/execution-settings", {
      body: JSON.stringify({
        modelApiKey: "anthropic-key",
        modelName: "claude-sonnet-4-20250514",
        modelProvider: "anthropic"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "PATCH"
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      executionSettings: {
        modelBaseUrl: "https://api.anthropic.com/v1",
        modelConfigured: true,
        modelName: "claude-sonnet-4-20250514",
        modelProvider: "anthropic"
      }
    });

    const response = await app.request("/api/execution-settings");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      executionSettings: {
        modelProvider: "anthropic"
      }
    });
  });

  it("tests model API settings without persisting the API key", async () => {
    const calls: unknown[] = [];
    const app = createApp({
      modelApiTester: async (settings) => {
        calls.push(settings);
      }
    });

    const response = await app.request("/api/execution-settings/model/test", {
      body: JSON.stringify({
        modelApiKey: "test-key",
        modelBaseUrl: "https://api.anthropic.com/v1",
        modelName: "claude-sonnet-4-20250514",
        modelProvider: "anthropic"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(calls).toMatchObject([
      {
        modelApiKey: "test-key",
        modelBaseUrl: "https://api.anthropic.com/v1",
        modelName: "claude-sonnet-4-20250514",
        modelProvider: "anthropic"
      }
    ]);

    const settingsResponse = await app.request("/api/execution-settings");
    const settingsBody = await settingsResponse.json();

    expect(JSON.stringify(settingsBody)).not.toContain("test-key");
    expect(settingsBody).toMatchObject({
      executionSettings: {
        modelConfigured: false
      }
    });
  });

  it("preserves the configured model API key when settings are saved with an empty key field", async () => {
    const app = createApp();

    await app.request("/api/execution-settings", {
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

    const updateResponse = await app.request("/api/execution-settings", {
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

    const response = await app.request("/api/execution-settings");
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

    const response = await app.request("/api/workflow-files/import", {
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

    const listResponse = await app.request("/api/workflow-files");

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

  it("imports and persists normalized v1.1 workflow files", async () => {
    const app = createApp();

    const response = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Rich workflow
scope: task
version: "1.1"
inputs:
  - id: task
    type: task
    required: true
skills:
  - id: planning
    ref: skill:implementation-planning
agents:
  - id: planner
    role: implementation-planner
artifacts:
  - id: plan
    type: markdown
    path: plan.md
nodes:
  - id: plan
    type: implementation-plan
    executor: agent:planner
    uses:
      - skill:planning
    inputs:
      - task
    instruction:
      text: Write a scoped implementation plan.
    outputs:
      - artifact:plan
    exit:
      maxRetries: 1
      review: human
      criteria:
        - Plan is scoped to the Task.
      retryInstruction: Revise the plan to close missing scope gaps.
    humanReview:
      required: true
      reason: Confirm the plan before execution.
`
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body.workflow).toMatchObject({
      agents: [{ id: "planner", role: "implementation-planner" }],
      artifacts: [{ id: "plan", path: "plan.md", type: "markdown" }],
      inputs: [{ id: "task", required: true, type: "task" }],
      name: "Rich workflow",
      scope: "task",
      skills: [{ id: "planning", ref: "skill:implementation-planning" }],
      version: "1.1",
      nodes: [
        {
          exit: {
            criteria: ["Plan is scoped to the Task."],
            maxRetries: 1,
            retryInstruction: "Revise the plan to close missing scope gaps.",
            review: "human"
          },
          humanReview: {
            reason: "Confirm the plan before execution.",
            required: true
          },
          id: "plan",
          inputs: ["task"],
          instruction: { text: "Write a scoped implementation plan." },
          outputs: [{ artifact: "plan" }],
          uses: ["skill:planning"]
        }
      ]
    });
    expect(body.workflowFile).toMatchObject({
      name: "Rich workflow",
      nodeCount: 1,
      scope: "task"
    });
    expect(JSON.parse(body.workflowFile.definition)).toMatchObject({
      version: "1.1",
      nodes: [
        {
          outputs: [{ artifact: "plan" }]
        }
      ]
    });
  });

  it("deduplicates workflow names when importing repeated workflow files", async () => {
    const app = createApp();
    const source = `
name: Coding workflow
scope: task
nodes:
  - id: implement
    type: coding
    executor: skill:code
    outputs:
      - diff.patch
    exit:
      maxRetries: 1
`;

    const firstResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({ source }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const secondResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({ source }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    await expect(firstResponse.json()).resolves.toMatchObject({
      workflow: { name: "Coding workflow" },
      workflowFile: { name: "Coding workflow" }
    });
    await expect(secondResponse.json()).resolves.toMatchObject({
      workflow: { name: "Coding workflow 2" },
      workflowFile: { name: "Coding workflow 2" }
    });
  });

  it("renames workflow files and deduplicates conflicting names", async () => {
    const app = createApp();
    const source = (name: string) => `
name: ${name}
scope: task
nodes:
  - id: implement
    type: coding
    executor: skill:code
    outputs:
      - diff.patch
    exit:
      maxRetries: 1
`;
    const firstResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({ source: source("Code workflow") }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const secondResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({ source: source("Review workflow") }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const firstBody = (await firstResponse.json()) as {
      workflowFile: { id: string };
    };
    const secondBody = (await secondResponse.json()) as {
      workflowFile: { id: string };
    };

    const renameResponse = await app.request(
      `/api/workflow-files/${firstBody.workflowFile.id}`,
      {
        body: JSON.stringify({ name: "Review workflow" }),
        headers: {
          "content-type": "application/json"
        },
        method: "PATCH"
      }
    );

    expect(renameResponse.status).toBe(200);
    await expect(renameResponse.json()).resolves.toMatchObject({
      workflowFile: {
        id: firstBody.workflowFile.id,
        name: "Review workflow 2"
      }
    });
    await expect((await app.request("/api/workflow-files")).json()).resolves.toMatchObject({
      workflowFiles: expect.arrayContaining([
        expect.objectContaining({
          id: firstBody.workflowFile.id,
          name: "Review workflow 2"
        }),
        expect.objectContaining({
          id: secondBody.workflowFile.id,
          name: "Review workflow"
        })
      ])
    });
  });

  it("returns a clear validation error for invalid workflow files", async () => {
    const app = createApp();

    const response = await app.request("/api/workflow-files/import", {
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
  it("keeps generated work associated with the selected Project", async () => {
    const app = createPlanningApp();
    await configureModel(app);

    const projectResponse = await app.request("/api/projects", {
      body: JSON.stringify({
        artifactStorageMode: "local-only",
        dbStrategy: "sqlite",
        name: "Autonomous Test"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const project = (await projectResponse.json()) as { id: string };
    const workflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
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

    const response = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Write a Ningbo travel guide.",
        projectId: project.id,
        title: "Ningbo guide",
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = (await response.json()) as {
      requirement: { projectId: string };
      taskDrafts: Array<{ id: string; projectId: string }>;
    };
    const approveResponse = await app.request(
      `/api/task-drafts/${body.taskDrafts[0].id}/approve`,
      {
        method: "POST"
      }
    );

    expect(response.status).toBe(201);
    expect(body.requirement.projectId).toBe(project.id);
    expect(body.taskDrafts[0].projectId).toBe(project.id);
    expect(approveResponse.status).toBe(201);
    await expect(approveResponse.json()).resolves.toMatchObject({
      task: {
        projectId: project.id,
        requirementId: expect.any(String)
      }
    });
  });

  it("saves a requirement without generating tasks when the model is not configured", async () => {
    const app = createApp();

    const workflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
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

    const response = await app.request("/api/requirements", {
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

    const taskDraftsResponse = await app.request("/api/task-drafts");

    expect(taskDraftsResponse.status).toBe(200);
    await expect(taskDraftsResponse.json()).resolves.toEqual({ taskDrafts: [] });
  });

  it("plans task drafts for a saved requirement after model configuration", async () => {
    const app = createPlanningApp();

    const workflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
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
    const requirementResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Write a research report about LLM Wiki.",
        title: "LLM Wiki research report",
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const requirementBody = (await requirementResponse.json()) as {
      requirement: { id: string };
      taskDrafts: [];
    };

    await configureModel(app);

    const planResponse = await app.request(
      `/api/requirements/${requirementBody.requirement.id}/task-drafts`,
      {
        method: "POST"
      }
    );

    expect(requirementResponse.status).toBe(201);
    expect(requirementBody.taskDrafts).toEqual([]);
    expect(planResponse.status).toBe(201);
    await expect(planResponse.json()).resolves.toMatchObject({
      requirement: {
        id: requirementBody.requirement.id,
        status: "open"
      },
      taskDrafts: [
        {
          requirementId: requirementBody.requirement.id,
          sortOrder: 0,
          title: "Task: LLM Wiki research report"
        }
      ]
    });
    await expect((await app.request("/api/task-drafts")).json()).resolves.toMatchObject({
      taskDrafts: [
        {
          requirementId: requirementBody.requirement.id,
          title: "Task: LLM Wiki research report"
        }
      ]
    });
  });

  it("uses a configured planner to create task drafts from a requirement", async () => {
    const app = createPlanningApp();
    await configureModel(app);

    const workflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
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

    const response = await app.request("/api/requirements", {
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

  it("plans requirement task drafts with a task-scoped workflow file", async () => {
    const app = createPlanningApp();
    await configureModel(app);

    const workflowResponse = await app.request("/api/workflow-files/import", {
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

    const response = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "This should create draft work.",
        title: "Generate tasks from task workflow",
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
        title: "Generate tasks from task workflow"
      },
      taskDrafts: [
        {
          title: "Task: Generate tasks from task workflow"
        }
      ]
    });
  });

  it("soft deletes a requirement and its generated tasks", async () => {
    const app = createPlanningApp();
    await configureModel(app);

    const workflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
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
    const requirementResponse = await app.request("/api/requirements", {
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

    await app.request(`/api/task-drafts/${requirementBody.taskDrafts[0].id}/approve`, {
      method: "POST"
    });

    const deleteResponse = await app.request(
      `/api/requirements/${requirementBody.requirement.id}`,
      {
        method: "DELETE"
      }
    );

    expect(deleteResponse.status).toBe(204);
    await expect((await app.request("/api/requirements")).json()).resolves.toEqual({
      requirements: []
    });
    await expect((await app.request("/api/tasks")).json()).resolves.toEqual({
      tasks: []
    });
  });

  it("renames a requirement and rejects duplicate names in the same Project", async () => {
    const app = createApp();

    const projectResponse = await app.request("/api/projects", {
      body: JSON.stringify({
        artifactStorageMode: "local-only",
        dbStrategy: "sqlite",
        name: "Requirement Project"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const project = (await projectResponse.json()) as { id: string };
    const workflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
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
    const firstResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "First requirement.",
        projectId: project.id,
        title: "Original requirement",
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const secondResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Second requirement.",
        projectId: project.id,
        title: "Existing requirement",
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const firstBody = (await firstResponse.json()) as {
      requirement: { id: string };
    };

    const renameResponse = await app.request(
      `/api/requirements/${firstBody.requirement.id}`,
      {
        body: JSON.stringify({
          title: "Renamed requirement"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "PATCH"
      }
    );
    const duplicateResponse = await app.request(
      `/api/requirements/${firstBody.requirement.id}`,
      {
        body: JSON.stringify({
          title: "Existing requirement"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "PATCH"
      }
    );

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(renameResponse.status).toBe(200);
    await expect(renameResponse.json()).resolves.toMatchObject({
      title: "Renamed requirement"
    });
    expect(duplicateResponse.status).toBe(409);
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      error: expect.stringMatching(/already exists/i)
    });
  });
});

describe("Task Draft approval API", () => {
  async function createDraft(
    app: ReturnType<typeof createApp>,
    title = "Approve this draft"
  ) {
    const workflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
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
    const requirementResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Turn this into a task.",
        title,
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

    const updateResponse = await app.request(`/api/task-drafts/${draftId}`, {
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

    const reorderResponse = await app.request("/api/task-drafts/reorder", {
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

    const approveResponse = await app.request(`/api/task-drafts/${draftId}/approve`, {
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

    const tasksResponse = await app.request("/api/tasks");

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

    const secondCreated = await createDraft(app, "Delete this draft");
    const deleteResponse = await app.request(
      `/api/task-drafts/${secondCreated.taskDrafts[0].id}`,
      {
        method: "DELETE"
      }
    );

    expect(deleteResponse.status).toBe(204);
  });
});

describe("Workflow Run API", () => {
  async function createTask(app: ReturnType<typeof createApp>) {
    const workflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
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
    const requirementResponse = await app.request("/api/requirements", {
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
      `/api/task-drafts/${requirementBody.taskDrafts[0].id}/approve`,
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
    await app.request("/api/execution-settings", {
      body: JSON.stringify({
        agentProxyUrl: "http://127.0.0.1:8787"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "PATCH"
    });
    const taskWorkflowResponse = await app.request("/api/workflow-files/import", {
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
      `/api/tasks/${createdTask.task.id}/workflow-runs`,
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
      `/api/tasks/${createdTask.task.id}/workflow-runs`
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
    const taskWorkflowResponse = await app.request("/api/workflow-files/import", {
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
      `/api/tasks/${createdTask.task.id}/workflow-runs`,
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

  it("queues Workflow Run work for an online Bridge when no temporary Agent proxy is configured", async () => {
    const app = createPlanningApp();
    await configureModel(app);
    const createdTask = await createTask(app);

    const registerResponse = await app.request("/api/bridges/register", {
      body: JSON.stringify({
        agents: [
          {
            command: "coco run",
            connector: "cli",
            name: "coco"
          }
        ],
        bridgeId: "bridge_local"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(registerResponse.status).toBe(200);
    await expect(registerResponse.json()).resolves.toMatchObject({
      agents: [
        {
          connector: "cli",
          name: "coco",
          status: "online"
        }
      ],
      bridgeId: "bridge_local"
    });

    const taskWorkflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Task implementation
scope: task
nodes:
  - id: implement
    type: coding
    executor: agent:coco
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

    const runResponse = await app.request(
      `/api/tasks/${createdTask.task.id}/workflow-runs`,
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

    expect(runResponse.status).toBe(201);
    const nextJobResponse = await app.request("/api/bridges/bridge_local/jobs/next");

    expect(nextJobResponse.status).toBe(200);
    await expect(nextJobResponse.json()).resolves.toMatchObject({
      job: {
        agentName: "coco",
        nodeRun: {
          nodeId: "implement",
          status: "queued"
        },
        task: {
          id: createdTask.task.id
        }
      }
    });
  });

  it("updates Node Run state when a Bridge completes a job", async () => {
    const app = createPlanningApp();
    await configureModel(app);
    const createdTask = await createTask(app);

    await app.request("/api/bridges/register", {
      body: JSON.stringify({
        agents: [
          {
            command: "coco run",
            connector: "cli",
            name: "coco"
          }
        ],
        bridgeId: "bridge_local"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    const taskWorkflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Task implementation
scope: task
nodes:
  - id: implement
    type: coding
    executor: agent:coco
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

    await app.request(`/api/tasks/${createdTask.task.id}/workflow-runs`, {
      body: JSON.stringify({
        workflowFileId: taskWorkflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const nextJobBody = (await (
      await app.request("/api/bridges/bridge_local/jobs/next")
    ).json()) as {
      job: {
        id: string;
        workflowRun: { id: string };
      };
    };

    const completeResponse = await app.request(
      `/api/bridges/bridge_local/jobs/${nextJobBody.job.id}/complete`,
      {
        body: JSON.stringify({
          output: "done",
          status: "succeeded"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );

    expect(completeResponse.status).toBe(200);
    const runsResponse = await app.request(
      `/api/tasks/${createdTask.task.id}/workflow-runs`
    );

    await expect(runsResponse.json()).resolves.toMatchObject({
      workflowRuns: [
        {
          nodeRuns: [
            {
              nodeId: "implement",
              status: "succeeded"
            }
          ],
          workflowRun: {
            id: nextJobBody.job.workflowRun.id,
            status: "succeeded"
          }
        }
      ]
    });
  });

  it("rejects workflow runs for requirement-scoped workflow files", async () => {
    const app = createPlanningApp();
    await configureModel(app);

    const requirementWorkflowResponse = await app.request("/api/workflow-files/import", {
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
      workflowFile: { definition: string; id: string; scope: string };
    };
    const requirementResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Create a Task to validate workflow scope.",
        title: "Validate workflow scope",
        workflowFileId: requirementWorkflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const requirementBody = (await requirementResponse.json()) as {
      taskDrafts: Array<{ id: string }>;
    };
    const approveResponse = await app.request(
      `/api/task-drafts/${requirementBody.taskDrafts[0]?.id}/approve`,
      {
        method: "POST"
      }
    );
    const approveBody = (await approveResponse.json()) as {
      task: { id: string };
    };

    const runResponse = await app.request(
      `/api/tasks/${approveBody.task.id}/workflow-runs`,
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

    expect(requirementWorkflowResponse.status).toBe(201);
    expect(requirementWorkflowBody.workflowFile.scope).toBe("requirement");
    expect(JSON.parse(requirementWorkflowBody.workflowFile.definition)).toMatchObject({
      scope: "requirement"
    });
    expect(requirementResponse.status).toBe(201);
    expect(approveResponse.status).toBe(201);
    expect(runResponse.status).toBe(400);
    await expect(runResponse.json()).resolves.toMatchObject({
      error: "Selected workflow file must be task-scoped"
    });
  });

  it("rejects workflow runs for missing tasks", async () => {
    const app = createApp();
    const taskWorkflowResponse = await app.request("/api/workflow-files/import", {
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

    const startResponse = await app.request("/api/tasks/tsk_missing/workflow-runs", {
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

    const listResponse = await app.request("/api/tasks/tsk_missing/workflow-runs");

    expect(listResponse.status).toBe(404);
    await expect(listResponse.json()).resolves.toMatchObject({
      error: "Task not found"
    });
  });
});
