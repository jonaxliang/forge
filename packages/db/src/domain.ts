export const artifactStorageModes = ["local-only", "cloud"] as const;
export const dbStrategies = ["sqlite", "postgres", "mysql"] as const;
export const requirementStatuses = [
  "init",
  "decomposing",
  "decomposition_failed",
  "ready_to_generate_tasks",
  "tasks_generated",
  "completed"
] as const;
export const taskStatuses = [
  "init",
  "running",
  "failed",
  "pending_acceptance",
  "completed",
  "cancelled"
] as const;
export const workflowRunStatuses = ["running", "succeeded", "failed"] as const;
export const agentConnectorTypes = ["cli", "mcp"] as const;
export const agentBindingStatuses = ["online", "offline", "error"] as const;
export const bridgeJobStatuses = [
  "queued",
  "claimed",
  "succeeded",
  "failed"
] as const;
export const executorTypes = ["model-api", "agent-binding"] as const;
export const modelProviderKinds = [
  "openai-compatible",
  "openai",
  "anthropic",
  "google",
  "mistral",
  "groq",
  "deepseek",
  "openrouter",
  "ollama",
  "lmstudio"
] as const;
export const nodeRunStatuses = [
  "idle",
  "queued",
  "running",
  "waiting",
  "blocked",
  "reviewing",
  "failed",
  "succeeded",
  "skipped"
] as const;

export type ArtifactStorageMode = (typeof artifactStorageModes)[number];
export type DbStrategy = (typeof dbStrategies)[number];
export type RequirementStatus = (typeof requirementStatuses)[number];
export type TaskStatus = (typeof taskStatuses)[number];
export type WorkflowRunStatus = (typeof workflowRunStatuses)[number];
export type NodeRunStatus = (typeof nodeRunStatuses)[number];
export type AgentConnectorType = (typeof agentConnectorTypes)[number];
export type AgentBindingStatus = (typeof agentBindingStatuses)[number];
export type BridgeJobStatus = (typeof bridgeJobStatuses)[number];
export type ExecutorType = (typeof executorTypes)[number];
export type ModelProviderKind = (typeof modelProviderKinds)[number];
