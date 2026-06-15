import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as {
    bin?: Record<string, string>;
    exclude?: string[];
    scripts?: Record<string, string>;
  };
}

describe("forgecli build configuration", () => {
  it("exposes a root build script for the forgecli binary", () => {
    const rootPackage = readJson(resolve(repositoryRoot, "package.json"));

    expect(rootPackage.scripts?.["build:forgecli"]).toBe(
      "pnpm --filter @forge/forgecli build"
    );
  });

  it("builds forgecli into dist and marks the entrypoint executable", () => {
    const cliPackage = readJson(resolve(repositoryRoot, "apps/forgecli/package.json"));

    expect(cliPackage.bin?.forgecli).toBe("./dist/index.js");
    expect(cliPackage.scripts?.build).toContain("tsc -p tsconfig.json");
    expect(cliPackage.scripts?.build).toContain("chmod +x dist/index.js");
  });

  it("keeps test files out of the forgecli build output", () => {
    const cliTsconfig = readJson(resolve(repositoryRoot, "apps/forgecli/tsconfig.json"));

    expect(cliTsconfig.exclude).toContain("src/**/*.test.ts");
  });
});
