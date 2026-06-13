import { describe, expect, it } from "vitest";
import { createApp } from "./app";

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
  it("creates a requirement with a requirement workflow and generates task drafts", async () => {
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
      requirement: {
        body: "Build the minimum Requirement to Task Draft flow.",
        status: "completed",
        title: "Generate draft tasks",
        workflowFileId: workflowBody.workflowFile.id
      },
      taskDrafts: [
        {
          sortOrder: 0,
          title: "Draft: Generate draft tasks"
        }
      ]
    });

    const taskDraftsResponse = await app.request("/task-drafts");

    expect(taskDraftsResponse.status).toBe(200);
    await expect(taskDraftsResponse.json()).resolves.toMatchObject({
      taskDrafts: [
        {
          title: "Draft: Generate draft tasks"
        }
      ]
    });
  });

  it("marks the requirement failed when the selected workflow is not requirement-scoped", async () => {
    const app = createApp();

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
    const app = createApp();
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

  it("starts a task workflow run and advances node runs in DAG order", async () => {
    const app = createApp();
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
          status: "succeeded"
        },
        {
          dependsOn: ["plan"],
          nodeId: "code",
          status: "succeeded"
        }
      ],
      workflowRun: {
        status: "succeeded",
        taskId: createdTask.task.id,
        workflowFileId: taskWorkflowBody.workflowFile.id
      }
    });

    const runsResponse = await app.request(
      `/tasks/${createdTask.task.id}/workflow-runs`
    );

    expect(runsResponse.status).toBe(200);
    await expect(runsResponse.json()).resolves.toMatchObject({
      workflowRuns: [
        {
          workflowRun: {
            status: "succeeded"
          },
          nodeRuns: [
            {
              nodeId: "plan",
              status: "succeeded"
            },
            {
              nodeId: "code",
              status: "succeeded"
            }
          ]
        }
      ]
    });
  });

  it("rejects non task-scoped workflow files", async () => {
    const app = createApp();
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
});
