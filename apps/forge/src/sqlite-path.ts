import { join } from "node:path";

type ResolveForgeSqlitePathInput = {
  configuredPath?: string;
  currentDirectory: string;
};

export function resolveForgeSqlitePath({
  configuredPath,
  currentDirectory
}: ResolveForgeSqlitePathInput) {
  if (configuredPath?.trim()) {
    return configuredPath;
  }

  return join(currentDirectory, "..", ".forge", "forge.sqlite");
}
