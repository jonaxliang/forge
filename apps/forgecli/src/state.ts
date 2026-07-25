import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type ForgeCliAgent = {
  name: string;
  connector: "cli" | "mcp";
  command: string;
  tool?: string;
};

export type ForgeCliState = {
  config: {
    authToken: string;
    bridgeId: string;
    serverUrl: string;
    pollIntervalMs: number;
  };
  agents: ForgeCliAgent[];
};

export type ForgeCliEnvironment = {
  FORGE_AUTH_TOKEN?: string;
  FORGECLI_HOME?: string;
  HOME?: string;
  XDG_CONFIG_HOME?: string;
  XDG_STATE_HOME?: string;
};

export type ForgeCliStateOptions = {
  env?: ForgeCliEnvironment;
};

const defaultPollIntervalMs = 2000;

export function createDefaultForgeCliState(): ForgeCliState {
  return {
    agents: [],
    config: {
      authToken: "",
      bridgeId: `brg_${randomUUID()}`,
      pollIntervalMs: defaultPollIntervalMs,
      serverUrl: ""
    }
  };
}

export function resolveForgeCliPaths({ env = process.env }: ForgeCliStateOptions = {}) {
  if (env.FORGECLI_HOME?.trim()) {
    return {
      configFile: join(env.FORGECLI_HOME, "state.json"),
      logFile: join(env.FORGECLI_HOME, "bridge.log"),
      pidFile: join(env.FORGECLI_HOME, "bridge.pid"),
      statusFile: join(env.FORGECLI_HOME, "bridge-status.json")
    };
  }

  const home = env.HOME?.trim() || homedir();
  const configHome = env.XDG_CONFIG_HOME?.trim() || join(home, ".config");
  const stateHome = env.XDG_STATE_HOME?.trim() || join(home, ".local", "state");

  return {
    configFile: join(configHome, "forgecli", "state.json"),
    logFile: join(stateHome, "forgecli", "bridge.log"),
    pidFile: join(stateHome, "forgecli", "bridge.pid"),
    statusFile: join(stateHome, "forgecli", "bridge-status.json")
  };
}

export async function loadForgeCliState(
  options: ForgeCliStateOptions = {}
): Promise<ForgeCliState> {
  const paths = resolveForgeCliPaths(options);

  try {
    const parsed = JSON.parse(await readFile(paths.configFile, "utf8")) as Partial<ForgeCliState>;
    const defaults = createDefaultForgeCliState();

    return {
      agents: Array.isArray(parsed.agents) ? parsed.agents.map(normalizeAgent) : [],
      config: {
        authToken:
          envAuthToken(options.env) ||
          parsed.config?.authToken?.trim() ||
          defaults.config.authToken,
        bridgeId: parsed.config?.bridgeId?.trim() || defaults.config.bridgeId,
        pollIntervalMs:
          typeof parsed.config?.pollIntervalMs === "number"
            ? parsed.config.pollIntervalMs
            : defaults.config.pollIntervalMs,
        serverUrl: normalizeServerUrl(parsed.config?.serverUrl ?? "")
      }
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return createDefaultForgeCliState();
    }

    throw error;
  }
}

export async function saveForgeCliState(
  state: ForgeCliState,
  options: ForgeCliStateOptions = {}
) {
  const paths = resolveForgeCliPaths(options);
  const normalized: ForgeCliState = {
    agents: state.agents.map(normalizeAgent),
    config: {
      authToken: state.config.authToken?.trim() ?? "",
      bridgeId: state.config.bridgeId,
      pollIntervalMs: state.config.pollIntervalMs,
      serverUrl: normalizeServerUrl(state.config.serverUrl)
    }
  };
  const temporaryFile = `${paths.configFile}.${process.pid}.tmp`;

  await mkdir(dirname(paths.configFile), { mode: 0o700, recursive: true });
  await writeFile(temporaryFile, `${JSON.stringify(normalized, null, 2)}\n`, {
    mode: 0o600
  });
  await rename(temporaryFile, paths.configFile);
  await chmod(paths.configFile, 0o600);
}

export function normalizeServerUrl(serverUrl: string) {
  return serverUrl.trim().replace(/\/+$/, "");
}

export async function readLocalForgeAuthToken(
  options: ForgeCliStateOptions = {}
) {
  const configuredToken = envAuthToken(options.env);

  if (configuredToken) {
    return configuredToken;
  }

  const home = options.env
    ? options.env.HOME?.trim()
    : process.env.HOME?.trim() || homedir();

  if (!home) {
    return "";
  }

  try {
    return (await readFile(join(home, ".forge", "auth-token"), "utf8")).trim();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

function envAuthToken(env: ForgeCliEnvironment | undefined) {
  return (env ?? process.env).FORGE_AUTH_TOKEN?.trim() ?? "";
}

function normalizeAgent(agent: ForgeCliAgent): ForgeCliAgent {
  return {
    ...(agent.tool?.trim() ? { tool: agent.tool.trim() } : {}),
    command: agent.command.trim(),
    connector: agent.connector,
    name: agent.name.trim()
  };
}
