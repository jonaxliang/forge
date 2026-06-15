import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(scriptDirectory, "..");
const webDistRoot = join(serverRoot, "web/dist");
const bundledRoot = join(serverRoot, "dist/web");

await rm(bundledRoot, { force: true, recursive: true });
await mkdir(bundledRoot, { recursive: true });
await cp(webDistRoot, bundledRoot, { recursive: true });

console.log(`Bundled Forge Web console assets into ${bundledRoot}`);
