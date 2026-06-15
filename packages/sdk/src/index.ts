import type {
  createHealthPayload,
  WorkflowAgent as CoreWorkflowAgent,
  WorkflowArtifact as CoreWorkflowArtifact,
  WorkflowArtifactType as CoreWorkflowArtifactType,
  WorkflowFile as CoreWorkflowFile,
  WorkflowHumanReview as CoreWorkflowHumanReview,
  WorkflowInput as CoreWorkflowInput,
  WorkflowInstruction as CoreWorkflowInstruction,
  WorkflowNode as CoreWorkflowNode,
  WorkflowNodeOutput as CoreWorkflowNodeOutput,
  WorkflowReviewMode as CoreWorkflowReviewMode,
  WorkflowScope as CoreWorkflowScope,
  WorkflowSkill as CoreWorkflowSkill,
  WorkflowVersion as CoreWorkflowVersion
} from "@forge/core";

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

export type UpdateProjectRequest = {
  name: string;
};

export type WorkflowScope = CoreWorkflowScope;
export type WorkflowVersion = CoreWorkflowVersion;
export type WorkflowReviewMode = CoreWorkflowReviewMode;
export type WorkflowArtifactType = CoreWorkflowArtifactType;
export type WorkflowInput = CoreWorkflowInput;
export type WorkflowSkill = CoreWorkflowSkill;
export type WorkflowAgent = CoreWorkflowAgent;
export type WorkflowArtifact = CoreWorkflowArtifact;
export type WorkflowInstruction = CoreWorkflowInstruction;
export type WorkflowNodeOutput = CoreWorkflowNodeOutput;
export type WorkflowHumanReview = CoreWorkflowHumanReview;
export type WorkflowNode = CoreWorkflowNode;
export type WorkflowFile = CoreWorkflowFile;

export type WorkflowFileMetadata = {
  id: string;
  name: string;
  scope: WorkflowScope;
  nodeCount: number;
  definition: string;
  createdAt: string;
};

export type RequirementStatus = "open" | "running" | "completed" | "failed";
export type TaskDraftStatus = "draft";
export type TaskStatus = "todo" | "in_progress" | "done";

export type Requirement = {
  id: string;
  projectId: string | null;
  title: string;
  body: string;
  workflowFileId: string;
  status: RequirementStatus;
  errorMessage: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskDraft = {
  id: string;
  projectId: string | null;
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
  projectId: string | null;
  requirementId: string;
  title: string;
  body: string;
  status: TaskStatus;
  deletedAt: string | null;
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

export type AgentConnectorType = "cli" | "mcp";
export type AgentBindingStatus = "online" | "offline" | "error";

export type AgentBinding = {
  id: string;
  name: string;
  connector: AgentConnectorType;
  command: string;
  capabilities: string[];
  status: AgentBindingStatus;
  lastSeenAt: string | null;
  errorMessage: string | null;
  updatedAt: string;
};

export type ModelProviderKind =
  | "openai-compatible"
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "groq"
  | "deepseek"
  | "openrouter"
  | "ollama"
  | "lmstudio";

export type ExecutionSettings = {
  modelProvider: ModelProviderKind;
  modelBaseUrl: string;
  modelName: string;
  modelConfigured: boolean;
  agentProxyUrl: string;
  agentProxyConfigured: boolean;
  updatedAt: string;
};

export type UpdateExecutionSettingsRequest = Partial<{
  modelProvider: ModelProviderKind;
  modelBaseUrl: string;
  modelName: string;
  modelApiKey: string;
  agentProxyUrl: string;
}>;

export type TestModelApiRequest = Partial<
  Pick<
    UpdateExecutionSettingsRequest,
    "modelApiKey" | "modelBaseUrl" | "modelName" | "modelProvider"
  >
>;

export type CreateRequirementRequest = {
  projectId?: string | null;
  title: string;
  body: string;
  workflowFileId: string;
};

export type UpdateRequirementRequest = {
  title: string;
};

export type UpdateWorkflowFileRequest = {
  name: string;
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
  planning?: {
    reason: "model_not_configured";
    status: "blocked";
  };
  requirement: Requirement;
  taskDrafts: TaskDraft[];
};

export type ImportWorkflowFileResponse = {
  workflow: WorkflowFile;
  workflowFile: WorkflowFileMetadata;
};

export type UpdateWorkflowFileResponse = {
  workflowFile: WorkflowFileMetadata;
};

function apiUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}/api${path}`;
}

export async function getServerHealth(baseUrl = ""): Promise<ServerHealth> {
  const response = await fetch(apiUrl(baseUrl, "/health"));

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json() as Promise<ServerHealth>;
}

export async function listProjects(baseUrl = ""): Promise<Project[]> {
  const response = await fetch(apiUrl(baseUrl, "/projects"));

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
  const response = await fetch(apiUrl(baseUrl, "/projects"), {
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

export async function updateProject(
  projectId: string,
  input: UpdateProjectRequest,
  baseUrl = ""
): Promise<Project> {
  const response = await fetch(apiUrl(baseUrl, `/projects/${projectId}`), {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json"
    },
    method: "PATCH"
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(body?.error ?? `Project update failed with status ${response.status}`);
  }

  return response.json() as Promise<Project>;
}

export async function listAgentBindings(
  baseUrl = ""
): Promise<AgentBinding[]> {
  const response = await fetch(apiUrl(baseUrl, "/agent-bindings"));

  if (!response.ok) {
    throw new Error(`Agent Binding list failed with status ${response.status}`);
  }

  const body = (await response.json()) as { agentBindings: AgentBinding[] };

  return body.agentBindings;
}

export async function getExecutionSettings(
  baseUrl = ""
): Promise<ExecutionSettings> {
  const response = await fetch(apiUrl(baseUrl, "/execution-settings"));

  if (!response.ok) {
    throw new Error(`Execution settings load failed with status ${response.status}`);
  }

  const body = (await response.json()) as {
    executionSettings: ExecutionSettings;
  };

  return body.executionSettings;
}

export async function updateExecutionSettings(
  input: UpdateExecutionSettingsRequest,
  baseUrl = ""
): Promise<ExecutionSettings> {
  const response = await fetch(apiUrl(baseUrl, "/execution-settings"), {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json"
    },
    method: "PATCH"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Execution settings update failed");
  }

  const body = (await response.json()) as {
    executionSettings: ExecutionSettings;
  };

  return body.executionSettings;
}

export async function testModelApi(
  input: TestModelApiRequest,
  baseUrl = ""
): Promise<void> {
  const response = await fetch(apiUrl(baseUrl, "/execution-settings/model/test"), {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Model API test failed");
  }
}

export async function listWorkflowFiles(
  baseUrl = ""
): Promise<WorkflowFileMetadata[]> {
  const response = await fetch(apiUrl(baseUrl, "/workflow-files"));

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
  const response = await fetch(apiUrl(baseUrl, "/workflow-files/import"), {
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

export async function updateWorkflowFile(
  id: string,
  input: UpdateWorkflowFileRequest,
  baseUrl = ""
): Promise<WorkflowFileMetadata> {
  const response = await fetch(apiUrl(baseUrl, `/workflow-files/${id}`), {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json"
    },
    method: "PATCH"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Workflow update failed");
  }

  const body = (await response.json()) as UpdateWorkflowFileResponse;

  return body.workflowFile;
}

export async function listRequirements(baseUrl = ""): Promise<Requirement[]> {
  const response = await fetch(apiUrl(baseUrl, "/requirements"));

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
  const response = await fetch(apiUrl(baseUrl, "/requirements"), {
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

export async function planRequirementTaskDrafts(
  id: string,
  baseUrl = ""
): Promise<CreateRequirementResponse> {
  const response = await fetch(apiUrl(baseUrl, `/requirements/${id}/task-drafts`), {
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Requirement planning failed");
  }

  return response.json() as Promise<CreateRequirementResponse>;
}

export async function deleteRequirement(
  id: string,
  baseUrl = ""
): Promise<void> {
  const response = await fetch(apiUrl(baseUrl, `/requirements/${id}`), {
    method: "DELETE"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Requirement deletion failed");
  }
}

export async function updateRequirement(
  id: string,
  input: UpdateRequirementRequest,
  baseUrl = ""
): Promise<Requirement> {
  const response = await fetch(apiUrl(baseUrl, `/requirements/${id}`), {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json"
    },
    method: "PATCH"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Requirement update failed");
  }

  return response.json() as Promise<Requirement>;
}

export async function listTaskDrafts(baseUrl = ""): Promise<TaskDraft[]> {
  const response = await fetch(apiUrl(baseUrl, "/task-drafts"));

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
  const response = await fetch(apiUrl(baseUrl, `/task-drafts/${id}`), {
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
  const response = await fetch(apiUrl(baseUrl, `/task-drafts/${id}`), {
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
  const response = await fetch(apiUrl(baseUrl, "/task-drafts/reorder"), {
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
  const response = await fetch(apiUrl(baseUrl, `/task-drafts/${id}/approve`), {
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
  const response = await fetch(apiUrl(baseUrl, "/tasks"));

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
  const response = await fetch(apiUrl(baseUrl, `/tasks/${taskId}/workflow-runs`), {
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
  const response = await fetch(apiUrl(baseUrl, `/tasks/${taskId}/workflow-runs`));

  if (!response.ok) {
    throw new Error(`Workflow run list failed with status ${response.status}`);
  }

  const body = (await response.json()) as {
    workflowRuns: WorkflowRunWithNodes[];
  };

  return body.workflowRuns;
}
