import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { resolveWebAssetsRoot } from "./web-assets";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  );
});

async function createDirectoryWithIndex(path: string) {
  await mkdir(path, { recursive: true });
  await writeFile(join(path, "index.html"), "<html>Forge Web</html>");
}

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "forge-web-assets-resolver-"));
  temporaryDirectories.push(directory);

  return directory;
}

describe("resolveWebAssetsRoot", () => {
  it("uses the configured assets root when it contains index.html", async () => {
    const directory = await createTemporaryDirectory();
    const configuredRoot = join(directory, "configured-web");
    await createDirectoryWithIndex(configuredRoot);

    expect(
      resolveWebAssetsRoot({
        configuredRoot,
        currentDirectory: join(directory, "apps/forge/dist")
      })
    ).toBe(configuredRoot);
  });

  it("prefers Web assets bundled next to the server build", async () => {
    const directory = await createTemporaryDirectory();
    const currentDirectory = join(directory, "apps/forge/dist");
    const bundledRoot = join(currentDirectory, "web");
    await createDirectoryWithIndex(bundledRoot);

    expect(resolveWebAssetsRoot({ currentDirectory })).toBe(bundledRoot);
  });

  it("falls back to the monorepo Web dist directory", async () => {
    const directory = await createTemporaryDirectory();
    const currentDirectory = join(directory, "apps/forge/dist");
    const webDistRoot = join(directory, "apps/forge/web/dist");
    await createDirectoryWithIndex(webDistRoot);

    expect(resolveWebAssetsRoot({ currentDirectory })).toBe(webDistRoot);
  });
});
