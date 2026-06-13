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
  definition: string;
  createdAt: string;
};

export type RequirementStatus = "running" | "completed" | "failed";
export type TaskDraftStatus = "draft";
export type TaskStatus = "todo" | "in_progress" | "done";

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

export type Task = {
  id: string;
  requirementId: string;
  title: string;
  body: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
};

export type NodeStatus =
  | "idle"
  | "queued"
  | "running"
  | "waiting"
  | "blocked"
  | "reviewing"
  | "failed"
  | "succeeded"
  | "skipped";

export type WorkflowRunStatus = "running" | "succeeded" | "failed";

export type WorkflowRun = {
  id: string;
  taskId: string;
  workflowFileId: string;
  status: WorkflowRunStatus;
  createdAt: string;
  updatedAt: string;
};

export type NodeRun = {
  id: string;
  workflowRunId: string;
  nodeId: string;
  dependsOn: string[];
  status: NodeStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowRunWithNodes = {
  workflowRun: WorkflowRun;
  nodeRuns: NodeRun[];
};

export type CreateRequirementRequest = {
  title: string;
  body: string;
  workflowFileId: string;
};

export type UpdateTaskDraftRequest = {
  title: string;
  body: string;
};

export type TaskDraftOrderItem = {
  id: string;
  sortOrder: number;
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

export async function updateTaskDraft(
  id: string,
  input: UpdateTaskDraftRequest,
  baseUrl = ""
): Promise<TaskDraft> {
  const response = await fetch(`${baseUrl}/task-drafts/${id}`, {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json"
    },
    method: "PATCH"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Task draft update failed");
  }

  return response.json() as Promise<TaskDraft>;
}

export async function deleteTaskDraft(
  id: string,
  baseUrl = ""
): Promise<void> {
  const response = await fetch(`${baseUrl}/task-drafts/${id}`, {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error(`Task draft deletion failed with status ${response.status}`);
  }
}

export async function reorderTaskDrafts(
  order: TaskDraftOrderItem[],
  baseUrl = ""
): Promise<TaskDraft[]> {
  const response = await fetch(`${baseUrl}/task-drafts/reorder`, {
    body: JSON.stringify({ order }),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Task draft reorder failed");
  }

  const body = (await response.json()) as { taskDrafts: TaskDraft[] };

  return body.taskDrafts;
}

export async function approveTaskDraft(
  id: string,
  baseUrl = ""
): Promise<Task> {
  const response = await fetch(`${baseUrl}/task-drafts/${id}/approve`, {
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Task draft approval failed");
  }

  const body = (await response.json()) as { task: Task };

  return body.task;
}

export async function listTasks(baseUrl = ""): Promise<Task[]> {
  const response = await fetch(`${baseUrl}/tasks`);

  if (!response.ok) {
    throw new Error(`Task list failed with status ${response.status}`);
  }

  const body = (await response.json()) as { tasks: Task[] };

  return body.tasks;
}

export async function startTaskWorkflowRun(
  taskId: string,
  workflowFileId: string,
  baseUrl = ""
): Promise<WorkflowRunWithNodes> {
  const response = await fetch(`${baseUrl}/tasks/${taskId}/workflow-runs`, {
    body: JSON.stringify({ workflowFileId }),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Workflow run start failed");
  }

  return response.json() as Promise<WorkflowRunWithNodes>;
}

export async function listTaskWorkflowRuns(
  taskId: string,
  baseUrl = ""
): Promise<WorkflowRunWithNodes[]> {
  const response = await fetch(`${baseUrl}/tasks/${taskId}/workflow-runs`);

  if (!response.ok) {
    throw new Error(`Workflow run list failed with status ${response.status}`);
  }

  const body = (await response.json()) as {
    workflowRuns: WorkflowRunWithNodes[];
  };

  return body.workflowRuns;
}
