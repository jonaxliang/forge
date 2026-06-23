import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSkill,
  acceptRequirement,
  getServerHealth,
  listAgentBindings,
  listProjects,
  listSkills,
  retryTaskWorkflowNodeRun,
  acceptTask,
  uploadSkill,
  updateSkillFromSource,
  updateProject
} from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubJsonResponse(body: unknown) {
  const fetchMock = vi.fn(async () => ({
    json: async () => body,
    ok: true,
    status: 200
  }));

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("Forge SDK API paths", () => {
  it("requests the server health endpoint under the API namespace", async () => {
    const fetchMock = stubJsonResponse({
      ok: true,
      service: "forge",
      status: "healthy"
    });

    await getServerHealth();

    expect(fetchMock).toHaveBeenCalledWith("/api/health");
  });

  it("keeps a provided base URL outside the API namespace", async () => {
    const fetchMock = stubJsonResponse({ projects: [] });

    await listProjects("http://localhost:3001");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/projects");
  });

  it("requests Agent Bindings from the API namespace", async () => {
    const fetchMock = stubJsonResponse({ agentBindings: [] });

    await listAgentBindings("http://localhost:3001");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/agent-bindings"
    );
  });

  it("lists Skills through the API namespace", async () => {
    const fetchMock = stubJsonResponse({ skills: [] });

    await listSkills("proj_test", "http://localhost:3001");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/skills?projectId=proj_test"
    );
  });

  it("uploads Skills through the API namespace", async () => {
    const fetchMock = stubJsonResponse({
      skill: {
        id: "skl_code_review",
        name: "Code Review",
        projectId: "proj_test",
        ref: "skill:code-review"
      }
    });

    await uploadSkill(
      {
        archive: {
          contentBase64: "UEsDBAoAAAAAA",
          name: "code-review.zip"
        },
        projectId: "proj_test",
      },
      "http://localhost:3001"
    );

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/skills", {
      body: JSON.stringify({
        archive: {
          contentBase64: "UEsDBAoAAAAAA",
          name: "code-review.zip"
        },
        projectId: "proj_test",
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
  });

  it("imports Skills from source URLs through the API namespace", async () => {
    const fetchMock = stubJsonResponse({
      skill: {
        id: "skl_code_review",
        name: "Code Review",
        projectId: "proj_test",
        ref: "skill:code-review"
      }
    });

    await uploadSkill(
      {
        projectId: "proj_test",
        sourceUrl: "https://github.com/acme/forge-skills/tree/main/code-review"
      },
      "http://localhost:3001"
    );

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/api/skills", {
      body: JSON.stringify({
        projectId: "proj_test",
        sourceUrl: "https://github.com/acme/forge-skills/tree/main/code-review"
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
  });

  it("updates Skills from their source URL through the API namespace", async () => {
    const fetchMock = stubJsonResponse({
      skill: {
        id: "skl_code_review",
        name: "Code Review",
        projectId: "proj_test",
        ref: "skill:code-review",
        sourceUrl: "https://github.com/acme/forge-skills/tree/main/code-review"
      }
    });

    await updateSkillFromSource("skl_code_review", "http://localhost:3001");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/skills/skl_code_review/update-from-source",
      {
        method: "POST"
      }
    );
  });

  it("deletes Skills through the API namespace", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 204
    }));
    vi.stubGlobal("fetch", fetchMock);

    await deleteSkill("skl_code_review", "http://localhost:3001");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/skills/skl_code_review",
      {
        method: "DELETE"
      }
    );
  });

  it("updates Projects through the API namespace", async () => {
    const fetchMock = stubJsonResponse({
      id: "proj_test",
      name: "Forge Ops"
    });

    await updateProject("proj_test", { name: "Forge Ops" }, "http://localhost:3001");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/projects/proj_test",
      {
        body: JSON.stringify({ name: "Forge Ops" }),
        headers: {
          "content-type": "application/json"
        },
        method: "PATCH"
      }
    );
  });

  it("retries a failed Workflow Node Run through the API namespace", async () => {
    const fetchMock = stubJsonResponse({
      nodeRuns: [],
      task: { id: "tsk_test" },
      workflowRun: { id: "wfr_test" }
    });

    await retryTaskWorkflowNodeRun(
      "tsk_test",
      "wfr_test",
      "ndr_failed",
      "http://localhost:3001"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/tasks/tsk_test/workflow-runs/wfr_test/node-runs/ndr_failed/retry",
      {
        method: "POST"
      }
    );
  });

  it("accepts a pending Task through the API namespace", async () => {
    const fetchMock = stubJsonResponse({
      task: { id: "tsk_test", status: "completed" }
    });

    await acceptTask("tsk_test", "http://localhost:3001");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/tasks/tsk_test/acceptance",
      {
        method: "POST"
      }
    );
  });

  it("accepts a Requirement through the API namespace", async () => {
    const fetchMock = stubJsonResponse({
      requirement: { id: "req_test", status: "completed" },
      task: { id: "tsk_final", status: "completed" }
    });

    await acceptRequirement("req_test", "http://localhost:3001");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/requirements/req_test/acceptance",
      {
        method: "POST"
      }
    );
  });
});
