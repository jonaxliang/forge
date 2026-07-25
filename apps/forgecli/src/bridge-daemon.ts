import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { executeAgent, type BridgeJobPayload } from "./connectors.js";
import {
  loadForgeCliState,
  resolveForgeCliPaths,
  type ForgeCliAgent,
  type ForgeCliEnvironment
} from "./state.js";

export type BridgeDaemonOptions = {
  env?: ForgeCliEnvironment;
  once?: boolean;
  stderr?: (line: string) => void;
  stdout?: (line: string) => void;
};

type BridgeJobResponse = {
  job: (BridgeJobPayload & { agentName: string }) | null;
};

type BridgeRegistrationResponse = {
  bridgeToken?: string;
};

export async function startBridgeDaemon(options: BridgeDaemonOptions = {}) {
  const paths = resolveForgeCliPaths({ env: options.env });
  const state = await loadForgeCliState({ env: options.env });

  if (!state.config.serverUrl) {
    throw new Error("Bridge is not bound. Run `forgecli bridge bind --server <url>`.");
  }

  if (!state.config.authToken) {
    throw new Error(
      "Bridge has no Forge API token. Run `forgecli bridge bind --server <url> --token <token>`."
    );
  }

  await mkdir(dirname(paths.logFile), { recursive: true });

  const logFd = openSync(paths.logFile, "a");
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "bridge-daemon"], {
    detached: true,
    env: {
      ...process.env,
      ...(options.env ?? {}),
      FORGECLI_DAEMON: "1"
    },
    stdio: ["ignore", logFd, logFd]
  });

  child.unref();

  await writeFile(paths.pidFile, `${child.pid ?? ""}\n`);
  await writeBridgeStatus("starting", { env: options.env });

  return child.pid;
}

export async function stopBridgeDaemon(options: BridgeDaemonOptions = {}) {
  const paths = resolveForgeCliPaths({ env: options.env });
  const pid = Number((await readFile(paths.pidFile, "utf8")).trim());

  if (!Number.isFinite(pid) || pid <= 0) {
    throw new Error("Bridge pid file is invalid");
  }

  process.kill(pid, "SIGTERM");
  await rm(paths.pidFile, { force: true });
  await writeBridgeStatus("stopped", { env: options.env });
}

export async function readBridgeStatus(options: BridgeDaemonOptions = {}) {
  const paths = resolveForgeCliPaths({ env: options.env });

  try {
    return JSON.parse(await readFile(paths.statusFile, "utf8")) as {
      status: string;
      updatedAt: string;
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {
        status: "stopped",
        updatedAt: null
      };
    }

    throw error;
  }
}

export async function runBridgeDaemon(options: BridgeDaemonOptions = {}) {
  const state = await loadForgeCliState({ env: options.env });

  if (!state.config.serverUrl) {
    throw new Error("Bridge is not bound. Run `forgecli bridge bind --server <url>`.");
  }

  if (!state.config.authToken) {
    throw new Error(
      "Bridge has no Forge API token. Run `forgecli bridge bind --server <url> --token <token>`."
    );
  }

  await writeBridgeStatus("running", { env: options.env });
  const bridgeToken = await registerBridge(
    state.config.serverUrl,
    state.config.bridgeId,
    state.agents,
    state.config.authToken
  );

  do {
    await heartbeatBridge(
      state.config.serverUrl,
      state.config.bridgeId,
      state.agents,
      bridgeToken
    );
    await executeNextJob(
      state.config.serverUrl,
      state.config.bridgeId,
      state.agents,
      bridgeToken
    );

    if (!options.once) {
      await delay(state.config.pollIntervalMs);
    }
  } while (!options.once);
}

async function executeNextJob(
  serverUrl: string,
  bridgeId: string,
  agents: ForgeCliAgent[],
  bridgeToken: string
) {
  const response = await fetch(
    `${serverUrl}/api/bridges/${encodeURIComponent(bridgeId)}/jobs/next`,
    {
      headers: authorizationHeaders(bridgeToken)
    }
  );

  if (!response.ok) {
    throw new Error(`Bridge job poll failed with status ${response.status}`);
  }

  const body = (await response.json()) as BridgeJobResponse;

  if (!body.job) {
    return;
  }

  const agent = agents.find((candidate) => candidate.name === body.job?.agentName);

  if (!agent) {
    await completeJob(
      serverUrl,
      bridgeId,
      body.job.id,
      {
        errorMessage: `No local agent registered with name ${body.job.agentName}`,
        status: "failed"
      },
      bridgeToken
    );
    return;
  }

  const result = await executeAgent(agent, body.job);

  await completeJob(
    serverUrl,
    bridgeId,
    body.job.id,
    {
      errorMessage: result.exitCode === 0 ? null : result.stderr || result.stdout,
      output: result.stdout,
      status: result.exitCode === 0 ? "succeeded" : "failed"
    },
    bridgeToken
  );
}

async function registerBridge(
  serverUrl: string,
  bridgeId: string,
  agents: ForgeCliAgent[],
  authToken: string
) {
  const response = await fetch(`${serverUrl}/api/bridges/register`, {
    body: JSON.stringify({
      agents,
      bridgeId
    }),
    headers: {
      ...authorizationHeaders(authToken),
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Bridge registration failed with status ${response.status}`);
  }

  const body = (await response.json()) as BridgeRegistrationResponse;

  if (!body.bridgeToken) {
    throw new Error("Bridge registration did not return an identity token");
  }

  return body.bridgeToken;
}

async function heartbeatBridge(
  serverUrl: string,
  bridgeId: string,
  agents: ForgeCliAgent[],
  bridgeToken: string
) {
  const response = await fetch(
    `${serverUrl}/api/bridges/${encodeURIComponent(bridgeId)}/heartbeat`,
    {
      body: JSON.stringify({ agents }),
      headers: {
        ...authorizationHeaders(bridgeToken),
        "content-type": "application/json"
      },
      method: "POST"
    }
  );

  if (!response.ok) {
    throw new Error(`Bridge heartbeat failed with status ${response.status}`);
  }
}

async function completeJob(
  serverUrl: string,
  bridgeId: string,
  jobId: string,
  body: {
    errorMessage?: string | null;
    output?: string;
    status: "succeeded" | "failed";
  },
  bridgeToken: string
) {
  const response = await fetch(
    `${serverUrl}/api/bridges/${encodeURIComponent(bridgeId)}/jobs/${encodeURIComponent(
      jobId
    )}/complete`,
    {
      body: JSON.stringify(body),
      headers: {
        ...authorizationHeaders(bridgeToken),
        "content-type": "application/json"
      },
      method: "POST"
    }
  );

  if (!response.ok) {
    throw new Error(`Bridge job completion failed with status ${response.status}`);
  }
}

function authorizationHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`
  };
}

async function writeBridgeStatus(
  status: string,
  options: { env?: ForgeCliEnvironment } = {}
) {
  const paths = resolveForgeCliPaths({ env: options.env });

  await mkdir(dirname(paths.statusFile), { recursive: true });
  await writeFile(
    paths.statusFile,
    `${JSON.stringify({ status, updatedAt: new Date().toISOString() }, null, 2)}\n`
  );
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

if (process.env.FORGECLI_DAEMON === "1") {
  runBridgeDaemon().catch((error: unknown) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);

    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
