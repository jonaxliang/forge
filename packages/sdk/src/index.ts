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
  templateType?: "builtin" | "custom";
  createdAt: string;
};

export type RequirementStatus =
  | "init"
  | "decomposing"
  | "decomposition_failed"
  | "ready_to_generate_tasks"
  | "tasks_generated"
  | "completed";
export type TaskStatus =
  | "init"
  | "running"
  | "failed"
  | "pending_acceptance"
  | "completed"
  | "cancelled";

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

export type DecompositionResultItem = {
  title: string;
  body: string;
  sortOrder: number;
};

export type DecompositionResult = {
  id: string;
  projectId: string | null;
  requirementId: string;
  summary: string;
  items: DecompositionResultItem[];
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

export type UpdateDecompositionResultRequest = {
  summary: string;
  tasks: Array<{
    title: string;
    body: string;
  }>;
};

export type CreateRequirementResponse = {
  decompositionResult: DecompositionResult | null;
  requirement: Requirement;
};

export type CreateDecompositionResultResponse = {
  decompositionResult: DecompositionResult | null;
  error?: string;
  planning?: {
    reason: "model_not_configured";
    status: "blocked";
  };
  requirement: Requirement;
};

export type GenerateTasksResponse = {
  requirement: Requirement;
  tasks: Task[];
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
  baseUrl = "",
  options: { templateType?: WorkflowFileMetadata["templateType"] } = {}
): Promise<ImportWorkflowFileResponse> {
  const response = await fetch(apiUrl(baseUrl, "/workflow-files/import"), {
    body: JSON.stringify({ source, ...options }),
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

export async function createRequirementDecompositionResult(
  id: string,
  baseUrl = ""
): Promise<CreateDecompositionResultResponse> {
  const response = await fetch(
    apiUrl(baseUrl, `/requirements/${id}/decomposition-result`),
    {
      method: "POST"
    }
  );

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Requirement decomposition failed");
  }

  return response.json() as Promise<CreateDecompositionResultResponse>;
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

export async function listDecompositionResults(
  baseUrl = ""
): Promise<DecompositionResult[]> {
  const response = await fetch(apiUrl(baseUrl, "/decomposition-results"));

  if (!response.ok) {
    throw new Error(
      `Decomposition result list failed with status ${response.status}`
    );
  }

  const body = (await response.json()) as {
    decompositionResults: DecompositionResult[];
  };

  return body.decompositionResults;
}

export async function updateDecompositionResult(
  id: string,
  input: UpdateDecompositionResultRequest,
  baseUrl = ""
): Promise<DecompositionResult> {
  const response = await fetch(apiUrl(baseUrl, `/decomposition-results/${id}`), {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json"
    },
    method: "PATCH"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Decomposition result update failed");
  }

  const body = (await response.json()) as {
    decompositionResult: DecompositionResult;
  };

  return body.decompositionResult;
}

export async function generateTasksFromDecompositionResult(
  id: string,
  baseUrl = ""
): Promise<GenerateTasksResponse> {
  const response = await fetch(
    apiUrl(baseUrl, `/decomposition-results/${id}/generate-tasks`),
    {
      method: "POST"
    }
  );

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Task generation failed");
  }

  return response.json() as Promise<GenerateTasksResponse>;
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
