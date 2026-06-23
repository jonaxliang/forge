import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  createInMemoryBridgeRepository,
  createInMemoryWorkflowRunRepository,
  createInMemoryWorkflowFileRepository
} from "@forge/db";
import { buildRequirementPlanningRequest, createApp } from "./app";

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

function createZipArchiveBase64(files: Array<{ content: string; path: string }>) {
  let offset = 0;
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];

  for (const file of files) {
    const fileName = Buffer.from(file.path);
    const content = Buffer.from(file.content);
    const localHeaderOffset = offset;
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, fileName, content);
    offset += localHeader.length + fileName.length + content.length;

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localHeaderOffset, 42);
    centralParts.push(centralHeader, fileName);
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralParts.reduce(
    (total, part) => total + part.length,
    0
  );
  const endOfCentralDirectory = Buffer.alloc(22);

  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(files.length, 8);
  endOfCentralDirectory.writeUInt16LE(files.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([
    ...localParts,
    ...centralParts,
    endOfCentralDirectory
  ]).toString("base64");
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
      kind: "tasks",
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

  expect(response.status).toBe(202);
  await expect(response.json()).resolves.toMatchObject({
    decompositionResult: null,
    requirement: {
      id: requirementId,
      status: "decomposing"
    }
  });

  return waitForDecompositionResult(app, requirementId);
}

async function waitForDecompositionResult(
  app: ReturnType<typeof createApp>,
  requirementId: string
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const resultsBody = (await (
      await app.request("/api/decomposition-results")
    ).json()) as {
      decompositionResults: Array<{ id: string; requirementId: string }>;
    };
    const decompositionResult = resultsBody.decompositionResults.find(
      (result) => result.requirementId === requirementId
    );

    if (decompositionResult) {
      const requirementBody = (await (
        await app.request("/api/requirements")
      ).json()) as {
        requirements: Array<{ id: string; status: string }>;
      };

      return {
        decompositionResult,
        requirement: requirementBody.requirements.find(
          (requirement) => requirement.id === requirementId
        )!
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`Timed out waiting for decomposition result: ${requirementId}`);
}

async function waitForRequirementStatus(
  app: ReturnType<typeof createApp>,
  requirementId: string,
  status: string
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const body = (await (
      await app.request("/api/requirements")
    ).json()) as {
      requirements: Array<{ errorMessage: string | null; id: string; status: string }>;
    };
    const requirement = body.requirements.find((item) => item.id === requirementId);

    if (requirement?.status === status) {
      return requirement;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`Timed out waiting for Requirement ${status}: ${requirementId}`);
}

async function waitForTaskWorkflowRun(
  app: ReturnType<typeof createApp>,
  taskId: string,
  predicate: (run: {
    nodeRuns: Array<{ nodeId: string; status: string }>;
    workflowRun: { status: string };
  }) => boolean
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const body = (await (
      await app.request(`/api/tasks/${taskId}/workflow-runs`)
    ).json()) as {
      workflowRuns: Array<{
        nodeRuns: Array<{ nodeId: string; status: string }>;
        workflowRun: { status: string };
      }>;
    };
    const run = body.workflowRuns[0];

    if (run && predicate(run)) {
      return run;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(`Timed out waiting for Task Workflow Run: ${taskId}`);
}

async function readSseEvent(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  eventName: string
) {
  const decoder = new TextDecoder();
  let buffer = "";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const chunk = await Promise.race([
      reader.read(),
      new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => {
        setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}`)), 50);
      })
    ]);

    if (chunk.done) {
      throw new Error(`SSE stream ended before ${eventName}`);
    }

    buffer += decoder.decode(chunk.value, { stream: true });

    const messages = buffer.split("\n\n");
    buffer = messages.pop() ?? "";

    for (const message of messages) {
      const event = message
        .split("\n")
        .find((line) => line.startsWith("event: "))
        ?.slice("event: ".length);
      const data = message
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => line.slice("data: ".length))
        .join("\n");

      if (event === eventName) {
        return JSON.parse(data) as unknown;
      }
    }
  }

  throw new Error(`Timed out waiting for ${eventName}`);
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
  it("redirects the server root to the main Web console route", async () => {
    const webAssetsRoot = await createWebAssetsRoot({
      "index.html": "<html><body><div id=\"root\">Forge Web</div></body></html>"
    });
    const app = createApp({ webAssetsRoot });

    const response = await app.request("/");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/main");
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

    const response = await app.request("/main");

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

  it("serves the forgecli release download without exposing it through the Web console fallback", async () => {
    const releaseAssetsRoot = await createWebAssetsRoot({
      "forgecli-macos-arm64/forgecli": "#!/usr/bin/env sh\necho forgecli\n"
    });
    const webAssetsRoot = await createWebAssetsRoot({
      "index.html": "<html><body>Forge Web</body></html>"
    });
    const app = createApp({ releaseAssetsRoot, webAssetsRoot });

    const downloadResponse = await app.request("/release/forgecli");
    const missingResponse = await app.request("/release/missing");

    expect(downloadResponse.status).toBe(200);
    await expect(downloadResponse.text()).resolves.toContain("echo forgecli");
    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.text()).resolves.not.toContain("Forge Web");
  });
});

describe("Project API", () => {
  it("creates and lists projects", async () => {
    const app = createApp();

    const createResponse = await app.request("/api/projects", {
      body: JSON.stringify({
        artifactStorageMode: "cloud",
        dbStrategy: "mysql",
        defaultExecutorAgentBindingId: "agb_planner",
        defaultExecutorType: "agent-binding",
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
      defaultExecutorAgentBindingId: "agb_planner",
      defaultExecutorType: "agent-binding",
      name: "Forge"
    });

    const listResponse = await app.request("/api/projects");

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      projects: [
        {
          artifactStorageMode: "cloud",
          dbStrategy: "mysql",
          defaultExecutorAgentBindingId: "agb_planner",
          defaultExecutorType: "agent-binding",
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

  it("updates project default executors", async () => {
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
        defaultExecutorAgentBindingId: "agb_planner",
        defaultExecutorType: "agent-binding"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "PATCH"
    });

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      defaultExecutorAgentBindingId: "agb_planner",
      defaultExecutorType: "agent-binding",
      id: project.id,
      name: "Forge"
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
    outputs:
      - kind: file
        ref: analysis.md
    exit:
      maxRetries: 2
  - id: implement
    type: coding
    dependsOn: analyze
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
    ${index === 0 ? "" : `dependsOn: ${nodeIds[index - 1]}\n    `}outputs:
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

  it("upgrades the autonomous travel guide test Workflow template into a prompted guide workflow", async () => {
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
      name: "旅行攻略模板",
      nodeCount: 4
    });
    expect(JSON.parse(listBody.workflowFiles[0].definition)).toMatchObject({
      name: "旅行攻略模板",
      nodes: [
        expect.objectContaining({
          id: "clarify-trip",
          instruction: expect.objectContaining({
            text: expect.stringContaining("目的地")
          })
        }),
        expect.objectContaining({
          id: "design-itinerary",
          instruction: expect.objectContaining({
            text: expect.stringContaining("每日行程")
          })
        }),
        expect.objectContaining({
          id: "localize-guide",
          instruction: expect.objectContaining({
            text: expect.stringContaining("交通")
          })
        }),
        expect.objectContaining({
          id: "polish-guide",
          instruction: expect.objectContaining({
            text: expect.stringContaining("旅行攻略")
          })
        })
      ],
    });
  });

  it("upgrades one-node travel guide Workflow templates that already use the current name", async () => {
    const app = createApp();

    await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: 旅行攻略模板
scope: task
version: "1.1"
nodes:
  - id: write_travel_guide
    type: coding
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

    const listBody = (await (
      await app.request("/api/workflow-files")
    ).json()) as {
      workflowFiles: Array<{ definition: string; name: string; nodeCount: number }>;
    };

    expect(listBody.workflowFiles[0]).toMatchObject({
      name: "旅行攻略模板",
      nodeCount: 4
    });
    expect(JSON.parse(listBody.workflowFiles[0].definition).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "clarify-trip" }),
        expect.objectContaining({ id: "design-itinerary" }),
        expect.objectContaining({ id: "localize-guide" }),
        expect.objectContaining({ id: "polish-guide" })
      ])
    );
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

describe("Skill API", () => {
  it("uploads and lists Project Skill definitions", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "forge-skills-"));
    temporaryDirectories.push(storageRoot);
    const app = createApp({ skillStorageRoot: storageRoot });

    const response = await app.request("/api/skills", {
      body: JSON.stringify({
        archive: {
          contentBase64: createZipArchiveBase64([
            {
              content:
                "---\nname: code-review\ndescription: Reviews code changes before handoff.\n---\n# Code Review\n\nReview changes for behavioral regressions.",
              path: "SKILL.md"
            }
          ]),
          name: "code-review.zip"
        },
        projectId: "proj_test"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      skill: {
        body: "# Code Review\n\nReview changes for behavioral regressions.",
        description: "Reviews code changes before handoff.",
        files: [
          {
            path: "SKILL.md"
          }
        ],
        name: "code-review",
        projectId: "proj_test",
        ref: "skill:code-review",
        storagePath: join(storageRoot, "proj_test", "code-review")
      }
    });
    await expect(
      readFile(join(storageRoot, "proj_test", "code-review", "SKILL.md"), "utf8")
    ).resolves.toContain("Review changes for behavioral regressions.");

    const listResponse = await app.request("/api/skills?projectId=proj_test");

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      skills: [
        {
          name: "code-review",
          projectId: "proj_test",
          ref: "skill:code-review",
          storagePath: join(storageRoot, "proj_test", "code-review")
        }
      ]
    });
  });

  it("lists only system and selected Project Skill definitions", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "forge-skills-"));
    temporaryDirectories.push(storageRoot);
    const app = createApp({ skillStorageRoot: storageRoot });
    const uploadSkill = (name: string, projectId?: string) =>
      app.request("/api/skills", {
        body: JSON.stringify({
          archive: {
            contentBase64: createZipArchiveBase64([
              {
                content: `---\nname: ${name}\ndescription: ${name} description.\n---\n# ${name}`,
                path: "SKILL.md"
              }
            ]),
            name: `${name}.zip`
          },
          ...(projectId ? { projectId } : {})
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      });

    await uploadSkill("system-skill");
    await uploadSkill("project-skill", "proj_test");
    await uploadSkill("other-project-skill", "proj_other");

    const projectListResponse = await app.request("/api/skills?projectId=proj_test");
    const systemListResponse = await app.request("/api/skills");

    expect(projectListResponse.status).toBe(200);
    await expect(projectListResponse.json()).resolves.toMatchObject({
      skills: [
        { name: "system-skill", projectId: null },
        { name: "project-skill", projectId: "proj_test" }
      ]
    });
    await expect(systemListResponse.json()).resolves.toMatchObject({
      skills: [{ name: "system-skill", projectId: null }]
    });
  });

  it("accepts Skill zip archives with a single top-level folder", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "forge-skills-"));
    temporaryDirectories.push(storageRoot);
    const app = createApp({ skillStorageRoot: storageRoot });

    const response = await app.request("/api/skills", {
      body: JSON.stringify({
        archive: {
          contentBase64: createZipArchiveBase64([
            {
              content:
                "---\nname: folder-skill\ndescription: Loaded from a top-level folder.\n---\n# Folder Skill",
              path: "folder-skill/SKILL.md"
            },
            {
              content: "Folder reference.",
              path: "folder-skill/references/checklist.md"
            }
          ]),
          name: "folder-skill.zip"
        },
        projectId: "proj_test"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      skill: {
        files: [
          {
            path: "SKILL.md"
          },
          {
            path: "references/checklist.md"
          }
        ],
        name: "folder-skill",
        ref: "skill:folder-skill"
      }
    });
    await expect(
      readFile(join(storageRoot, "proj_test", "folder-skill", "SKILL.md"), "utf8")
    ).resolves.toContain("Folder Skill");
  });

  it("imports Skills from GitHub directory URLs", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "forge-skills-"));
    temporaryDirectories.push(storageRoot);
    const fetchSkillSource = async (url: string) => {
      expect(url).toBe(
        "https://codeload.github.com/acme/forge-skills/zip/refs/heads/main"
      );

      return new Response(
        Buffer.from(
          createZipArchiveBase64([
            {
              content:
                "---\nname: github-review\ndescription: Loaded from GitHub.\n---\n# GitHub Review",
              path: "forge-skills-main/code-review/SKILL.md"
            },
            {
              content: "Use repository context.",
              path: "forge-skills-main/code-review/references/context.md"
            }
          ]),
          "base64"
        ),
        { status: 200 }
      );
    };
    const app = createApp({ fetchSkillSource, skillStorageRoot: storageRoot });

    const response = await app.request("/api/skills", {
      body: JSON.stringify({
        projectId: "proj_test",
        sourceUrl: "https://github.com/acme/forge-skills/tree/main/code-review"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      skill: {
        description: "Loaded from GitHub.",
        files: [
          {
            path: "SKILL.md"
          },
          {
            path: "references/context.md"
          }
        ],
        name: "github-review",
        ref: "skill:github-review",
        sourceUrl: "https://github.com/acme/forge-skills/tree/main/code-review",
        storagePath: join(storageRoot, "proj_test", "github-review")
      }
    });
    await expect(
      readFile(join(storageRoot, "proj_test", "github-review", "SKILL.md"), "utf8")
    ).resolves.toContain("GitHub Review");
  });

  it("updates a linked Skill from its saved source URL", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "forge-skills-"));
    temporaryDirectories.push(storageRoot);
    let fetchCount = 0;
    const fetchSkillSource = async (url: string) => {
      expect(url).toBe(
        "https://codeload.github.com/acme/forge-skills/zip/refs/heads/main"
      );
      fetchCount += 1;

      return new Response(
        Buffer.from(
          createZipArchiveBase64([
            {
              content:
                fetchCount === 1
                  ? "---\nname: github-review\ndescription: Old GitHub Skill.\n---\n# Old GitHub Review"
                  : "---\nname: github-review\ndescription: Updated GitHub Skill.\n---\n# Updated GitHub Review",
              path: "forge-skills-main/code-review/SKILL.md"
            }
          ]),
          "base64"
        ),
        { status: 200 }
      );
    };
    const app = createApp({ fetchSkillSource, skillStorageRoot: storageRoot });

    const uploadResponse = await app.request("/api/skills", {
      body: JSON.stringify({
        projectId: "proj_test",
        sourceUrl: "https://github.com/acme/forge-skills/tree/main/code-review"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const uploadBody = await uploadResponse.json() as {
      skill: { id: string };
    };

    const updateResponse = await app.request(
      `/api/skills/${uploadBody.skill.id}/update-from-source`,
      { method: "POST" }
    );

    expect(updateResponse.status).toBe(200);
    await expect(updateResponse.json()).resolves.toMatchObject({
      skill: {
        body: "# Updated GitHub Review",
        description: "Updated GitHub Skill.",
        name: "github-review",
        ref: "skill:github-review",
        sourceUrl: "https://github.com/acme/forge-skills/tree/main/code-review"
      }
    });
    await expect(
      readFile(join(storageRoot, "proj_test", "github-review", "SKILL.md"), "utf8")
    ).resolves.toContain("Updated GitHub Review");
  });

  it("rejects source updates for uploaded zip Skills", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "forge-skills-"));
    temporaryDirectories.push(storageRoot);
    const app = createApp({ skillStorageRoot: storageRoot });

    const uploadResponse = await app.request("/api/skills", {
      body: JSON.stringify({
        archive: {
          contentBase64: createZipArchiveBase64([
            {
              content:
                "---\nname: zip-skill\ndescription: Zip only.\n---\n# Zip Skill",
              path: "SKILL.md"
            }
          ]),
          name: "zip-skill.zip"
        },
        projectId: "proj_test"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const uploadBody = await uploadResponse.json() as {
      skill: { id: string };
    };

    const updateResponse = await app.request(
      `/api/skills/${uploadBody.skill.id}/update-from-source`,
      { method: "POST" }
    );

    expect(updateResponse.status).toBe(400);
    await expect(updateResponse.json()).resolves.toMatchObject({
      error: expect.stringContaining("source URL")
    });
  });

  it("rejects remote Skill sources that do not include a valid SKILL.md", async () => {
    const fetchSkillSource = async () =>
      new Response(
        Buffer.from(
          createZipArchiveBase64([
            {
              content: "# Missing Skill metadata",
              path: "forge-skills-main/README.md"
            }
          ]),
          "base64"
        ),
        { status: 200 }
      );
    const app = createApp({ fetchSkillSource });

    const response = await app.request("/api/skills", {
      body: JSON.stringify({
        projectId: "proj_test",
        sourceUrl: "https://github.com/acme/forge-skills/archive/refs/heads/main.zip"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("SKILL.md")
    });
  });

  it("deletes uploaded Skill definitions", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "forge-skills-"));
    temporaryDirectories.push(storageRoot);
    const app = createApp({ skillStorageRoot: storageRoot });
    const uploadResponse = await app.request("/api/skills", {
      body: JSON.stringify({
        archive: {
          contentBase64: createZipArchiveBase64([
            {
              content:
                "---\nname: verification\ndescription: Verifies task output.\n---\n# Verification",
              path: "SKILL.md"
            }
          ]),
          name: "verification.zip"
        },
        projectId: "proj_test",
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const uploadBody = await uploadResponse.json() as {
      skill: { id: string };
    };

    const deleteResponse = await app.request(
      `/api/skills/${uploadBody.skill.id}`,
      { method: "DELETE" }
    );

    expect(deleteResponse.status).toBe(204);
    await expect(
      stat(join(storageRoot, "proj_test", "verification"))
    ).rejects.toThrow();
    await expect(
      (await app.request("/api/skills?projectId=proj_test")).json()
    ).resolves.toEqual({ skills: [] });
  });

  it("rejects uploads that do not include a valid SKILL.md", async () => {
    const app = createApp();

    const response = await app.request("/api/skills", {
      body: JSON.stringify({
        archive: {
          contentBase64: createZipArchiveBase64([
            { content: "# Missing metadata", path: "README.md" }
          ]),
          name: "invalid-skill.zip"
        },
        projectId: "proj_test"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("SKILL.md")
    });
  });
});

describe("Requirement API", () => {
  it("builds decomposition instructions that preserve named targets", () => {
    const request = buildRequirementPlanningRequest({
      requirement: {
        body: "写一份 LLM Wiki 的材料",
        title: "LLM Wiki 材料"
      },
      workflowFile: {
        name: "调研写作模板"
      }
    });

    expect(request.prompt).toContain('"title":"LLM Wiki 材料"');
    expect(request.prompt).toContain('"body":"写一份 LLM Wiki 的材料"');
    expect(request.system).toContain("Treat capitalized or quoted names as proper nouns");
    expect(request.system).toContain("Do not reinterpret a named target");
    expect(request.system).toContain("Ask clarification questions");
    expect(request.system).not.toContain("LLM Wiki");
    expect(request.system).not.toContain("LLM history");
  });

  it("records clarification questions instead of creating decomposition items", async () => {
    const app = createPlanningApp({
      requirementPlanner: async () => ({
        kind: "clarification",
        questions: [
          "What specific target should the material cover?",
          "Who is the intended audience?"
        ]
      })
    });
    const workflowFile = await importRequirementWorkflow(app);
    const requirementResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "写一份内部代号材料",
        title: "内部材料",
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

    await configureModel(app);

    const planResponse = await app.request(
      `/api/requirements/${requirementBody.requirement.id}/decomposition-result`,
      {
        method: "POST"
      }
    );
    const clarificationRequirement = await waitForRequirementStatus(
      app,
      requirementBody.requirement.id,
      "decomposition_failed"
    );
    const decompositionResultsBody = (await (
      await app.request("/api/decomposition-results")
    ).json()) as {
      decompositionResults: Array<{ requirementId: string }>;
    };

    expect(planResponse.status).toBe(202);
    expect(clarificationRequirement.errorMessage).toContain(
      "Requirement needs clarification"
    );
    expect(clarificationRequirement.errorMessage).toContain(
      "What specific target should the material cover?"
    );
    expect(clarificationRequirement.errorMessage).toContain(
      "Who is the intended audience?"
    );
    expect(decompositionResultsBody.decompositionResults).not.toContainEqual(
      expect.objectContaining({
        requirementId: requirementBody.requirement.id
      })
    );
  });

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
    expect(planResponse.status).toBe(202);
    await expect(planResponse.json()).resolves.toMatchObject({
      decompositionResult: null,
      estimatedSeconds: expect.any(Number),
      requirement: {
        id: requirementBody.requirement.id,
        status: "decomposing"
      }
    });

    const planned = await waitForDecompositionResult(
      app,
      requirementBody.requirement.id
    );

    expect(planned).toMatchObject({
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

  it("assigns the default executor to decomposition items and preserves user edits on generated Tasks", async () => {
    const app = createPlanningApp();
    const workflowFile = await importRequirementWorkflow(app);
    const registerResponse = await app.request("/api/bridges/register", {
      body: JSON.stringify({
        agents: [
          {
            capabilities: ["planning", "coding"],
            command: "forge-agent run",
            connector: "cli",
            name: "Local planner"
          }
        ],
        bridgeId: "bridge_local"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const registerBody = (await registerResponse.json()) as {
      agents: Array<{ id: string; name: string }>;
    };
    const agent = registerBody.agents[0]!;

    const projectResponse = await app.request("/api/projects", {
      body: JSON.stringify({
        defaultExecutorAgentBindingId: agent.id,
        defaultExecutorType: "agent-binding",
        name: "Forge Ops"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const projectBody = await projectResponse.json() as {
      id: string;
    };

    const requirementResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Ship default executor assignment.",
        projectId: projectBody.id,
        title: "Executor assignment",
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
    const planResponse = await app.request(
      `/api/requirements/${requirementBody.requirement.id}/decomposition-result`,
      {
        method: "POST"
      }
    );
    const planBody = (await planResponse.json()) as {
      decompositionResult: null;
      estimatedSeconds: number;
      requirement: { status: string };
    };

    expect(planResponse.status).toBe(202);
    expect(planBody).toMatchObject({
      decompositionResult: null,
      requirement: {
        status: "decomposing"
      }
    });

    const nextJobResponse = await app.request("/api/bridges/bridge_local/jobs/next");
    const nextJobBody = (await nextJobResponse.json()) as {
      job: { id: string; requirement: { id: string }; type: string };
    };

    expect(nextJobBody).toMatchObject({
      job: {
        requirement: {
          id: requirementBody.requirement.id
        },
        type: "requirement-decomposition"
      }
    });

    const completeResponse = await app.request(
      `/api/bridges/bridge_local/jobs/${nextJobBody.job.id}/complete`,
      {
        body: JSON.stringify({
          output: JSON.stringify({
            summary: "Split Executor assignment with a local agent.",
            tasks: [
              {
                body: "Use the model API for this task.",
                title: "Model-backed task"
              }
            ]
          }),
          status: "succeeded"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );

    expect(completeResponse.status).toBe(200);
    const planned = await waitForDecompositionResult(
      app,
      requirementBody.requirement.id
    );

    const updateResponse = await app.request(
      `/api/decomposition-results/${planned.decompositionResult.id}`,
      {
        body: JSON.stringify({
          summary: "Edited executor assignment",
          tasks: [
            {
              body: "Use the model API for this task.",
              executorAgentBindingId: null,
              executorLabel: "Model API",
              executorType: "model-api",
              title: "Model-backed task"
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
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            title: "Model-backed task"
          }
        ]
      }
    });

    const generateResponse = await app.request(
      `/api/decomposition-results/${planned.decompositionResult.id}/generate-tasks`,
      {
        method: "POST"
      }
    );

    expect(generateResponse.status).toBe(201);
    await expect(generateResponse.json()).resolves.toMatchObject({
      tasks: [
        {
          executorAgentBindingId: null,
          executorLabel: "Model API",
          executorType: "model-api",
          title: "Model-backed task"
        }
      ]
    });
  });

  it("marks async Requirement decomposition failed when an agent returns invalid output", async () => {
    const app = createPlanningApp();
    const workflowFile = await importRequirementWorkflow(app);
    const registerResponse = await app.request("/api/bridges/register", {
      body: JSON.stringify({
        agents: [
          {
            capabilities: ["planning"],
            command: "forge-agent run",
            connector: "cli",
            name: "Local planner"
          }
        ],
        bridgeId: "bridge_local"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const registerBody = (await registerResponse.json()) as {
      agents: Array<{ id: string }>;
    };
    const agent = registerBody.agents[0]!;
    const requirementResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Return invalid output.",
        title: "Invalid async decomposition",
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

    await app.request(
      `/api/requirements/${requirementBody.requirement.id}/decomposition-result`,
      {
        body: JSON.stringify({
          executorAgentBindingId: agent.id,
          executorType: "agent-binding"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );
    const nextJobBody = (await (
      await app.request("/api/bridges/bridge_local/jobs/next")
    ).json()) as {
      job: { id: string };
    };
    const completeResponse = await app.request(
      `/api/bridges/bridge_local/jobs/${nextJobBody.job.id}/complete`,
      {
        body: JSON.stringify({
          output: "not-json",
          status: "succeeded"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );

    expect(completeResponse.status).toBe(200);
    await expect((await app.request("/api/requirements")).json()).resolves.toMatchObject({
      requirements: [
        {
          errorMessage: expect.stringContaining("invalid output"),
          id: requirementBody.requirement.id,
          status: "decomposition_failed"
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

  it("resets a requirement to decomposition-ready state and hides generated work", async () => {
    const app = createPlanningApp();
    await configureModel(app);
    const workflowFile = await importRequirementWorkflow(app);
    const requirementResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Create work then reset it.",
        title: "Resettable requirement",
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

    const resetResponse = await app.request(
      `/api/requirements/${requirementBody.requirement.id}/reset`,
      {
        method: "POST"
      }
    );

    expect(resetResponse.status).toBe(200);
    await expect(resetResponse.json()).resolves.toMatchObject({
      requirement: {
        errorMessage: null,
        id: requirementBody.requirement.id,
        status: "init"
      }
    });
    await expect((await app.request("/api/tasks")).json()).resolves.toEqual({
      tasks: []
    });
    await expect(
      (await app.request("/api/decomposition-results")).json()
    ).resolves.toEqual({
      decompositionResults: []
    });

    const retriedDecompositionBody = await createDecompositionResultForRequirement(
      app,
      requirementBody.requirement.id
    );

    expect(retriedDecompositionBody.decompositionResult.id).not.toBe(
      decompositionBody.decompositionResult.id
    );
  });

  it("updates a requirement and rejects duplicate names in the same Project", async () => {
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
          body: "Updated requirement details.",
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
          body: "Duplicate requirement details.",
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
      body: "Updated requirement details.",
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

  it("opens a Server-Sent Events stream for realtime workspace updates", async () => {
    const app = createPlanningApp();

    const response = await app.request("/api/events");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.body).not.toBeNull();

    await response.body?.cancel();
  });

  it("publishes Task Workflow status changes to realtime subscribers", async () => {
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
    const eventsResponse = await app.request("/api/events");
    const reader = eventsResponse.body!.getReader();

    try {
      const startResponse = await app.request(
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

      expect(startResponse.status).toBe(201);
      await expect(readSseEvent(reader, "workflowRun.created")).resolves.toMatchObject({
        workflowRun: {
          status: "running",
          taskId: createdTask.task.id
        }
      });
      await expect(readSseEvent(reader, "nodeRun.created")).resolves.toMatchObject({
        nodeRun: {
          nodeId: "plan",
          status: "queued"
        }
      });
      await expect(readSseEvent(reader, "task.updated")).resolves.toMatchObject({
        task: {
          id: createdTask.task.id,
          status: "running"
        }
      });
    } finally {
      await reader.cancel();
    }
  });

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
    exit:
      maxRetries: 1
  - id: code
    type: coding
    dependsOn: plan
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
      },
      task: {
        id: createdTask.task.id,
        status: "running"
      }
    });
    expect(agentProxyRequests).toHaveLength(1);
    await expect((await app.request("/api/tasks")).json()).resolves.toMatchObject({
      tasks: [
        expect.objectContaining({
          id: createdTask.task.id,
          status: "running"
        })
      ]
    });

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

  it("accepts a Task after it is pending acceptance", async () => {
    const app = createPlanningApp({
      taskWorkflowNodeExecutor: async ({ node }) => `completed ${node.id}`
    } as never);
    await configureModel(app);
    const createdTask = await createTask(app);
    const taskWorkflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Artifact review workflow
scope: task
version: "1.1"
artifacts:
  - id: final-packet
    type: markdown
    path: final-packet.md
nodes:
  - id: produce
    type: writing
    outputs:
      - artifact: final-packet
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

    await app.request(
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
    await waitForTaskWorkflowRun(
      app,
      createdTask.task.id,
      (run) => run.workflowRun.status === "succeeded"
    );

    await expect((await app.request("/api/tasks")).json()).resolves.toMatchObject({
      tasks: [
        expect.objectContaining({
          id: createdTask.task.id,
          status: "pending_acceptance"
        })
      ]
    });

    const eventsResponse = await app.request("/api/events");
    const reader = eventsResponse.body!.getReader();

    try {
      const response = await app.request(
        `/api/tasks/${createdTask.task.id}/acceptance`,
        {
          method: "POST"
        }
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        task: {
          id: createdTask.task.id,
          status: "completed"
        }
      });
      await expect(readSseEvent(reader, "task.updated")).resolves.toMatchObject({
        task: {
          id: createdTask.task.id,
          status: "completed"
        }
      });
    } finally {
      await reader.cancel().catch(() => undefined);
    }

    await expect((await app.request("/api/tasks")).json()).resolves.toMatchObject({
      tasks: [
        expect.objectContaining({
          id: createdTask.task.id,
          status: "completed"
        })
      ]
    });
  });

  it("accepts a Requirement only after all linked Tasks finished", async () => {
    const app = createPlanningApp({
      taskWorkflowNodeExecutor: async ({ node }) => `completed ${node.id}`
    } as never);
    await configureModel(app);
    const workflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
version: "1.1"
nodes:
  - id: split
    type: task-drafting
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
        body: "Create two dependent tasks.",
        title: "Accept requirement output",
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
    const updateDecompositionResponse = await app.request(
      `/api/decomposition-results/${decompositionBody.decompositionResult.id}`,
      {
        body: JSON.stringify({
          tasks: [
            {
              body: "First task.",
              dependsOn: [],
              executorAgentBindingId: null,
              executorLabel: "Model API",
              executorType: "model-api",
              id: "first",
              sortOrder: 0,
              title: "First task"
            },
            {
              body: "Final task.",
              dependsOn: [],
              executorAgentBindingId: null,
              executorLabel: "Model API",
              executorType: "model-api",
              id: "final",
              sortOrder: 1,
              title: "Final task"
            }
          ],
          summary: "Two dependent tasks."
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "PATCH"
      }
    );
    expect(updateDecompositionResponse.status).toBe(200);
    const generatedBody = await generateTasksFromDecompositionResult(
      app,
      decompositionBody.decompositionResult.id
    );
    const [firstTask, finalTask] = generatedBody.tasks;

    await app.request(`/api/tasks/${finalTask!.id}/workflow-runs`, {
      body: JSON.stringify({
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    await waitForTaskWorkflowRun(
      app,
      finalTask!.id,
      (run) => run.workflowRun.status === "succeeded"
    );

    const blockedResponse = await app.request(
      `/api/requirements/${requirementBody.requirement.id}/acceptance`,
      {
        method: "POST"
      }
    );

    expect(blockedResponse.status).toBe(409);
    await expect(blockedResponse.json()).resolves.toMatchObject({
      error: expect.stringContaining("1")
    });

    await app.request(`/api/tasks/${firstTask!.id}/workflow-runs`, {
      body: JSON.stringify({
        workflowFileId: workflowBody.workflowFile.id
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    await waitForTaskWorkflowRun(
      app,
      firstTask!.id,
      (run) => run.workflowRun.status === "succeeded"
    );

    const response = await app.request(
      `/api/requirements/${requirementBody.requirement.id}/acceptance`,
      {
        method: "POST"
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      requirement: {
        id: requirementBody.requirement.id,
        status: "completed"
      },
      task: {
        id: finalTask!.id,
        status: "completed"
      }
    });
  });

  it("recovers running Task status from existing Workflow Runs after restart", async () => {
    const workflowRunRepository = createInMemoryWorkflowRunRepository();
    const app = createPlanningApp({ workflowRunRepository });
    await configureModel(app);
    const createdTask = await createTask(app);

    await workflowRunRepository.createWorkflowRun({
      taskId: createdTask.task.id,
      workflowFileId: "wff_existing"
    });

    await expect((await app.request("/api/tasks")).json()).resolves.toMatchObject({
      tasks: [
        expect.objectContaining({
          id: createdTask.task.id,
          status: "running"
        })
      ]
    });
  });

  it("resumes existing running Model API Workflow Nodes when Tasks are listed", async () => {
    const workflowRunRepository = createInMemoryWorkflowRunRepository();
    const workflowFileRepository = createInMemoryWorkflowFileRepository();
    const executedNodeIds: string[] = [];
    const app = createPlanningApp({
      taskWorkflowNodeExecutor: async ({ node }) => {
        executedNodeIds.push(node.id);
        return `completed ${node.id}`;
      },
      workflowFileRepository,
      workflowRunRepository
    } as never);
    await configureModel(app);
    const createdTask = await createTask(app);
    const workflowFile = await workflowFileRepository.createWorkflowFileMetadata({
      definition: JSON.stringify({
        name: "Existing travel guide",
        version: "1.1",
        nodes: [
          {
            dependsOn: [],
            exit: { maxRetries: 1 },
            id: "clarify-trip",
            type: "research"
          },
          {
            dependsOn: ["clarify-trip"],
            exit: { maxRetries: 1 },
            id: "design-itinerary",
            type: "writing"
          }
        ]
      }),
      name: "Existing travel guide",
      nodeCount: 2,
      templateType: "custom"
    });
    const workflowRun = await workflowRunRepository.createWorkflowRun({
      taskId: createdTask.task.id,
      workflowFileId: workflowFile.id
    });
    await workflowRunRepository.createNodeRun({
      dependsOn: [],
      nodeId: "clarify-trip",
      sortOrder: 0,
      status: "running",
      workflowRunId: workflowRun.id
    });
    await workflowRunRepository.createNodeRun({
      dependsOn: ["clarify-trip"],
      nodeId: "design-itinerary",
      sortOrder: 1,
      status: "queued",
      workflowRunId: workflowRun.id
    });

    await app.request("/api/tasks");

    await expect(
      waitForTaskWorkflowRun(
        app,
        createdTask.task.id,
        (run) => run.workflowRun.status === "succeeded"
      )
    ).resolves.toMatchObject({
      nodeRuns: [
        { nodeId: "clarify-trip", status: "succeeded" },
        { nodeId: "design-itinerary", status: "succeeded" }
      ],
      workflowRun: {
        status: "succeeded"
      }
    });
    expect(executedNodeIds).toEqual(["clarify-trip", "design-itinerary"]);
  });

  it("rejects task workflow starts until local execution is configured", async () => {
    const bridgeRepository = createInMemoryBridgeRepository();
    const agent = await bridgeRepository.upsertAgentBinding({
      command: "offline-agent run",
      connector: "cli",
      name: "offline-agent",
      status: "offline"
    });
    const app = createPlanningApp({ bridgeRepository });
    await configureModel(app);
    const createdTask = await createTask(app);
    await app.request("/api/execution-settings", {
      body: JSON.stringify({
        defaultExecutorAgentBindingId: agent.id,
        defaultExecutorType: "agent-binding"
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

  it("executes Model API Task Workflow nodes and advances dependencies", async () => {
    const executedNodeIds: string[] = [];
    const app = createPlanningApp({
      taskWorkflowNodeExecutor: async ({ node }) => {
        executedNodeIds.push(node.id);
        return `completed ${node.id}`;
      }
    } as never);
    await configureModel(app);
    const createdTask = await createTask(app);

    await app.request("/api/execution-settings", {
      body: JSON.stringify({
        defaultExecutorAgentBindingId: "agb_missing",
        defaultExecutorType: "agent-binding"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "PATCH"
    });

    const taskWorkflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Model-only task workflow
scope: task
version: "1.1"
nodes:
  - id: collect
    type: research
    exit:
      maxRetries: 1
  - id: analyze
    type: analysis
    dependsOn: collect
    exit:
      maxRetries: 1
  - id: brief
    type: writing
    dependsOn: analyze
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
          nodeExecutorAssignments: ["collect", "analyze", "brief"].map((nodeId) => ({
            executorType: "model-api",
            nodeId
          })),
          workflowFileId: taskWorkflowBody.workflowFile.id
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );

    const startBody = await response.json();

    expect(response.status, JSON.stringify(startBody)).toBe(201);
    expect(startBody).toMatchObject({
      nodeRuns: [
        { nodeId: "collect", status: "running" },
        { nodeId: "analyze", status: "queued" },
        { nodeId: "brief", status: "queued" }
      ],
      workflowRun: {
        status: "running"
      }
    });

    await expect(
      waitForTaskWorkflowRun(
        app,
        createdTask.task.id,
        (run) => run.workflowRun.status === "succeeded"
      )
    ).resolves.toMatchObject({
      nodeRuns: [
        { nodeId: "collect", status: "succeeded" },
        { nodeId: "analyze", status: "succeeded" },
        { nodeId: "brief", status: "succeeded" }
      ],
      workflowRun: {
        status: "succeeded"
      }
    });
    expect(executedNodeIds).toEqual(["collect", "analyze", "brief"]);
  });

  it("retries a failed Model API Workflow Node without rerunning succeeded dependencies", async () => {
    const attemptsByNodeId = new Map<string, number>();
    const executedNodeIds: string[] = [];
    const app = createPlanningApp({
      taskWorkflowNodeExecutor: async ({ node }) => {
        executedNodeIds.push(node.id);
        attemptsByNodeId.set(node.id, (attemptsByNodeId.get(node.id) ?? 0) + 1);

        if (node.id === "analyze" && attemptsByNodeId.get(node.id) === 1) {
          throw new Error("analysis failed");
        }

        return `completed ${node.id}`;
      }
    } as never);
    await configureModel(app);
    const createdTask = await createTask(app);
    const taskWorkflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Retryable model workflow
scope: task
version: "1.1"
nodes:
  - id: collect
    type: research
    exit:
      maxRetries: 1
  - id: analyze
    type: analysis
    dependsOn: collect
    exit:
      maxRetries: 1
  - id: brief
    type: writing
    dependsOn: analyze
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

    const startResponse = await app.request(
      `/api/tasks/${createdTask.task.id}/workflow-runs`,
      {
        body: JSON.stringify({
          nodeExecutorAssignments: ["collect", "analyze", "brief"].map((nodeId) => ({
            executorType: "model-api",
            nodeId
          })),
          workflowFileId: taskWorkflowBody.workflowFile.id
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );
    expect(startResponse.status).toBe(201);

    const failedRun = await waitForTaskWorkflowRun(
      app,
      createdTask.task.id,
      (run) => run.workflowRun.status === "failed"
    );
    const failedNodeRun = failedRun.nodeRuns.find(
      (nodeRun) => nodeRun.nodeId === "analyze"
    );
    expect(failedNodeRun).toMatchObject({
      status: "failed"
    });

    const retryResponse = await app.request(
      `/api/tasks/${createdTask.task.id}/workflow-runs/${failedRun.workflowRun.id}/node-runs/${failedNodeRun!.id}/retry`,
      {
        method: "POST"
      }
    );

    expect(retryResponse.status).toBe(200);
    await expect(retryResponse.json()).resolves.toMatchObject({
      nodeRuns: [
        { nodeId: "collect", status: "succeeded" },
        { nodeId: "analyze", status: "running" },
        { nodeId: "brief", status: "queued" }
      ],
      task: {
        id: createdTask.task.id,
        status: "running"
      },
      workflowRun: {
        id: failedRun.workflowRun.id,
        status: "running"
      }
    });

    await expect(
      waitForTaskWorkflowRun(
        app,
        createdTask.task.id,
        (run) => run.workflowRun.status === "succeeded"
      )
    ).resolves.toMatchObject({
      nodeRuns: [
        { nodeId: "collect", status: "succeeded" },
        { nodeId: "analyze", status: "succeeded" },
        { nodeId: "brief", status: "succeeded" }
      ],
      workflowRun: {
        status: "succeeded"
      }
    });
    expect(executedNodeIds).toEqual(["collect", "analyze", "analyze", "brief"]);
  });

  it("starts legacy stored task workflow files with Model API executors", async () => {
    const workflowFileRepository = createInMemoryWorkflowFileRepository();
    const workflowFile =
      await workflowFileRepository.createWorkflowFileMetadata({
        definition: JSON.stringify({
          name: "Legacy research workflow",
          nodes: [
            {
              dependsOn: [],
              executor: "skill:research",
              exit: { maxRetries: 1 },
              id: "collect",
              outputs: ["research-notes.md"],
              type: "research-collection"
            },
            {
              dependsOn: ["collect"],
              executor: "agent:analyst",
              exit: { maxRetries: 1 },
              id: "analyze",
              outputs: ["analysis.md"],
              type: "research-analysis"
            }
          ],
          scope: "task"
        }),
        name: "Legacy research workflow",
        nodeCount: 2
      });
    const app = createPlanningApp({ workflowFileRepository });
    await configureModel(app);
    const createdTask = await createTask(app);

    const response = await app.request(
      `/api/tasks/${createdTask.task.id}/workflow-runs`,
      {
        body: JSON.stringify({
          nodeExecutorAssignments: ["collect", "analyze"].map((nodeId) => ({
            executorType: "model-api",
            nodeId
          })),
          workflowFileId: workflowFile.id
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
        { nodeId: "collect", status: "running" },
        { nodeId: "analyze", status: "queued" }
      ],
      workflowRun: {
        status: "running"
      }
    });
  });

  it("rejects task workflow starts while dependency tasks are unfinished", async () => {
    const app = createPlanningApp({
      requirementPlanner: async ({ requirement }) => ({
        kind: "tasks",
        items: [
          {
            body: "Create the model first.",
            id: "item_model",
            sortOrder: 0,
            title: `Model: ${requirement.title}`
          },
          {
            body: "Build the UI after the model exists.",
            dependsOn: ["item_model"],
            id: "item_ui",
            sortOrder: 1,
            title: `UI: ${requirement.title}`
          }
        ],
        summary: "Split into ordered tasks."
      })
    });
    await configureModel(app);
    await app.request("/api/execution-settings", {
      body: JSON.stringify({
        agentProxyUrl: "http://127.0.0.1:8787"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "PATCH"
    });
    const requirementWorkflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Requirement split
scope: task
version: "1.1"
nodes:
  - id: split
    type: task-drafting
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
    const requirementResponse = await app.request("/api/requirements", {
      body: JSON.stringify({
        body: "Turn this into ordered tasks.",
        title: "Ordered work",
        workflowFileId: requirementWorkflowBody.workflowFile.id
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
    const taskWorkflowResponse = await app.request("/api/workflow-files/import", {
      body: JSON.stringify({
        source: `
name: Task implementation
scope: task
version: "1.1"
nodes:
  - id: plan
    type: planning
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
      `/api/tasks/${generatedBody.tasks[1]!.id}/workflow-runs`,
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

    expect(generatedBody.tasks[1]).toMatchObject({
      dependsOn: [generatedBody.tasks[0]!.id]
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/dependency/i)
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
    const registerBody = (await registerResponse.json()) as {
      agents: Array<{ id: string; connector: string; name: string; status: string }>;
      bridgeId: string;
    };
    expect(registerBody).toMatchObject({
      agents: [
        {
          connector: "cli",
          name: "coco",
          status: "online"
        }
      ],
      bridgeId: "bridge_local"
    });
    await app.request("/api/execution-settings", {
      body: JSON.stringify({
        defaultExecutorAgentBindingId: registerBody.agents[0].id,
        defaultExecutorType: "agent-binding"
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
  - id: implement
    type: coding
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

  it("allows workflow run payloads to override the executor per Workflow Node", async () => {
    const app = createPlanningApp();
    await configureModel(app);
    const createdTask = await createTask(app);

    const registerResponse = await app.request("/api/bridges/register", {
      body: JSON.stringify({
        agents: [
          {
            command: "default-agent run",
            connector: "cli",
            name: "default-agent"
          },
          {
            command: "review-agent run",
            connector: "cli",
            name: "review-agent"
          }
        ],
        bridgeId: "bridge_local"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const registerBody = (await registerResponse.json()) as {
      agents: Array<{ id: string; name: string }>;
    };
    const defaultAgent = registerBody.agents.find(
      (agent) => agent.name === "default-agent"
    )!;
    const reviewAgent = registerBody.agents.find(
      (agent) => agent.name === "review-agent"
    )!;

    await app.request("/api/execution-settings", {
      body: JSON.stringify({
        defaultExecutorAgentBindingId: defaultAgent.id,
        defaultExecutorType: "agent-binding"
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
  - id: implement
    type: coding
    exit:
      maxRetries: 1
  - id: review
    type: review
    dependsOn: implement
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
          nodeExecutorAssignments: [
            {
              executorAgentBindingId: reviewAgent.id,
              executorType: "agent-binding",
              nodeId: "review"
            }
          ],
          workflowFileId: taskWorkflowBody.workflowFile.id
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );

    expect(runResponse.status).toBe(201);

    const firstJobBody = (await (
      await app.request("/api/bridges/bridge_local/jobs/next")
    ).json()) as {
      job: { agentName: string; id: string; nodeRun: { nodeId: string } };
    };
    expect(firstJobBody.job).toMatchObject({
      agentName: "default-agent",
      nodeRun: { nodeId: "implement" }
    });

    const blockedSecondJobBody = (await (
      await app.request("/api/bridges/bridge_local/jobs/next")
    ).json()) as { job: unknown };
    expect(blockedSecondJobBody.job).toBeNull();

    await app.request(
      `/api/bridges/bridge_local/jobs/${firstJobBody.job.id}/complete`,
      {
        body: JSON.stringify({
          output: "implemented",
          status: "succeeded"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );

    const secondJobBody = (await (
      await app.request("/api/bridges/bridge_local/jobs/next")
    ).json()) as { job: { agentName: string; nodeRun: { nodeId: string } } };
    expect(secondJobBody.job).toMatchObject({
      agentName: "review-agent",
      nodeRun: { nodeId: "review" }
    });
  });

  it("updates Node Run state when a local bridge completes a job", async () => {
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
    const registerBody = (await registerResponse.json()) as {
      agents: Array<{ id: string }>;
    };

    await app.request("/api/execution-settings", {
      body: JSON.stringify({
        defaultExecutorAgentBindingId: registerBody.agents[0]!.id,
        defaultExecutorType: "agent-binding"
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
  - id: implement
    type: coding
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

  it("advances local bridge Task Workflow nodes only after dependencies complete", async () => {
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
    const registerBody = (await registerResponse.json()) as {
      agents: Array<{ id: string }>;
    };

    await app.request("/api/execution-settings", {
      body: JSON.stringify({
        defaultExecutorAgentBindingId: registerBody.agents[0]!.id,
        defaultExecutorType: "agent-binding"
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
  - id: clarify
    type: research
    exit:
      maxRetries: 1
  - id: write
    type: writing
    dependsOn: clarify
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

    const firstJobBody = (await (
      await app.request("/api/bridges/bridge_local/jobs/next")
    ).json()) as {
      job: {
        id: string;
        nodeRun: { nodeId: string };
      } | null;
    };
    expect(firstJobBody.job).toMatchObject({
      nodeRun: { nodeId: "clarify" }
    });

    const noSecondJobBody = (await (
      await app.request("/api/bridges/bridge_local/jobs/next")
    ).json()) as { job: unknown };
    expect(noSecondJobBody.job).toBeNull();

    await app.request(
      `/api/bridges/bridge_local/jobs/${firstJobBody.job!.id}/complete`,
      {
        body: JSON.stringify({
          output: "clarified",
          status: "succeeded"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );

    const secondJobBody = (await (
      await app.request("/api/bridges/bridge_local/jobs/next")
    ).json()) as {
      job: {
        id: string;
        nodeRun: { nodeId: string };
        workflowRun: { id: string };
      } | null;
    };
    expect(secondJobBody.job).toMatchObject({
      nodeRun: { nodeId: "write" }
    });

    await app.request(
      `/api/bridges/bridge_local/jobs/${secondJobBody.job!.id}/complete`,
      {
        body: JSON.stringify({
          output: "written",
          status: "succeeded"
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      }
    );

    await expect(
      waitForTaskWorkflowRun(
        app,
        createdTask.task.id,
        (run) => run.workflowRun.status === "succeeded"
      )
    ).resolves.toMatchObject({
      nodeRuns: [
        { nodeId: "clarify", status: "succeeded" },
        { nodeId: "write", status: "succeeded" }
      ],
      workflowRun: {
        id: secondJobBody.job!.workflowRun.id,
        status: "succeeded"
      }
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
