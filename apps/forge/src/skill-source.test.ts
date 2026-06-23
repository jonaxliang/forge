import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  getSkillStoragePath,
  parseRemoteSkillSource,
  parseUploadedSkillArchive,
  writeSkillFiles
} from "./skill-source";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  );
});

function createZipArchiveBase64(files: Array<{ content: string; path: string }>) {
  let offset = 0;
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];

  for (const file of files) {
    const fileName = Buffer.from(file.path);
    const content = Buffer.from(file.content);
    const localHeaderOffset = offset;
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, fileName, content);
    offset += localHeader.length + fileName.length + content.length;

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localHeaderOffset, 42);
    centralParts.push(centralHeader, fileName);
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralParts.reduce(
    (total, part) => total + part.length,
    0
  );
  const endOfCentralDirectory = Buffer.alloc(22);

  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(files.length, 8);
  endOfCentralDirectory.writeUInt16LE(files.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectorySize, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([
    ...localParts,
    ...centralParts,
    endOfCentralDirectory
  ]).toString("base64");
}

describe("Skill source parsing", () => {
  it("parses uploaded Skill zip archives", () => {
    const skill = parseUploadedSkillArchive({
      contentBase64: createZipArchiveBase64([
        {
          content:
            "---\nname: code-review\ndescription: Reviews code.\n---\n# Code Review",
          path: "package/SKILL.md"
        }
      ]),
      name: "code-review.zip"
    });

    expect(skill).toMatchObject({
      body: "# Code Review",
      description: "Reviews code.",
      files: [{ path: "SKILL.md" }],
      name: "code-review"
    });
  });

  it("parses remote raw SKILL.md sources", async () => {
    const skill = await parseRemoteSkillSource("https://example.com/SKILL.md", async () =>
      new Response(
        "---\nname: remote-skill\ndescription: Remote Skill.\n---\n# Remote",
        {
          headers: { "content-type": "text/markdown" },
          status: 200
        }
      )
    );

    expect(skill).toMatchObject({
      body: "# Remote",
      description: "Remote Skill.",
      name: "remote-skill"
    });
  });

  it("writes Skill files under the storage path", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "forge-skill-source-"));
    temporaryDirectories.push(storageRoot);
    const storagePath = getSkillStoragePath(storageRoot, "proj_test", "code-review");

    await writeSkillFiles(storagePath, [
      { content: "# Code Review", path: "SKILL.md" },
      { content: "More context", path: "references/context.md" }
    ]);

    await expect(readFile(join(storagePath, "SKILL.md"), "utf8")).resolves.toBe(
      "# Code Review"
    );
    await expect(
      readFile(join(storagePath, "references", "context.md"), "utf8")
    ).resolves.toBe("More context");
  });
});
