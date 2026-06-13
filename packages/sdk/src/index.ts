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

export type WorkflowScope = "requirement" | "task";

export type WorkflowNode = {
  id: string;
  type: string;
  dependsOn: string[];
  executor: string;
  outputs: string[];
  exit: {
    maxRetries: number;
  };
};

export type WorkflowFile = {
  name: string;
  scope: WorkflowScope;
  nodes: WorkflowNode[];
};

export type WorkflowFileMetadata = {
  id: string;
  name: string;
  scope: WorkflowScope;
  nodeCount: number;
  createdAt: string;
};

export type RequirementStatus = "running" | "completed" | "failed";
export type TaskDraftStatus = "draft";

export type Requirement = {
  id: string;
  title: string;
  body: string;
  workflowFileId: string;
  status: RequirementStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskDraft = {
  id: string;
  requirementId: string;
  title: string;
  body: string;
  sortOrder: number;
  status: TaskDraftStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateRequirementRequest = {
  title: string;
  body: string;
  workflowFileId: string;
};

export type CreateRequirementResponse = {
  requirement: Requirement;
  taskDrafts: TaskDraft[];
};

export type ImportWorkflowFileResponse = {
  workflow: WorkflowFile;
  workflowFile: WorkflowFileMetadata;
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

export async function listWorkflowFiles(
  baseUrl = ""
): Promise<WorkflowFileMetadata[]> {
  const response = await fetch(`${baseUrl}/workflow-files`);

  if (!response.ok) {
    throw new Error(`Workflow file list failed with status ${response.status}`);
  }

  const body = (await response.json()) as {
    workflowFiles: WorkflowFileMetadata[];
  };

  return body.workflowFiles;
}

export async function importWorkflowFile(
  source: string,
  baseUrl = ""
): Promise<ImportWorkflowFileResponse> {
  const response = await fetch(`${baseUrl}/workflow-files/import`, {
    body: JSON.stringify({ source }),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Workflow import failed");
  }

  return response.json() as Promise<ImportWorkflowFileResponse>;
}

export async function listRequirements(baseUrl = ""): Promise<Requirement[]> {
  const response = await fetch(`${baseUrl}/requirements`);

  if (!response.ok) {
    throw new Error(`Requirement list failed with status ${response.status}`);
  }

  const body = (await response.json()) as { requirements: Requirement[] };

  return body.requirements;
}

export async function createRequirement(
  input: CreateRequirementRequest,
  baseUrl = ""
): Promise<CreateRequirementResponse> {
  const response = await fetch(`${baseUrl}/requirements`, {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Requirement creation failed");
  }

  return response.json() as Promise<CreateRequirementResponse>;
}

export async function listTaskDrafts(baseUrl = ""): Promise<TaskDraft[]> {
  const response = await fetch(`${baseUrl}/task-drafts`);

  if (!response.ok) {
    throw new Error(`Task draft list failed with status ${response.status}`);
  }

  const body = (await response.json()) as { taskDrafts: TaskDraft[] };

  return body.taskDrafts;
}
