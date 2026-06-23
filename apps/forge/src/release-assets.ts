import { mkdirSync } from "node:fs";
import { join } from "node:path";

type ResolveReleaseAssetsRootOptions = {
  configuredRoot?: string;
  currentDirectory: string;
};

export function resolveReleaseAssetsRoot({
  configuredRoot,
  currentDirectory
}: ResolveReleaseAssetsRootOptions) {
  const releaseRoot = configuredRoot ?? join(currentDirectory, "../../..", "release");

  mkdirSync(releaseRoot, { recursive: true });

  return releaseRoot;
}
