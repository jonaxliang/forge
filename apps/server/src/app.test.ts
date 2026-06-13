import { describe, expect, it } from "vitest";
import { app } from "./app";

describe("GET /health", () => {
  it("returns the Forge server health payload", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "forge",
      status: "healthy"
    });
  });
});
