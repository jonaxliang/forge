import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  isLoopbackHost,
  resolveForgeServerSecurity
} from "./server-security";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  );
});

describe("Forge server security", () => {
  it("binds to loopback by default and stores a private local auth token", async () => {
    const home = await mkdtemp(join(tmpdir(), "forge-security-"));
    temporaryDirectories.push(home);

    const security = resolveForgeServerSecurity({ home });
    const tokenStat = await stat(security.authTokenPath!);

    expect(security).toMatchObject({
      host: "127.0.0.1",
      requireApiToken: false
    });
    expect(security.authToken).toHaveLength(43);
    await expect(readFile(security.authTokenPath!, "utf8")).resolves.toBe(
      `${security.authToken}\n`
    );
    expect(tokenStat.mode & 0o777).toBe(0o600);
  });

  it("requires API authentication for an explicitly remote listener", async () => {
    const home = await mkdtemp(join(tmpdir(), "forge-security-"));
    temporaryDirectories.push(home);

    expect(
      resolveForgeServerSecurity({
        configuredHost: "0.0.0.0",
        configuredToken: "a-secure-forge-token-with-at-least-32-characters",
        home
      })
    ).toMatchObject({
      authToken: "a-secure-forge-token-with-at-least-32-characters",
      authTokenPath: null,
      host: "0.0.0.0",
      requireApiToken: true
    });
  });

  it("rejects short configured tokens", () => {
    expect(() =>
      resolveForgeServerSecurity({
        configuredHost: "0.0.0.0",
        configuredToken: "too-short"
      })
    ).toThrow(/at least 32 characters/);
  });

  it("recognizes IPv4 and IPv6 loopback hosts", () => {
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
  });
});
