import type { createHealthPayload } from "@forge/core";

export type ServerHealth = ReturnType<typeof createHealthPayload>;

export async function getServerHealth(baseUrl = ""): Promise<ServerHealth> {
  const response = await fetch(`${baseUrl}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json() as Promise<ServerHealth>;
}
