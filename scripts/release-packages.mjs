import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = join(repositoryRoot, "release");
const platform = getPlatformName();

await run("pnpm", ["--filter", "@forge/forge", "build"]);
await run("pnpm", ["--filter", "@forge/forgecli", "build"]);

await createReleasePackage({
  commandName: "forge",
  packageName: "@forge/forge",
  targetDirectory: join(releaseRoot, `forge-${platform}`)
});
await createReleasePackage({
  commandName: "forgecli",
  packageName: "@forge/forgecli",
  targetDirectory: join(releaseRoot, `forgecli-${platform}`)
});

console.log(`Created release executables for ${platform}:`);
console.log(`- release/forge-${platform}/forge`);
console.log(`- release/forgecli-${platform}/forgecli`);

async function createReleasePackage({
  commandName,
  packageName,
  targetDirectory
}) {
  const appDirectory = join(targetDirectory, "app");

  await rm(targetDirectory, { force: true, recursive: true });
  await mkdir(targetDirectory, { recursive: true });
  await run("pnpm", ["--filter", packageName, "deploy", "--prod", appDirectory]);
  await pruneDeployDirectory(appDirectory);
  await writeLauncher({
    commandName,
    targetDirectory
  });
}

async function pruneDeployDirectory(appDirectory) {
  await Promise.all(
    [
      ".forge",
      ".turbo",
      "scripts",
      "src",
      "tsconfig.json",
      "web"
    ].map((path) => rm(join(appDirectory, path), { force: true, recursive: true }))
  );
}

async function writeLauncher({ commandName, targetDirectory }) {
  const launcherPath = join(targetDirectory, commandName);
  const dataPathSetup =
    commandName === "forge"
      ? `: "\${FORGE_SQLITE_PATH:=$HOME/.forge/forge.sqlite}"
export FORGE_SQLITE_PATH
`
      : "";
  const launcher = `#!/usr/bin/env sh
set -eu
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
${dataPathSetup}\
exec node "$DIR/app/dist/index.js" "$@"
`;

  await writeFile(launcherPath, launcher, "utf8");
  await chmod(launcherPath, 0o755);
}

async function run(command, args) {
  const { stderr, stdout } = await execFileAsync(command, args, {
    cwd: repositoryRoot,
    env: process.env,
    maxBuffer: 1024 * 1024 * 16
  });

  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }
}

function getPlatformName() {
  const osName =
    process.platform === "darwin" ? "macos" : process.platform;

  return `${osName}-${process.arch}`;
}
