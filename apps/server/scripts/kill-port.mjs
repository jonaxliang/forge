import { execFileSync } from "node:child_process";

const port = Number(process.argv[2] ?? 3001);

if (!Number.isInteger(port) || port <= 0) {
  console.error(`Invalid port: ${process.argv[2] ?? ""}`);
  process.exit(1);
}

const pids = findPortPids(port);

if (pids.length === 0) {
  process.exit(0);
}

for (const pid of pids) {
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (!isMissingProcessError(error)) {
      throw error;
    }
  }
}

await new Promise((resolve) => {
  setTimeout(resolve, 400);
});

for (const pid of pids) {
  try {
    process.kill(pid, 0);
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (!isMissingProcessError(error)) {
      throw error;
    }
  }
}

console.log(`Cleared port ${port}: ${pids.join(", ")}`);

function findPortPids(targetPort) {
  try {
    const output = execFileSync("lsof", ["-ti", `tcp:${targetPort}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });

    return [
      ...new Set(
        output
          .split(/\s+/)
          .filter(Boolean)
          .map((pid) => Number(pid))
          .filter((pid) => Number.isInteger(pid) && pid > 0)
      )
    ];
  } catch {
    return [];
  }
}

function isMissingProcessError(error) {
  return error && typeof error === "object" && "code" in error && error.code === "ESRCH";
}
