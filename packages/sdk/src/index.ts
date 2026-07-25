import type {
  createHealthPayload,
  ExitReviewResult as CoreExitReviewResult,
  NodeRunAttempt as CoreNodeRunAttempt,
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
  defaultExecutorType: ExecutorType;
  defaultExecutorAgentBindingId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectRequest = {
  name: string;
  artifactStorageMode: ArtifactStorageMode;
  dbStrategy: DbStrategy;
  defaultExecutorType?: ExecutorType;
  defaultExecutorAgentBindingId?: string | null;
};

export type UpdateProjectRequest = {
  name?: string;
  defaultExecutorType?: ExecutorType;
  defaultExecutorAgentBindingId?: string | null;
};

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
export type ExitReviewResult = CoreExitReviewResult;
export type NodeRunAttempt = CoreNodeRunAttempt;

export type WorkflowFileMetadata = {
  id: string;
  name: string;
  nodeCount: number;
  definition: string;
  templateType?: "builtin" | "custom";
  createdAt: string;
};

export type Skill = {
  id: string;
  projectId: string | null;
  name: string;
  ref: string;
  description: string;
  body: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  sourceUrl: string | null;
  storagePath: string;
  createdAt: string;
  updatedAt: string;
};

export type UploadSkillRequest = {
  projectId?: string | null;
  archive?: {
    name: string;
    contentBase64: string;
  };
  sourceUrl?: string;
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
export type ExecutorType = "model-api" | "agent-binding";

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
  id: string;
  title: string;
  body: string;
  sortOrder: number;
  dependsOn: string[];
  executorType: ExecutorType;
  executorAgentBindingId: string | null;
  executorLabel: string;
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
  sourceItemId: string;
  title: string;
  body: string;
  dependsOn: string[];
  executorType: ExecutorType;
  executorAgentBindingId: string | null;
  executorLabel: string;
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
  executorAssignments: Record<string, unknown>;
  correctionFeedback?: string | null;
  status: WorkflowRunStatus;
  createdAt: string;
  updatedAt: string;
};

export type NodeRun = {
  id: string;
  workflowRunId: string;
  nodeId: string;
  dependsOn: string[];
  attempt?: number;
  attempts?: NodeRunAttempt[];
  exitReview?: ExitReviewResult | null;
  retryCount?: number;
  status: NodeStatus;
  sortOrder: number;
  output: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowRunWithNodes = {
  workflowRun: WorkflowRun;
  nodeRuns: NodeRun[];
};

export type StartedWorkflowRunWithTask = WorkflowRunWithNodes & {
  task: Task;
};

export type RetriedWorkflowRunWithTask = WorkflowRunWithNodes & {
  task: Task;
};

export type RealtimeEvent =
  | {
      task: Task;
      type: "task.created" | "task.updated";
    }
  | {
      type: "tasks.deleted";
      requirementId: string;
    }
  | {
      type: "workflowRun.created" | "workflowRun.updated";
      workflowRun: WorkflowRun;
    }
  | {
      nodeRun: NodeRun;
      type: "nodeRun.created" | "nodeRun.updated";
      workflowRun: WorkflowRun | null;
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
  defaultExecutorType: ExecutorType;
  defaultExecutorAgentBindingId: string | null;
  modelProvider: ModelProviderKind;
  modelBaseUrl: string;
  modelName: string;
  modelConfigured: boolean;
  agentProxyUrl: string;
  agentProxyConfigured: boolean;
  updatedAt: string;
};

export type UpdateExecutionSettingsRequest = Partial<{
  defaultExecutorType: ExecutorType;
  defaultExecutorAgentBindingId: string | null;
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
  body: string;
  title: string;
};

export type UpdateWorkflowFileRequest = {
  name: string;
};

export type UpdateDecompositionResultRequest = {
  summary: string;
  tasks: Array<{
    id?: string;
    title: string;
    body: string;
    dependsOn?: string[];
    executorType?: ExecutorType;
    executorAgentBindingId?: string | null;
    executorLabel?: string;
  }>;
};

export type CreateDecompositionResultRequest = {
  executorAgentBindingId?: string | null;
  executorType?: ExecutorType;
};

export type NodeExecutorAssignmentRequest = {
  executorAgentBindingId?: string | null;
  executorType: ExecutorType;
  nodeId: string;
};

export type StartTaskWorkflowRunRequest = {
  correctionFeedback?: string;
  nodeExecutorAssignments?: NodeExecutorAssignmentRequest[];
  workflowFileId: string;
};

export type CreateRequirementResponse = {
  decompositionResult: DecompositionResult | null;
  requirement: Requirement;
};

export type CreateDecompositionResultResponse = {
  decompositionResult: DecompositionResult | null;
  error?: string;
  estimatedSeconds?: number;
  executor?: {
    executorAgentBindingId: string | null;
    executorLabel: string;
    executorType: ExecutorType;
  };
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

export type ResetRequirementResponse = {
  requirement: Requirement;
};
export type AcceptRequirementResponse = {
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

export type UploadSkillResponse = {
  skill: Skill;
};

export type UpdateSkillFromSourceResponse = {
  skill: Skill;
};

function apiUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}/api${path}`;
}

export function createRealtimeEventSource(baseUrl = "") {
  return new EventSource(apiUrl(baseUrl, "/events"));
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

export async function listSkills(
  projectId = "",
  baseUrl = ""
): Promise<Skill[]> {
  const query = projectId.trim()
    ? `?projectId=${encodeURIComponent(projectId.trim())}`
    : "";
  const response = await fetch(apiUrl(baseUrl, `/skills${query}`));

  if (!response.ok) {
    throw new Error(`Skill list failed with status ${response.status}`);
  }

  const body = (await response.json()) as { skills: Skill[] };

  return body.skills;
}

export async function uploadSkill(
  input: UploadSkillRequest,
  baseUrl = ""
): Promise<Skill> {
  const response = await fetch(apiUrl(baseUrl, "/skills"), {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Skill upload failed");
  }

  const body = (await response.json()) as UploadSkillResponse;

  return body.skill;
}

export async function updateSkillFromSource(
  id: string,
  baseUrl = ""
): Promise<Skill> {
  const response = await fetch(
    apiUrl(baseUrl, `/skills/${id}/update-from-source`),
    {
      method: "POST"
    }
  );

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Skill source update failed");
  }

  const body = (await response.json()) as UpdateSkillFromSourceResponse;

  return body.skill;
}

export async function deleteSkill(
  id: string,
  baseUrl = ""
): Promise<void> {
  const response = await fetch(apiUrl(baseUrl, `/skills/${id}`), {
    method: "DELETE"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Skill deletion failed");
  }
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
  baseUrl?: string
): Promise<CreateDecompositionResultResponse>;
export async function createRequirementDecompositionResult(
  id: string,
  input?: CreateDecompositionResultRequest,
  baseUrl?: string
): Promise<CreateDecompositionResultResponse>;
export async function createRequirementDecompositionResult(
  id: string,
  inputOrBaseUrl: CreateDecompositionResultRequest | string = {},
  baseUrl = ""
): Promise<CreateDecompositionResultResponse> {
  const input =
    typeof inputOrBaseUrl === "string" ? {} : inputOrBaseUrl;
  const resolvedBaseUrl =
    typeof inputOrBaseUrl === "string" ? inputOrBaseUrl : baseUrl;
  const response = await fetch(
    apiUrl(resolvedBaseUrl, `/requirements/${id}/decomposition-result`),
    {
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
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

export async function resetRequirement(
  id: string,
  baseUrl = ""
): Promise<ResetRequirementResponse> {
  const response = await fetch(apiUrl(baseUrl, `/requirements/${id}/reset`), {
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Requirement reset failed");
  }

  return response.json() as Promise<ResetRequirementResponse>;
}

export async function acceptRequirement(
  id: string,
  baseUrl = ""
): Promise<AcceptRequirementResponse> {
  const response = await fetch(apiUrl(baseUrl, `/requirements/${id}/acceptance`), {
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(body?.error ?? "Requirement acceptance failed");
  }

  return response.json() as Promise<AcceptRequirementResponse>;
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

export async function acceptTask(taskId: string, baseUrl = ""): Promise<Task> {
  const response = await fetch(apiUrl(baseUrl, `/tasks/${taskId}/acceptance`), {
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(body?.error ?? "Task acceptance failed");
  }

  const body = (await response.json()) as { task: Task };

  return body.task;
}

export async function startTaskWorkflowRun(
  taskId: string,
  workflowFileId: string,
  request: Omit<StartTaskWorkflowRunRequest, "workflowFileId"> = {},
  baseUrl = ""
): Promise<StartedWorkflowRunWithTask> {
  const response = await fetch(apiUrl(baseUrl, `/tasks/${taskId}/workflow-runs`), {
    body: JSON.stringify({ ...request, workflowFileId }),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };

    throw new Error(body.error ?? "Workflow run start failed");
  }

  return response.json() as Promise<StartedWorkflowRunWithTask>;
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

export async function retryTaskWorkflowNodeRun(
  taskId: string,
  workflowRunId: string,
  nodeRunId: string,
  baseUrl = ""
): Promise<RetriedWorkflowRunWithTask> {
  const response = await fetch(
    apiUrl(
      baseUrl,
      `/tasks/${taskId}/workflow-runs/${workflowRunId}/node-runs/${nodeRunId}/retry`
    ),
    {
      method: "POST"
    }
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(body?.error ?? "Workflow Node retry failed");
  }

  return response.json() as Promise<RetriedWorkflowRunWithTask>;
}

export async function reviewTaskWorkflowNodeRun(
  taskId: string,
  workflowRunId: string,
  nodeRunId: string,
  input: {
    decision: "approve" | "request_changes";
    feedback?: string;
  },
  baseUrl = ""
): Promise<RetriedWorkflowRunWithTask> {
  const response = await fetch(
    apiUrl(
      baseUrl,
      `/tasks/${taskId}/workflow-runs/${workflowRunId}/node-runs/${nodeRunId}/review`
    ),
    {
      body: JSON.stringify(input),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    }
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(body?.error ?? "Workflow Node review failed");
  }

  return response.json() as Promise<RetriedWorkflowRunWithTask>;
}
