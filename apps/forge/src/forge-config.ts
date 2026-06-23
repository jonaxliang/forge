import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type ForgeConfig = {
  skillsRoot: string;
};

export function loadForgeConfig({
  configuredPath,
  home = homedir()
}: {
  configuredPath?: string;
  home?: string;
} = {}): ForgeConfig {
  const configPath = configuredPath?.trim() || join(home, ".forge", "config.json");
  const defaults = {
    skillsRoot: join(home, ".forge", "skills")
  };

  if (!existsSync(configPath)) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
      skillsRoot?: unknown;
    };
    const skillsRoot =
      typeof parsed.skillsRoot === "string" && parsed.skillsRoot.trim()
        ? parsed.skillsRoot.trim()
        : defaults.skillsRoot;

    return { skillsRoot };
  } catch {
    return defaults;
  }
}
