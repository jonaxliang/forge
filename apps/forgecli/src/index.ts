#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  readBridgeStatus,
  runBridgeDaemon,
  startBridgeDaemon,
  stopBridgeDaemon
} from "./bridge-daemon.js";
import {
  loadForgeCliState,
  normalizeServerUrl,
  readLocalForgeAuthToken,
  saveForgeCliState,
  type ForgeCliAgent,
  type ForgeCliEnvironment
} from "./state.js";

type ForgeCliIo = {
  env?: ForgeCliEnvironment;
  stderr: (line: string) => void;
  stdout: (line: string) => void;
};

const defaultIo: ForgeCliIo = {
  env: process.env,
  stderr: (line) => process.stderr.write(`${line}\n`),
  stdout: (line) => process.stdout.write(`${line}\n`)
};

export async function runForgeCli(
  argv = process.argv.slice(2),
  io: ForgeCliIo = defaultIo
) {
  try {
    const [group = "help", command = ""] = argv;

    if (group === "doctor") {
      io.stdout("forgecli doctor: ok");
      return 0;
    }

    if (group === "bridge") {
      return runBridgeCommand(command, argv.slice(2), io);
    }

    if (group === "agent") {
      return runAgentCommand(command, argv.slice(2), io);
    }

    printUsage(io);
    return group === "help" || group === "--help" || group === "-h" ? 0 : 1;
  } catch (error) {
    io.stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function runBridgeCommand(command: string, args: string[], io: ForgeCliIo) {
  if (command === "bind") {
    const parsed = parseArgs({
      args,
      options: {
        server: {
          type: "string"
        },
        token: {
          type: "string"
        }
      },
      strict: true
    });
    const serverUrl = normalizeServerUrl(parsed.values.server ?? "");

    if (!serverUrl) {
      throw new Error("Missing required option: --server <url>");
    }

    const state = await loadForgeCliState({ env: io.env });
    const authToken =
      parsed.values.token?.trim() ||
      (await readLocalForgeAuthToken({ env: io.env })) ||
      state.config.authToken;

    if (!authToken) {
      throw new Error(
        "Missing Forge API token. Pass --token <token> or set FORGE_AUTH_TOKEN."
      );
    }

    await saveForgeCliState(
      {
        ...state,
        config: {
          ...state.config,
          authToken,
          serverUrl
        }
      },
      { env: io.env }
    );
    io.stdout(`forgecli bridge bound to ${serverUrl}`);
    return 0;
  }

  if (command === "status") {
    const state = await loadForgeCliState({ env: io.env });
    const status = await readBridgeStatus({ env: io.env });
    const agentNames = state.agents.map((agent) => agent.name).join(", ") || "none";

    io.stdout(`status: ${status.status}`);
    io.stdout(`server: ${state.config.serverUrl || "unbound"}`);
    io.stdout(`bridge: ${state.config.bridgeId}`);
    io.stdout(`agents: ${agentNames}`);
    return 0;
  }

  if (command === "start") {
    const pid = await startBridgeDaemon({ env: io.env });

    io.stdout(`forgecli bridge started${pid ? ` with pid ${pid}` : ""}`);
    return 0;
  }

  if (command === "stop") {
    await stopBridgeDaemon({ env: io.env });
    io.stdout("forgecli bridge stopped");
    return 0;
  }

  if (command === "run") {
    await runBridgeDaemon({ env: io.env });
    return 0;
  }

  printUsage(io);
  return 1;
}

async function runAgentCommand(command: string, args: string[], io: ForgeCliIo) {
  if (command === "add") {
    const parsed = parseArgs({
      allowPositionals: true,
      args,
      options: {
        command: {
          type: "string"
        },
        connector: {
          type: "string"
        },
        tool: {
          type: "string"
        }
      },
      strict: true
    });
    const [name] = parsed.positionals;
    const connector = parsed.values.connector;
    const agentCommand = parsed.values.command?.trim();

    if (!name?.trim()) {
      throw new Error("Missing agent name");
    }

    if (connector !== "cli" && connector !== "mcp") {
      throw new Error("Agent connector must be either cli or mcp");
    }

    if (!agentCommand) {
      throw new Error("Missing required option: --command <command>");
    }

    const state = await loadForgeCliState({ env: io.env });
    const agent: ForgeCliAgent = {
      ...(parsed.values.tool?.trim() ? { tool: parsed.values.tool.trim() } : {}),
      command: agentCommand,
      connector,
      name: name.trim()
    };
    const agents = [
      ...state.agents.filter((candidate) => candidate.name !== agent.name),
      agent
    ];

    await saveForgeCliState(
      {
        ...state,
        agents
      },
      { env: io.env }
    );
    io.stdout(`forgecli agent ${agent.name} registered with ${agent.connector}`);
    return 0;
  }

  if (command === "list") {
    const state = await loadForgeCliState({ env: io.env });

    if (state.agents.length === 0) {
      io.stdout("No local agents registered");
      return 0;
    }

    for (const agent of state.agents) {
      io.stdout(`${agent.name}\t${agent.connector}\t${agent.command}`);
    }

    return 0;
  }

  printUsage(io);
  return 1;
}

function printUsage(io: ForgeCliIo) {
  io.stdout("Usage:");
  io.stdout("  forgecli doctor");
  io.stdout("  forgecli bridge bind --server <url> [--token <token>]");
  io.stdout("  forgecli bridge start|status|stop|run");
  io.stdout("  forgecli agent add <name> --connector <cli|mcp> --command <command>");
  io.stdout("  forgecli agent list");
}

if (isDirectRun() && process.env.FORGECLI_DAEMON !== "1") {
  runForgeCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}

function isDirectRun() {
  return process.argv[1] === fileURLToPath(import.meta.url);
}
