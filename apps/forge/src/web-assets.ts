import { existsSync } from "node:fs";
import { join } from "node:path";

type ResolveWebAssetsRootOptions = {
  configuredRoot?: string;
  currentDirectory: string;
};

export function resolveWebAssetsRoot({
  configuredRoot,
  currentDirectory
}: ResolveWebAssetsRootOptions) {
  if (configuredRoot && containsIndexHtml(configuredRoot)) {
    return configuredRoot;
  }

  const bundledRoot = join(currentDirectory, "web");

  if (containsIndexHtml(bundledRoot)) {
    return bundledRoot;
  }

  const monorepoRoot = join(currentDirectory, "../web/dist");

  if (containsIndexHtml(monorepoRoot)) {
    return monorepoRoot;
  }

  return undefined;
}

function containsIndexHtml(directory: string) {
  return existsSync(join(directory, "index.html"));
}
