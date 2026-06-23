import { mkdtemp, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { resolveReleaseAssetsRoot } from "./release-assets";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  );
});

describe("resolveReleaseAssetsRoot", () => {
  it("creates the release directory when it does not exist", async () => {
    const directory = await mkdtemp(join(tmpdir(), "forge-release-root-"));
    temporaryDirectories.push(directory);
    const releaseRoot = join(directory, "release");

    expect(
      resolveReleaseAssetsRoot({
        configuredRoot: releaseRoot,
        currentDirectory: join(directory, "apps/forge/dist")
      })
    ).toBe(releaseRoot);
    await expect(stat(releaseRoot)).resolves.toMatchObject({
      isDirectory: expect.any(Function)
    });
    expect((await stat(releaseRoot)).isDirectory()).toBe(true);
  });
});
