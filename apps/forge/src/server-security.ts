import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const minimumAuthTokenLength = 32;

export function isLoopbackHost(host: string) {
  const normalizedHost = host.trim().toLowerCase().replace(/^\[(.*)\]$/, "$1");

  return (
    normalizedHost === "localhost" ||
    normalizedHost === "::1" ||
    normalizedHost.startsWith("127.")
  );
}

export function resolveForgeServerSecurity({
  configuredHost,
  configuredToken,
  home = homedir()
}: {
  configuredHost?: string;
  configuredToken?: string;
  home?: string;
} = {}) {
  const host = configuredHost?.trim() || "127.0.0.1";
  const configuredAuthToken = configuredToken?.trim();

  if (configuredAuthToken) {
    assertSecureAuthToken(configuredAuthToken);

    return {
      authToken: configuredAuthToken,
      authTokenPath: null,
      host,
      requireApiToken: !isLoopbackHost(host)
    };
  }

  const authTokenPath = join(home, ".forge", "auth-token");
  const authToken = loadOrCreateAuthToken(authTokenPath);

  return {
    authToken,
    authTokenPath,
    host,
    requireApiToken: !isLoopbackHost(host)
  };
}

function loadOrCreateAuthToken(authTokenPath: string) {
  mkdirSync(join(authTokenPath, ".."), { mode: 0o700, recursive: true });

  if (existsSync(authTokenPath)) {
    const token = readFileSync(authTokenPath, "utf8").trim();

    assertSecureAuthToken(token);
    chmodSync(authTokenPath, 0o600);

    return token;
  }

  const token = randomBytes(32).toString("base64url");

  writeFileSync(authTokenPath, `${token}\n`, {
    flag: "wx",
    mode: 0o600
  });
  chmodSync(authTokenPath, 0o600);

  return token;
}

function assertSecureAuthToken(token: string) {
  if (token.length < minimumAuthTokenLength) {
    throw new Error(
      `FORGE_AUTH_TOKEN must contain at least ${minimumAuthTokenLength} characters`
    );
  }
}
