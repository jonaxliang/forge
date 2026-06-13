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
