import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runBridgeDaemon } from "./bridge-daemon";
import { executeCliAgent } from "./connectors";
import {
  loadForgeCliState,
  resolveForgeCliPaths,
  saveForgeCliState
} from "./state";
import { runForgeCli } from "./index";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  );
});

async function createHome() {
  const directory = await mkdtemp(join(tmpdir(), "forgecli-test-"));
  temporaryDirectories.push(directory);

  return directory;
}

describe("forgecli local state", () => {
  it("binds a Forge Server URL into the local config directory", async () => {
    const home = await createHome();
    const cliHome = join(home, "cli");
    const authToken = "a-local-forge-auth-token-with-at-least-32-characters";
    const output: string[] = [];

    await mkdir(join(home, ".forge"), { recursive: true });
    await writeFile(join(home, ".forge", "auth-token"), `${authToken}\n`);
    const exitCode = await runForgeCli(
      ["bridge", "bind", "--server", "http://localhost:3001/"],
      {
        env: { FORGECLI_HOME: cliHome, HOME: home },
        stderr: (line) => output.push(line),
        stdout: (line) => output.push(line)
      }
    );

    await expect(
      loadForgeCliState({ env: { FORGECLI_HOME: cliHome, HOME: home } })
    ).resolves.toMatchObject({
      config: {
        authToken,
        serverUrl: "http://localhost:3001"
      }
    });
    expect(
      (
        await stat(
          resolveForgeCliPaths({
            env: { FORGECLI_HOME: cliHome, HOME: home }
          }).configFile
        )
      ).mode & 0o777
    ).toBe(0o600);
    expect(exitCode).toBe(0);
    expect(output.join("\n")).toContain("bound to http://localhost:3001");
  });

  it("registers CLI and MCP agents in local state", async () => {
    const home = await createHome();

    const cliExitCode = await runForgeCli(
      ["agent", "add", "coco", "--connector", "cli", "--command", "coco run"],
      {
        env: { FORGECLI_HOME: home },
        stderr: () => undefined,
        stdout: () => undefined
      }
    );
    const mcpExitCode = await runForgeCli(
      [
        "agent",
        "add",
        "codex",
        "--connector",
        "mcp",
        "--command",
        "codex mcp-server",
        "--tool",
        "codex"
      ],
      {
        env: { FORGECLI_HOME: home },
        stderr: () => undefined,
        stdout: () => undefined
      }
    );

    await expect(loadForgeCliState({ env: { FORGECLI_HOME: home } })).resolves.toMatchObject({
      agents: [
        {
          command: "coco run",
          connector: "cli",
          name: "coco"
        },
        {
          command: "codex mcp-server",
          connector: "mcp",
          name: "codex",
          tool: "codex"
        }
      ]
    });
    expect(cliExitCode).toBe(0);
    expect(mcpExitCode).toBe(0);
  });
});

describe("Bridge daemon authentication", () => {
  it("exchanges the server token for a Bridge identity token", async () => {
    const home = await createHome();
    const authToken = "a-server-auth-token-with-at-least-32-characters";
    const bridgeToken = "a-bridge-identity-token";
    const calls: Array<{ headers: Record<string, string>; url: string }> = [];

    await saveForgeCliState(
      {
        agents: [
          {
            command: "agent run",
            connector: "cli",
            name: "local-agent"
          }
        ],
        config: {
          authToken,
          bridgeId: "bridge_local",
          pollIntervalMs: 1,
          serverUrl: "http://localhost:3001"
        }
      },
      { env: { FORGECLI_HOME: home } }
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        calls.push({
          headers: init?.headers as Record<string, string>,
          url
        });

        if (url.endsWith("/api/bridges/register")) {
          return Response.json({ bridgeToken });
        }

        if (url.endsWith("/jobs/next")) {
          return Response.json({ job: null });
        }

        return Response.json({ ok: true });
      })
    );

    await runBridgeDaemon({
      env: { FORGECLI_HOME: home },
      once: true
    });

    expect(calls).toHaveLength(3);
    expect(calls[0]!.headers.authorization).toBe(`Bearer ${authToken}`);
    expect(calls[1]!.headers.authorization).toBe(`Bearer ${bridgeToken}`);
    expect(calls[2]!.headers.authorization).toBe(`Bearer ${bridgeToken}`);
  });
});

describe("CLI Connector", () => {
  it("passes the bridge job payload on stdin and captures stdout", async () => {
    const home = await createHome();
    const scriptPath = join(home, "agent.mjs");

    await writeFile(
      scriptPath,
      [
        "let input = '';",
        "process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', (chunk) => input += chunk);",
        "process.stdin.on('end', () => {",
        "  const payload = JSON.parse(input);",
        "  process.stdout.write(`handled:${payload.nodeRun.nodeId}`);",
        "});"
      ].join("\n")
    );

    const result = await executeCliAgent(
      {
        command: `${process.execPath} ${scriptPath}`,
        connector: "cli",
        name: "coco"
      },
      {
        id: "job_1",
        nodeRun: {
          id: "ndr_1",
          nodeId: "implement"
        },
        task: {
          body: "Use the local agent.",
          id: "tsk_1",
          title: "Run local agent"
        }
      }
    );

    expect(result).toMatchObject({
      exitCode: 0,
      stderr: "",
      stdout: "handled:implement"
    });
  });

  it("reports a failed local command without throwing away stderr", async () => {
    const home = await createHome();
    const scriptPath = join(home, "fail.mjs");

    await writeFile(
      scriptPath,
      "process.stderr.write('agent failed'); process.exit(7);"
    );

    const result = await executeCliAgent(
      {
        command: `${process.execPath} ${scriptPath}`,
        connector: "cli",
        name: "coco"
      },
      {
        id: "job_1",
        nodeRun: {
          id: "ndr_1",
          nodeId: "implement"
        },
        task: {
          body: "Use the local agent.",
          id: "tsk_1",
          title: "Run local agent"
        }
      }
    );

    expect(result).toMatchObject({
      exitCode: 7,
      stderr: "agent failed",
      stdout: ""
    });
  });

  it("runs a local command inside the Bridge job worktree when provided", async () => {
    const home = await createHome();
    const worktreePath = join(home, "worktrees", "job_1");
    const scriptPath = join(home, "read-marker.mjs");

    await mkdir(worktreePath, { recursive: true });
    await writeFile(join(worktreePath, "marker.txt"), "isolated worktree");
    await writeFile(
      scriptPath,
      [
        "import { readFileSync } from 'node:fs';",
        "process.stdout.write(readFileSync('marker.txt', 'utf8'));"
      ].join("\n")
    );

    const result = await executeCliAgent(
      {
        command: `${process.execPath} ${scriptPath}`,
        connector: "cli",
        name: "coco"
      },
      {
        id: "job_1",
        nodeRun: {
          id: "ndr_1",
          nodeId: "implement"
        },
        workspace: {
          worktreePath
        }
      }
    );

    expect(result).toMatchObject({
      exitCode: 0,
      stderr: "",
      stdout: "isolated worktree"
    });
  });
});

describe("bridge status", () => {
  it("shows bound server and registered agents", async () => {
    const home = await createHome();
    const output: string[] = [];

    await saveForgeCliState(
      {
        agents: [
          {
            command: "coco run",
            connector: "cli",
            name: "coco"
          }
        ],
        config: {
          serverUrl: "http://localhost:3001"
        }
      },
      { env: { FORGECLI_HOME: home } }
    );

    const exitCode = await runForgeCli(["bridge", "status"], {
      env: { FORGECLI_HOME: home },
      stderr: (line) => output.push(line),
      stdout: (line) => output.push(line)
    });

    expect(exitCode).toBe(0);
    expect(output.join("\n")).toContain("server: http://localhost:3001");
    expect(output.join("\n")).toContain("agents: coco");
  });
});
