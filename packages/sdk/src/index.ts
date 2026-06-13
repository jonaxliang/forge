import type { createHealthPayload } from "@forge/core";

export type ServerHealth = ReturnType<typeof createHealthPayload>;

export type ArtifactStorageMode = "local-only" | "cloud";
export type DbStrategy = "sqlite" | "postgres" | "mysql";

export type Project = {
  id: string;
  name: string;
  artifactStorageMode: ArtifactStorageMode;
  dbStrategy: DbStrategy;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectRequest = {
  name: string;
  artifactStorageMode: ArtifactStorageMode;
  dbStrategy: DbStrategy;
};

export async function getServerHealth(baseUrl = ""): Promise<ServerHealth> {
  const response = await fetch(`${baseUrl}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json() as Promise<ServerHealth>;
}

export async function listProjects(baseUrl = ""): Promise<Project[]> {
  const response = await fetch(`${baseUrl}/projects`);

  if (!response.ok) {
    throw new Error(`Project list failed with status ${response.status}`);
  }

  const body = (await response.json()) as { projects: Project[] };

  return body.projects;
}

export async function createProject(
  input: CreateProjectRequest,
  baseUrl = ""
): Promise<Project> {
  const response = await fetch(`${baseUrl}/projects`, {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Project creation failed with status ${response.status}`);
  }

  return response.json() as Promise<Project>;
}
