import type { ExitReviewResult, NodeRunAttempt } from "@forge/core";
import type {
  AgentBindingStatus,
  AgentConnectorType,
  ArtifactStorageMode,
  BridgeJobStatus,
  DbStrategy,
  ExecutorType,
  ModelProviderKind,
  NodeRunStatus,
  RequirementStatus,
  TaskStatus,
  WorkflowRunStatus
} from "./domain.js";

export type DatabaseStatus = {
  configured: boolean;
  dialect: DbStrategy | "unconfigured";
};

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

export type CreateProjectInput = {
  name: string;
  artifactStorageMode?: ArtifactStorageMode;
  dbStrategy?: DbStrategy;
  defaultExecutorType?: ExecutorType;
  defaultExecutorAgentBindingId?: string | null;
};

export type UpdateProjectInput = {
  id: string;
  name?: string;
  defaultExecutorType?: ExecutorType;
  defaultExecutorAgentBindingId?: string | null;
};

export type ProjectRepository = {
  createProject(input: CreateProjectInput): Promise<Project>;
  listProjects(): Promise<Project[]>;
  updateProject(input: UpdateProjectInput): Promise<Project>;
};

export type WorkflowFileMetadata = {
  id: string;
  name: string;
  nodeCount: number;
  definition: string;
  templateType: "builtin" | "custom";
  createdAt: string;
};

export type CreateWorkflowFileMetadataInput = {
  name: string;
  nodeCount: number;
  definition?: string;
  templateType?: "builtin" | "custom";
};

export type UpdateWorkflowFileMetadataInput = {
  definition?: string;
  id: string;
  name: string;
  nodeCount?: number;
};

export type WorkflowFileRepository = {
  createWorkflowFileMetadata(
    input: CreateWorkflowFileMetadataInput
  ): Promise<WorkflowFileMetadata>;
  deleteWorkflowFileMetadata(id: string): Promise<void>;
  getWorkflowFileMetadata(id: string): Promise<WorkflowFileMetadata | null>;
  listWorkflowFileMetadata(): Promise<WorkflowFileMetadata[]>;
  updateWorkflowFileMetadata(
    input: UpdateWorkflowFileMetadataInput
  ): Promise<WorkflowFileMetadata>;
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

export type CreateSkillInput = {
  projectId?: string | null;
  name: string;
  ref: string;
  description?: string;
  body: string;
  files?: Array<{
    path: string;
    content: string;
  }>;
  sourceUrl?: string | null;
  storagePath?: string;
};

export type UpdateSkillInput = {
  body: string;
  description?: string;
  files?: Array<{
    path: string;
    content: string;
  }>;
  name?: string;
  ref?: string;
  sourceUrl?: string | null;
  storagePath?: string;
};

export type SkillRepository = {
  createSkill(input: CreateSkillInput): Promise<Skill>;
  deleteSkill(id: string): Promise<void>;
  listSkills(projectId?: string | null): Promise<Skill[]>;
  updateSkill(id: string, input: UpdateSkillInput): Promise<Skill>;
};

export type ExecutionSettings = {
  id: "default";
  defaultExecutorType: ExecutorType;
  defaultExecutorAgentBindingId: string | null;
  modelProvider: ModelProviderKind;
  modelBaseUrl: string;
  modelName: string;
  modelApiKey: string;
  agentProxyUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type UpdateExecutionSettingsInput = Partial<
  Pick<
    ExecutionSettings,
    | "agentProxyUrl"
    | "defaultExecutorAgentBindingId"
    | "defaultExecutorType"
    | "modelApiKey"
    | "modelBaseUrl"
    | "modelName"
    | "modelProvider"
  >
>;

export type ExecutionSettingsRepository = {
  getExecutionSettings(): Promise<ExecutionSettings>;
  updateExecutionSettings(
    input: UpdateExecutionSettingsInput
  ): Promise<ExecutionSettings>;
};

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

export type CreateRequirementInput = {
  projectId?: string | null;
  title: string;
  body: string;
  workflowFileId: string;
};

export type UpdateRequirementStatusInput = {
  id: string;
  status: RequirementStatus;
  errorMessage?: string | null;
};

export type UpdateRequirementInput = {
  body: string;
  id: string;
  title: string;
};

export type RequirementRepository = {
  createRequirement(input: CreateRequirementInput): Promise<Requirement>;
  deleteRequirement(id: string): Promise<void>;
  listRequirements(): Promise<Requirement[]>;
  updateRequirement(input: UpdateRequirementInput): Promise<Requirement>;
  updateRequirementStatus(
    input: UpdateRequirementStatusInput
  ): Promise<Requirement>;
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

export type DecompositionResultItemInput = Omit<
  DecompositionResultItem,
  "dependsOn" | "id"
> &
  Partial<Pick<DecompositionResultItem, "dependsOn" | "id">>;

export type DecompositionResult = {
  id: string;
  projectId: string | null;
  requirementId: string;
  summary: string;
  items: DecompositionResultItem[];
  createdAt: string;
  updatedAt: string;
};

export type SaveDecompositionResultInput = {
  projectId?: string | null;
  requirementId: string;
  summary: string;
  items: DecompositionResultItemInput[];
};

export type UpdateDecompositionResultInput = {
  id: string;
  summary: string;
  items: DecompositionResultItemInput[];
};

export type DecompositionResultRepository = {
  deleteDecompositionResultForRequirement(requirementId: string): Promise<void>;
  getDecompositionResult(id: string): Promise<DecompositionResult | null>;
  getDecompositionResultForRequirement(
    requirementId: string
  ): Promise<DecompositionResult | null>;
  saveDecompositionResult(
    input: SaveDecompositionResultInput
  ): Promise<DecompositionResult>;
  updateDecompositionResult(
    input: UpdateDecompositionResultInput
  ): Promise<DecompositionResult>;
};

export type CreateTasksFromDecompositionResultInput = Pick<
  DecompositionResult,
  "projectId" | "requirementId"
> & {
  items: DecompositionResultItemInput[];
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

export type TaskRepository = {
  createTasksFromDecompositionResult(
    input: CreateTasksFromDecompositionResultInput
  ): Promise<Task[]>;
  deleteTasksForRequirement(requirementId: string): Promise<void>;
  getTask(id: string): Promise<Task | null>;
  listTasks(): Promise<Task[]>;
  updateTaskStatus(input: { id: string; status: TaskStatus }): Promise<Task>;
};

export type WorkflowRun = {
  id: string;
  taskId: string;
  workflowFileId: string;
  executorAssignments: Record<string, unknown>;
  correctionFeedback: string | null;
  status: WorkflowRunStatus;
  createdAt: string;
  updatedAt: string;
};

export type NodeRun = {
  id: string;
  workflowRunId: string;
  nodeId: string;
  dependsOn: string[];
  attempt: number;
  attempts: NodeRunAttempt[];
  exitReview: ExitReviewResult | null;
  retryCount: number;
  status: NodeRunStatus;
  sortOrder: number;
  output: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateWorkflowRunInput = {
  correctionFeedback?: string | null;
  executorAssignments?: Record<string, unknown>;
  taskId: string;
  workflowFileId: string;
};

export type CreateNodeRunInput = {
  workflowRunId: string;
  nodeId: string;
  dependsOn: string[];
  status: NodeRunStatus;
  sortOrder: number;
};

export type UpdateWorkflowRunStatusInput = {
  id: string;
  status: WorkflowRunStatus;
};

export type UpdateNodeRunStatusInput = {
  attempt?: number;
  attempts?: NodeRunAttempt[];
  exitReview?: ExitReviewResult | null;
  id: string;
  retryCount?: number;
  status: NodeRunStatus;
  output?: string | null;
  errorMessage?: string | null;
};

export type WorkflowRunRepository = {
  createWorkflowRun(input: CreateWorkflowRunInput): Promise<WorkflowRun>;
  createNodeRun(input: CreateNodeRunInput): Promise<NodeRun>;
  listWorkflowRuns(taskId?: string): Promise<WorkflowRun[]>;
  listNodeRuns(workflowRunId: string): Promise<NodeRun[]>;
  updateWorkflowRunStatus(
    input: UpdateWorkflowRunStatusInput
  ): Promise<WorkflowRun>;
  updateNodeRunStatus(input: UpdateNodeRunStatusInput): Promise<NodeRun>;
};

export type AgentBinding = {
  id: string;
  name: string;
  connector: AgentConnectorType;
  command: string;
  capabilities: string[];
  status: AgentBindingStatus;
  lastSeenAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertAgentBindingInput = {
  name: string;
  connector: AgentConnectorType;
  command: string;
  capabilities?: string[];
  status?: AgentBindingStatus;
  errorMessage?: string | null;
};

export type BridgeJob = {
  id: string;
  workflowRunId: string;
  nodeRunId: string;
  agentName: string;
  bridgeId: string | null;
  status: BridgeJobStatus;
  payload: unknown;
  output: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateBridgeJobInput = {
  workflowRunId: string;
  nodeRunId: string;
  agentName: string;
  payload: unknown;
};

export type CompleteBridgeJobInput = {
  bridgeId: string;
  id: string;
  status: Extract<BridgeJobStatus, "succeeded" | "failed">;
  output?: string | null;
  errorMessage?: string | null;
};

export type BridgeRepository = {
  claimNextBridgeJob(
    bridgeId: string,
    eligibleNodeRunIds?: string[],
    eligibleAgentNames?: string[]
  ): Promise<BridgeJob | null>;
  completeBridgeJob(input: CompleteBridgeJobInput): Promise<BridgeJob>;
  createBridgeJob(input: CreateBridgeJobInput): Promise<BridgeJob>;
  listAgentBindings(): Promise<AgentBinding[]>;
  hasOnlineAgentBindings(): Promise<boolean>;
  upsertAgentBinding(input: UpsertAgentBindingInput): Promise<AgentBinding>;
};
