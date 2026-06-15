import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveForgeSqlitePath } from "./sqlite-path";

describe("resolveForgeSqlitePath", () => {
  it("uses the configured sqlite path when present", () => {
    expect(
      resolveForgeSqlitePath({
        configuredPath: "/tmp/custom-forge.sqlite",
        currentDirectory: "/repo/apps/forge/dist"
      })
    ).toBe("/tmp/custom-forge.sqlite");
  });

  it("uses the same package-local sqlite file from dev and build entrypoints", () => {
    const repositoryRoot = "/repo";
    const expectedPath = join(repositoryRoot, "apps/forge/.forge/forge.sqlite");

    expect(
      resolveForgeSqlitePath({
        currentDirectory: join(repositoryRoot, "apps/forge/src")
      })
    ).toBe(expectedPath);
    expect(
      resolveForgeSqlitePath({
        currentDirectory: join(repositoryRoot, "apps/forge/dist")
      })
    ).toBe(expectedPath);
  });
});
