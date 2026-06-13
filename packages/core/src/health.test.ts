import { describe, expect, it } from "vitest";
import { createHealthPayload } from "./index";

describe("createHealthPayload", () => {
  it("returns the Forge health payload used by the server", () => {
    expect(createHealthPayload()).toEqual({
      ok: true,
      service: "forge",
      status: "healthy"
    });
  });
});
