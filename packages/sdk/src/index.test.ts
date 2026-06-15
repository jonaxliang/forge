import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getServerHealth,
  listAgentBindings,
  listProjects,
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
});
