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
    requirementPlanner: async ({ requirement }) => ({
      items: [
        {
          body: `Planned from requirement: ${requirement.body}`,
          sortOrder: 0,
          title: `Task: ${requirement.title}`
        }
      ],
      summary: `Split ${requirement.title} into executable tasks.`
    }),
    ...options
  });
}

async function createDecompositionResultForRequirement(
  app: ReturnType<typeof createApp>,
  requirementId: string
) {
  const response = await app.request(
    `/api/requirements/${requirementId}/decomposition-result`,
    {
      method: "POST"
    }
  );

  return (await response.json()) as {
    decompositionResult: { id: string; requirementId: string };
    requirement: { id: string; status: string };
  };
}

async function generateTasksFromDecompositionResult(
  app: ReturnType<typeof createApp>,
  decompositionResultId: string
) {
  const response = await app.request(
    `/api/decomposition-results/${decompositionResultId}/generate-tasks`,
    {
      method: "POST"
    }
  );

  return (await response.json()) as {
    tasks: Array<{ id: string; projectId: string | null; requirementId: string }>;
  };
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
  it("updates model and local execution settings without returning the API key", async () => {
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
version: "1.1"
nodes:
  - id: analyze
    type: requirement-analysis
    executor: skill:requirements
    outputs:
      - kind: file
        ref: analysis.md
    exit:
      maxRetries: 2
  - id: implement
    type: coding
    dependsOn: analyze
    executor: skill:code
    outputs:
      - kind: file
        ref: diff.patch
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
      }
    });

    const listResponse = await app.request("/api/workflow-files");

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      workflowFiles: [
        {
          name: "Coding workflow",
          nodeCount: 2,
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
      - artifact: plan
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
version: "1.1"
nodes:
  - id: implement
    type: coding
    executor: skill:code
    outputs:
      - kind: file
        ref: diff.patch
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
version: "1.1"
nodes:
  - id: implement
    type: coding
    executor: skill:code
    outputs:
      - kind: file
        ref: diff.patch
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

  it("deletes duplicate known base Workflow templates by semantic meaning", async () => {
    const app = createApp();
    const source = (name: string, nodeIds: string[]) => `
name: ${name}
scope: task
version: "1.1"
nodes:
${nodeIds
  .map(
    (nodeId, index) => `  - id: ${nodeId}
    type: ${index === 0 ? "implementation-plan" : "code-change"}
    ${index === 0 ? "" : `dependsOn: ${nodeIds[index - 1]}\n    `}executor: agent:planner
    outputs:
      - kind: file
        ref: ${nodeId}.md
    exit:
      maxRetries: 1`
  )
  .join("\n")}
`;

    await app.request("/api/workflow-files/import", {
      body: JSON.stringify({ source: source("Code Implementation", ["plan"]) }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: source("Software Change Task", [
          "intake",
          "decompose",
          "risk-review",
          "package"
        ])
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: source("Software Change Task", ["split-again"])
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });

    const listResponse = await app.request("/api/workflow-files");
    const listBody = (await listResponse.json()) as {
      workflowFiles: Array<{
        name: string;
        nodeCount: number;
        templateType: string;
      }>;
    };

    expect(listResponse.status).toBe(200);
    expect(listBody.workflowFiles).toHaveLength(1);
    expect(listBody.workflowFiles[0]).toMatchObject({
      name: "代码编写模板",
      nodeCount: 4,
      templateType: "builtin"
    });

    const secondListBody = (await (
      await app.request("/api/workflow-files")
    ).json()) as {
      workflowFiles: Array<{ name: string }>;
    };

    expect(secondListBody.workflowFiles).toHaveLength(1);
  });

  it("marks imported Workflow templates as custom unless the caller selects a built-in template", async () => {
    const app = createApp();
    const source = `
name: Custom writing flow
scope: task
version: "1.1"
nodes:
  - id: draft
    type: writing
    executor: agent:writer
    outputs:
      - kind: file
        ref: draft.md
    exit:
      maxRetries: 1
`;

    const customResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({ source }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const builtinResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({ source, templateType: "builtin" }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });

    await expect(customResponse.json()).resolves.toMatchObject({
      workflowFile: { templateType: "custom" }
    });
    await expect(builtinResponse.json()).resolves.toMatchObject({
      workflowFile: { templateType: "builtin" }
    });
  });

  it("renames the autonomous travel guide test Workflow template by concrete purpose", async () => {
    const app = createApp();

    await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: 自主测试任务完成
scope: task
version: "1.1"
nodes:
  - id: write_travel_guide
    type: coding
    executor: agent:autonomous-test-agent
    outputs:
      - kind: file
        ref: travel-guide.md
    exit:
      maxRetries: 1
`
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });

    const listResponse = await app.request("/api/workflow-files");
    const listBody = (await listResponse.json()) as {
      workflowFiles: Array<{ definition: string; name: string; nodeCount: number }>;
    };

    expect(listResponse.status).toBe(200);
    expect(listBody.workflowFiles).toHaveLength(1);
    expect(listBody.workflowFiles[0]).toMatchObject({
      name: "旅行指南编写测试模板",
      nodeCount: 1
    });
    expect(JSON.parse(listBody.workflowFiles[0].definition)).toMatchObject({
      name: "旅行指南编写测试模板",
      nodes: [
        expect.objectContaining({
          id: "write_travel_guide",
          type: "coding"
        })
      ],
    });
  });

  it("returns a clear validation error for invalid workflow files", async () => {
    const app = createApp();

    const response = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Bad workflow
scope: task
version: "1.1"
nodes:
  - id: implement
    type: coding
    dependsOn: missing
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
  async function importRequirementWorkflow(app: ReturnType<typeof createApp>) {
    const workflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
version: "1.1"
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

    return workflowBody.workflowFile;
  }

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
    const workflowFile = await importRequirementWorkflow(app);

    const response = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Write a Ningbo travel guide.",
        projectId: project.id,
        title: "Ningbo guide",
        workflowFileId: workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = (await response.json()) as {
      requirement: { id: string; projectId: string; status: string };
    };
    const decompositionBody = await createDecompositionResultForRequirement(
      app,
      body.requirement.id
    );
    const generatedBody = await generateTasksFromDecompositionResult(
      app,
      decompositionBody.decompositionResult.id
    );

    expect(response.status).toBe(201);
    expect(body.requirement).toMatchObject({
      projectId: project.id,
      status: "init"
    });
    expect(decompositionBody.decompositionResult.requirementId).toBe(
      body.requirement.id
    );
    expect(decompositionBody.requirement.status).toBe("ready_to_generate_tasks");
    expect(generatedBody).toMatchObject({
      tasks: [
        {
          projectId: project.id,
          requirementId: body.requirement.id,
          status: "init"
        }
      ]
    });
  });

  it("saves a requirement and fails decomposition when the model is not configured", async () => {
    const app = createApp();
    const workflowFile = await importRequirementWorkflow(app);

    const response = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Build the minimum Requirement to decomposition result flow.",
        title: "Generate decomposition result",
        workflowFileId: workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = (await response.json()) as {
      decompositionResult: null;
      requirement: { id: string };
    };

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      decompositionResult: null,
      requirement: {
        body: "Build the minimum Requirement to decomposition result flow.",
        status: "init",
        title: "Generate decomposition result",
        workflowFileId: workflowFile.id
      }
    });

    const decompositionResponse = await app.request(
      `/api/requirements/${body.requirement.id}/decomposition-result`,
      {
        method: "POST"
      }
    );

    expect(decompositionResponse.status).toBe(400);
    await expect(decompositionResponse.json()).resolves.toMatchObject({
      decompositionResult: null,
      requirement: {
        status: "decomposition_failed"
      }
    });
  });

  it("creates an editable decomposition result for a saved requirement", async () => {
    const app = createPlanningApp();
    const workflowFile = await importRequirementWorkflow(app);
    const requirementResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Write a research report about LLM Wiki.",
        title: "LLM Wiki research report",
        workflowFileId: workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const requirementBody = (await requirementResponse.json()) as {
      decompositionResult: null;
      requirement: { id: string };
    };

    await configureModel(app);

    const planResponse = await app.request(
      `/api/requirements/${requirementBody.requirement.id}/decomposition-result`,
      {
        method: "POST"
      }
    );

    expect(requirementResponse.status).toBe(201);
    expect(requirementBody.decompositionResult).toBeNull();
    expect(planResponse.status).toBe(201);
    await expect(planResponse.json()).resolves.toMatchObject({
      decompositionResult: {
        items: [
          {
            body: "Planned from requirement: Write a research report about LLM Wiki.",
            sortOrder: 0,
            title: "Task: LLM Wiki research report"
          }
        ],
        requirementId: requirementBody.requirement.id,
        summary: "Split LLM Wiki research report into executable tasks."
      },
      requirement: {
        id: requirementBody.requirement.id,
        status: "ready_to_generate_tasks"
      }
    });
    await expect(
      (await app.request("/api/decomposition-results")).json()
    ).resolves.toMatchObject({
      decompositionResults: [
        {
          requirementId: requirementBody.requirement.id,
          summary: "Split LLM Wiki research report into executable tasks."
        }
      ]
    });
  });

  it("soft deletes a requirement and its generated tasks", async () => {
    const app = createPlanningApp();
    await configureModel(app);
    const workflowFile = await importRequirementWorkflow(app);
    const requirementResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Create work then remove it.",
        title: "Disposable requirement",
        workflowFileId: workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const requirementBody = (await requirementResponse.json()) as {
      requirement: { id: string };
    };
    const decompositionBody = await createDecompositionResultForRequirement(
      app,
      requirementBody.requirement.id
    );

    await generateTasksFromDecompositionResult(
      app,
      decompositionBody.decompositionResult.id
    );

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
    const workflowFile = await importRequirementWorkflow(app);
    const firstResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "First requirement.",
        projectId: project.id,
        title: "Original requirement",
        workflowFileId: workflowFile.id
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
        workflowFileId: workflowFile.id
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

describe("Decomposition Result API", () => {
  async function createResult(
    app: ReturnType<typeof createApp>,
    title = "Generate this task"
  ) {
    const workflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
version: "1.1"
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
        body: "Turn this into tasks.",
        title,
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const requirementBody = (await requirementResponse.json()) as {
      requirement: { id: string };
    };

    return createDecompositionResultForRequirement(
      app,
      requirementBody.requirement.id
    );
  }

  it("edits a decomposition result and generates init tasks once", async () => {
    const app = createPlanningApp();
    await configureModel(app);
    const created = await createResult(app);

    const updateResponse = await app.request(
      `/api/decomposition-results/${created.decompositionResult.id}`,
      {
        body: JSON.stringify({
          summary: "Updated split",
          tasks: [
            {
              body: "Updated body",
              title: "Updated title"
            },
            {
              body: "Second body",
              title: "Second task"
            }
          ]
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "PATCH"
      }
    );

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      decompositionResult: {
        items: [
          {
            body: "Updated body",
            sortOrder: 0,
            title: "Updated title"
          },
          {
            body: "Second body",
            sortOrder: 1,
            title: "Second task"
          }
        ],
        summary: "Updated split"
      }
    });

    const generateResponse = await app.request(
      `/api/decomposition-results/${created.decompositionResult.id}/generate-tasks`,
      {
        method: "POST"
      }
    );

    expect(generateResponse.status).toBe(201);
    await expect(generateResponse.json()).resolves.toMatchObject({
      requirement: {
        status: "tasks_generated"
      },
      tasks: [
        {
          requirementId: created.decompositionResult.requirementId,
          status: "init",
          title: "Updated title"
        },
        {
          requirementId: created.decompositionResult.requirementId,
          status: "init",
          title: "Second task"
        }
      ]
    });

    const duplicateResponse = await app.request(
      `/api/decomposition-results/${created.decompositionResult.id}/generate-tasks`,
      {
        method: "POST"
      }
    );

    expect(duplicateResponse.status).toBe(409);
  });
});

describe("Task Workflow API", () => {
  async function createTask(app: ReturnType<typeof createApp>) {
    const workflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
version: "1.1"
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
      requirement: { id: string };
    };
    const decompositionBody = await createDecompositionResultForRequirement(
      app,
      requirementBody.requirement.id
    );
    const generatedBody = await generateTasksFromDecompositionResult(
      app,
      decompositionBody.decompositionResult.id
    );

    return { task: generatedBody.tasks[0] };
  }

  it("starts a task workflow run by enqueueing nodes through the configured local executor", async () => {
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
version: "1.1"
nodes:
  - id: plan
    type: planning
    executor: skill:plan
    exit:
      maxRetries: 1
  - id: code
    type: coding
    dependsOn: plan
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

  it("rejects task workflow starts until local execution is configured", async () => {
    const app = createPlanningApp();
    await configureModel(app);
    const createdTask = await createTask(app);
    const taskWorkflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Task implementation
scope: task
version: "1.1"
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
      error: expect.stringMatching(/local bridge/i)
    });
  });

  it("queues task workflow work for an online local bridge", async () => {
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
version: "1.1"
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

  it("updates Node Run state when a local bridge completes a job", async () => {
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
version: "1.1"
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

  it("rejects importing legacy requirement-scoped workflow files", async () => {
    const app = createPlanningApp();

    const requirementWorkflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement workflow
scope: requirement
version: "1.1"
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

    expect(requirementWorkflowResponse.status).toBe(400);
    await expect(requirementWorkflowResponse.json()).resolves.toMatchObject({
      error: "Requirement-scoped Workflow Files are no longer supported"
    });
  });

  it("rejects workflow runs for missing tasks", async () => {
    const app = createApp();
    const taskWorkflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Task implementation
scope: task
version: "1.1"
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
