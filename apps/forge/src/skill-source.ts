import { mkdir, writeFile } from "node:fs/promises";
import { join, normalize, relative } from "node:path";
import { inflateRawSync } from "node:zlib";

export type SkillSourceFetcher = (url: string) => Promise<Response>;

export type SkillArchive = {
  contentBase64: string;
  name: string;
};

type UploadedSkillFile = {
  content: string;
  path: string;
};

type ResolvedSkillSource = {
  downloadUrl: string;
  pathPrefix: string;
};

export function parseUploadedSkillArchive(archive: SkillArchive) {
  if (!archive.name.toLowerCase().endsWith(".zip")) {
    throw new Error("Skill upload must be a .zip archive");
  }

  const archiveBuffer = Buffer.from(archive.contentBase64, "base64");

  if (archiveBuffer.length === 0) {
    throw new Error("Skill zip archive is empty");
  }

  return parseUploadedSkill(extractSkillZipFiles(archiveBuffer));
}

export async function parseRemoteSkillSource(
  sourceUrl: string,
  fetchSkillSource: SkillSourceFetcher
) {
  const source = resolveSkillSourceUrl(sourceUrl);
  const response = await fetchSkillSource(source.downloadUrl);

  if (!response.ok) {
    throw new Error(`Skill source fetch failed with status ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const sourceBuffer = Buffer.from(await response.arrayBuffer());

  if (
    source.downloadUrl.toLowerCase().endsWith(".md") ||
    contentType.includes("text/markdown") ||
    contentType.includes("text/plain")
  ) {
    return parseUploadedSkill([
      {
        content: sourceBuffer.toString("utf8"),
        path: "SKILL.md"
      }
    ]);
  }

  const zipFiles = stripSkillSourcePath(
    stripCommonSkillRoot(extractSkillZipFiles(sourceBuffer)),
    source.pathPrefix
  );

  return parseUploadedSkill(zipFiles);
}

export function getSkillStoragePath(
  root: string,
  projectId: string | null,
  skillName: string
) {
  return join(root, projectId ?? "global", skillName);
}

export async function writeSkillFiles(
  storagePath: string,
  files: Array<{ path: string; content: string }>
) {
  await mkdir(storagePath, { recursive: true });

  for (const file of files) {
    const targetPath = join(storagePath, file.path);
    const relativeTargetPath = relative(storagePath, targetPath);

    if (relativeTargetPath.startsWith("..") || relativeTargetPath === "") {
      throw new Error("Skill file path is invalid");
    }

    await mkdir(join(targetPath, ".."), { recursive: true });
    await writeFile(targetPath, file.content);
  }
}

function resolveSkillSourceUrl(sourceUrl: string): ResolvedSkillSource {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    throw new Error("Skill source URL is invalid");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Skill source URL must use HTTP or HTTPS");
  }

  if (parsedUrl.hostname === "github.com") {
    return resolveGitHubSkillSource(parsedUrl);
  }

  return {
    downloadUrl: parsedUrl.toString(),
    pathPrefix: ""
  };
}

function resolveGitHubSkillSource(url: URL): ResolvedSkillSource {
  const parts = url.pathname.split("/").filter(Boolean);
  const [owner, repository, action, branch, ...pathParts] = parts;

  if (!owner || !repository) {
    throw new Error("GitHub Skill source URL must include owner and repository");
  }

  if (action === "tree" || action === "blob") {
    if (!branch) {
      throw new Error("GitHub Skill source URL must include a branch");
    }

    if (action === "blob") {
      return {
        downloadUrl: `https://raw.githubusercontent.com/${owner}/${repository}/${branch}/${pathParts.join("/")}`,
        pathPrefix: ""
      };
    }

    return {
      downloadUrl: `https://codeload.github.com/${owner}/${repository}/zip/refs/heads/${branch}`,
      pathPrefix: normalizeSkillPathPrefix(pathParts.join("/"))
    };
  }

  if (
    action === "archive" ||
    url.hostname === "codeload.github.com" ||
    url.pathname.endsWith(".zip")
  ) {
    return {
      downloadUrl: url.toString(),
      pathPrefix: ""
    };
  }

  return {
    downloadUrl: `https://codeload.github.com/${owner}/${repository}/zip/refs/heads/main`,
    pathPrefix: ""
  };
}

function normalizeSkillPathPrefix(pathPrefix: string) {
  if (!pathPrefix.trim()) {
    return "";
  }

  const normalizedPrefix = normalizeSkillFilePath(pathPrefix);

  return normalizedPrefix.endsWith("/")
    ? normalizedPrefix
    : `${normalizedPrefix}/`;
}

function stripSkillSourcePath(
  files: UploadedSkillFile[],
  pathPrefix: string
) {
  if (!pathPrefix) {
    return files;
  }

  const matchingFiles = files
    .filter((file) => file.path.startsWith(pathPrefix))
    .map((file) => ({
      ...file,
      path: file.path.slice(pathPrefix.length)
    }))
    .filter((file) => file.path);

  if (matchingFiles.length === 0) {
    throw new Error("Skill source did not contain files at the requested path");
  }

  return matchingFiles;
}

function extractSkillZipFiles(archive: Buffer): UploadedSkillFile[] {
  const endOfCentralDirectoryOffset = findEndOfCentralDirectory(archive);
  const entryCount = archive.readUInt16LE(endOfCentralDirectoryOffset + 10);
  const centralDirectoryOffset = archive.readUInt32LE(
    endOfCentralDirectoryOffset + 16
  );
  const files: UploadedSkillFile[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Skill zip central directory is invalid");
    }

    const flags = archive.readUInt16LE(offset + 8);
    const compressionMethod = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const fileNameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localHeaderOffset = archive.readUInt32LE(offset + 42);
    const fileName = archive
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString(flags & 0x0800 ? "utf8" : "utf8");

    offset += 46 + fileNameLength + extraLength + commentLength;

    if (!fileName || fileName.endsWith("/")) {
      continue;
    }

    files.push({
      content: inflateZipEntry(archive, {
        compressedSize,
        compressionMethod,
        localHeaderOffset
      }).toString("utf8"),
      path: fileName
    });
  }

  if (files.length === 0) {
    throw new Error("Skill zip archive does not contain files");
  }

  return files;
}

function findEndOfCentralDirectory(archive: Buffer) {
  const minimumOffset = Math.max(0, archive.length - 0xffff - 22);

  for (let offset = archive.length - 22; offset >= minimumOffset; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("Skill upload must be a valid .zip archive");
}

function inflateZipEntry(
  archive: Buffer,
  entry: {
    compressedSize: number;
    compressionMethod: number;
    localHeaderOffset: number;
  }
) {
  if (archive.readUInt32LE(entry.localHeaderOffset) !== 0x04034b50) {
    throw new Error("Skill zip local file header is invalid");
  }

  const fileNameLength = archive.readUInt16LE(entry.localHeaderOffset + 26);
  const extraLength = archive.readUInt16LE(entry.localHeaderOffset + 28);
  const dataOffset = entry.localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressedData = archive.subarray(
    dataOffset,
    dataOffset + entry.compressedSize
  );

  if (entry.compressionMethod === 0) {
    return compressedData;
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressedData);
  }

  throw new Error("Skill zip contains an unsupported compression method");
}

function parseUploadedSkill(files: UploadedSkillFile[]) {
  const normalizedFiles = stripCommonSkillRoot(
    files.map((file) => ({
      content: file.content,
      path: normalizeSkillFilePath(file.path)
    }))
  );
  const skillFile = normalizedFiles.find((file) => file.path === "SKILL.md");

  if (!skillFile) {
    throw new Error("Uploaded Skill must include SKILL.md");
  }

  const frontmatter = parseSkillFrontmatter(skillFile.content);
  const name = sanitizeSkillName(frontmatter.name ?? "");
  const description = frontmatter.description?.trim() ?? "";

  if (!name || !description) {
    throw new Error("SKILL.md must include name and description frontmatter");
  }

  return {
    body: stripSkillFrontmatter(skillFile.content).trim() || skillFile.content.trim(),
    description,
    files: normalizedFiles,
    name
  };
}

function stripCommonSkillRoot(files: UploadedSkillFile[]) {
  if (files.some((file) => file.path === "SKILL.md")) {
    return files;
  }

  const topLevelDirectories = new Set(
    files
      .map((file) => file.path.split("/"))
      .filter((parts) => parts.length > 1)
      .map((parts) => parts[0])
  );

  if (topLevelDirectories.size !== 1) {
    return files;
  }

  const [commonRoot] = [...topLevelDirectories];
  const rootPrefix = `${commonRoot}/`;

  return files.map((file) => ({
    ...file,
    path: file.path.startsWith(rootPrefix)
      ? file.path.slice(rootPrefix.length)
      : file.path
  }));
}

function parseSkillFrontmatter(content: string) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!match) {
    return {};
  }

  const metadata: Record<string, string> = {};

  for (const line of match[1].split(/\r?\n/)) {
    const [key, ...valueParts] = line.split(":");
    const value = valueParts.join(":").trim();

    if (key?.trim() && value) {
      metadata[key.trim()] = value.replace(/^["']|["']$/g, "");
    }
  }

  return {
    description: metadata.description,
    name: metadata.name
  };
}

function stripSkillFrontmatter(content: string) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function sanitizeSkillName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSkillFilePath(filePath: string) {
  const normalizedPath = normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const withoutLeadingSlash = normalizedPath.replace(/^[/\\]+/, "");

  if (!withoutLeadingSlash || withoutLeadingSlash.startsWith("..")) {
    throw new Error("Skill file path is invalid");
  }

  return withoutLeadingSlash.split("\\").join("/");
}
