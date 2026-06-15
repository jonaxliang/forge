import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as {
    exclude?: string[];
    scripts?: Record<string, string>;
  };
}

describe("Forge build configuration", () => {
  it("exposes a root release script for platform executable packages", () => {
    const rootPackage = readJson(resolve(repositoryRoot, "package.json"));
    const releaseScript = readFileSync(
      resolve(repositoryRoot, "scripts/release-packages.mjs"),
      "utf8"
    );

    expect(rootPackage.scripts?.release).toBe("node scripts/release-packages.mjs");
    expect(releaseScript).toContain("FORGE_SQLITE_PATH");
    expect(releaseScript).toContain("$HOME/.forge/forge.sqlite");
  });

  it("bundles Forge Web into the Forge server build output", () => {
    const forgePackage = readJson(resolve(repositoryRoot, "apps/forge/package.json"));

    expect(forgePackage.scripts?.build).toBe(
      "pnpm run build:server && pnpm run build:web && pnpm run bundle-web"
    );
  });

  it("keeps test files out of the server build output", () => {
    const forgeTsconfig = readJson(resolve(repositoryRoot, "apps/forge/tsconfig.json"));

    expect(forgeTsconfig.exclude).toContain("src/**/*.test.ts");
  });
});
