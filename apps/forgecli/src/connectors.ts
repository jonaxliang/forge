import { spawn } from "node:child_process";
import type { ForgeCliAgent } from "./state.js";

export type BridgeJobPayload = {
  id: string;
  nodeRun?: unknown;
  task?: unknown;
  workflowFile?: unknown;
  workflowRun?: unknown;
};

export type AgentExecutionResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export async function executeAgent(
  agent: ForgeCliAgent,
  payload: BridgeJobPayload
): Promise<AgentExecutionResult> {
  if (agent.connector === "mcp") {
    return executeMcpAgent(agent, payload);
  }

  return executeCliAgent(agent, payload);
}

export async function executeCliAgent(
  agent: Pick<ForgeCliAgent, "command" | "connector" | "name">,
  payload: BridgeJobPayload
): Promise<AgentExecutionResult> {
  const command = splitCommand(agent.command);

  if (command.length === 0) {
    throw new Error(`Agent ${agent.name} has an empty command`);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout: string[] = [];
    const stderr: string[] = [];

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stderr: stderr.join(""),
        stdout: stdout.join("")
      });
    });
    child.stdin.end(`${JSON.stringify(payload)}\n`);
  });
}

export async function executeMcpAgent(
  agent: ForgeCliAgent,
  payload: BridgeJobPayload
): Promise<AgentExecutionResult> {
  const client = createMcpClient(agent.command);

  try {
    await client.request("initialize", {
      capabilities: {},
      clientInfo: {
        name: "forgecli",
        version: "0.0.0"
      },
      protocolVersion: "2025-11-25"
    });
    client.notify("notifications/initialized", {});
    const toolsResponse = await client.request("tools/list", {});
    const tools = readMcpTools(toolsResponse);
    const toolName = agent.tool ?? tools[0]?.name;

    if (!toolName) {
      throw new Error(`MCP agent ${agent.name} did not expose any tools`);
    }

    const result = await client.request("tools/call", {
      arguments: payload,
      name: toolName
    });

    return {
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify(result)
    };
  } finally {
    client.close();
  }
}

export function splitCommand(command: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  let escaping = false;

  for (const char of command.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error("Command contains an unterminated quote");
  }

  if (escaping) {
    current += "\\";
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

type JsonRpcMessage = {
  id?: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
};

function createMcpClient(commandLine: string) {
  const command = splitCommand(commandLine);

  if (command.length === 0) {
    throw new Error("MCP command is empty");
  }

  const child = spawn(command[0], command.slice(1), {
    stdio: ["pipe", "pipe", "pipe"]
  });
  let nextId = 1;
  let buffer = "";
  const pending = new Map<
    number,
    {
      reject(error: Error): void;
      resolve(value: unknown): void;
    }
  >();

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      const message = JSON.parse(line) as JsonRpcMessage;

      if (typeof message.id !== "number") {
        continue;
      }

      const waiter = pending.get(message.id);

      if (!waiter) {
        continue;
      }

      pending.delete(message.id);

      if (message.error) {
        waiter.reject(new Error(message.error.message));
      } else {
        waiter.resolve(message.result);
      }
    }
  });
  child.on("error", (error) => {
    for (const waiter of pending.values()) {
      waiter.reject(error);
    }
    pending.clear();
  });

  return {
    close() {
      child.kill("SIGTERM");
    },
    notify(method: string, params: unknown) {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    },
    request(method: string, params: unknown) {
      const id = nextId++;

      child.stdin.write(
        `${JSON.stringify({ id, jsonrpc: "2.0", method, params })}\n`
      );

      return new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`MCP request timed out: ${method}`));
        }, 15000);

        pending.set(id, {
          reject(error) {
            clearTimeout(timeout);
            reject(error);
          },
          resolve(value) {
            clearTimeout(timeout);
            resolve(value);
          }
        });
      });
    }
  };
}

function readMcpTools(response: unknown): Array<{ name: string }> {
  if (
    response &&
    typeof response === "object" &&
    "tools" in response &&
    Array.isArray(response.tools)
  ) {
    return response.tools.filter(
      (tool): tool is { name: string } =>
        Boolean(tool) && typeof tool === "object" && "name" in tool
    );
  }

  return [];
}
