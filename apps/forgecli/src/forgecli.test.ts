import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { executeCliAgent } from "./connectors";
import { loadForgeCliState, saveForgeCliState } from "./state";
import { runForgeCli } from "./index";

const temporaryDirectories: string[] = [];

afterEach(async () => {
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
    const output: string[] = [];

    const exitCode = await runForgeCli(
      ["bridge", "bind", "--server", "http://localhost:3001/"],
      {
        env: { FORGECLI_HOME: home },
        stderr: (line) => output.push(line),
        stdout: (line) => output.push(line)
      }
    );

    await expect(loadForgeCliState({ env: { FORGECLI_HOME: home } })).resolves.toMatchObject({
      config: {
        serverUrl: "http://localhost:3001"
      }
    });
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
