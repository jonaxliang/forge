import {
  createProject,
  createRequirement,
  createRequirementDecompositionResult,
  deleteSkill,
  deleteRequirement,
  generateTasksFromDecompositionResult,
  getExecutionSettings,
  importWorkflowFile,
  listAgentBindings,
  listDecompositionResults,
  listRequirements,
  listProjects,
  listSkills,
  listTaskWorkflowRuns,
  listTasks,
  listWorkflowFiles,
  retryTaskWorkflowNodeRun,
  resetRequirement,
  startTaskWorkflowRun,
  testModelApi,
  uploadSkill,
  updateSkillFromSource,
  updateExecutionSettings,
  updateDecompositionResult,
  updateWorkflowFile,
  updateProject,
  updateRequirement,
  type AgentBinding,
  type ArtifactStorageMode,
  type DecompositionResult,
  type DbStrategy,
  type ExecutionSettings,
  type ExecutorType,
  type ModelProviderKind,
  type Project,
  type Requirement,
  type RealtimeEvent,
  type Skill,
  type Task,
  type WorkflowRunWithNodes,
  type WorkflowFileMetadata,
  type WorkflowFile,
  type WorkflowNodeOutput,
} from "@forge/sdk";
import { readLegacyWorkflowScope } from "@forge/core";
import { StatusBadge } from "@forge/ui";
import {
  AnimatePresence,
  motion,
  useReducedMotion
} from "motion/react";
import {
  type AriaRole,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  type MouseEventHandler,
  type ReactNode,
  useEffect,
  useState
} from "react";
import {
  getMessages,
  readStoredLocale,
  saveStoredLocale,
  supportedLocales,
  type Locale
} from "./i18n";
import { defaultWorkflowTemplates } from "./default-workflow-templates";
import {
  getModelSettingsForProviderChange,
  modelProviderOptions
} from "./model-settings";
import { shouldShowModelConfigurationStatus } from "./status";
import "./styles.css";

type StatusTone = "neutral" | "success" | "info" | "warning" | "danger";
type MascotVariant =
  | "info"
  | "success"
  | "warning"
  | "blocked"
  | "thinking"
  | "guide";
type ActivePage =
  | "control-room"
  | "requirements"
  | "settings"
  | "workflow-templates";
type ActiveWorkbenchAction = "project" | "requirement" | null;
type DecompositionDialogState = {
  estimatedSeconds: number;
  executorLabel: string;
  mode: "select" | "running";
  requirementId: string;
} | null;
type ClarificationPrompt = {
  questions: string[];
  summary: string;
};
type PendingRequirementAction = {
  kind: "delete" | "reset";
  requirementId: string;
} | null;
type WorkflowRunExecutorDialogState = {
  assignments: Record<string, string>;
  taskId: string;
  workflowFileId: string;
} | null;
type WorkflowRunDetailDialogState = {
  taskId: string;
  workflowRunId: string;
} | null;
type WorkflowTemplateDialog = "new" | "import" | null;
type WorkflowImportMode = "source" | "file";
type TemplateBuilderNode = {
  id: string;
  maxRetries: number;
  output: string;
  skillRef: string;
  type: string;
};
type EditableDecompositionItem = {
  id: string;
  title: string;
  body: string;
  dependsOn: string[];
  executorType: ExecutorType;
  executorAgentBindingId: string | null;
  executorLabel: string;
};
type SkillUploadArchive = {
  contentBase64: string;
  name: string;
  size: number;
};
type SkillUploadMode = "url" | "zip";
type SettingsSection = "basic" | "model" | "skills";
type ModelSettingsSection = "model" | "local-bridge";
type Messages = ReturnType<typeof getMessages>;
type InitialProject = Omit<
  Project,
  "defaultExecutorAgentBindingId" | "defaultExecutorType"
> &
  Partial<Pick<Project, "defaultExecutorAgentBindingId" | "defaultExecutorType">>;
type AppProps = {
  initialAgentBindings?: AgentBinding[];
  initialExecutionSettings?: ExecutionSettings | null;
  initialDecompositionResults?: DecompositionResult[];
  initialCliDownloadHelpOpen?: boolean;
  initialModelSettingsSection?: ModelSettingsSection;
  initialPage?: ActivePage;
  initialProjects?: InitialProject[];
  initialRequirements?: Requirement[];
  initialSelectedSkillId?: string;
  initialSkillContentDialogOpen?: boolean;
  initialSkillUploadDialogOpen?: boolean;
  initialSkillUploadMode?: SkillUploadMode;
  initialSettingsSection?: SettingsSection;
  initialSkills?: Skill[];
  initialTasks?: Task[];
  initialWorkbenchAction?: ActiveWorkbenchAction;
  initialClarificationRequirementId?: string;
  initialEditingRequirementId?: string;
  initialWorkflowTemplateDialog?: WorkflowTemplateDialog;
  initialEditingWorkflowId?: string;
  initialPreviewWorkflowId?: string;
  initialWorkflowRunDetailDialog?: WorkflowRunDetailDialogState;
  initialWorkflowRunsByTaskId?: Record<string, WorkflowRunWithNodes[]>;
  initialWorkflowFiles?: WorkflowFileMetadata[];
};
type MotionModalBackdropProps = {
  "aria-labelledby"?: string;
  children?: ReactNode;
  className?: string;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  role?: AriaRole;
};
type MotionModalPanelProps = {
  "aria-labelledby"?: string;
  "aria-modal"?: boolean | "false" | "true";
  children?: ReactNode;
  className?: string;
  role?: AriaRole;
};

function normalizeProject(project: InitialProject): Project {
  return {
    ...project,
    defaultExecutorAgentBindingId: project.defaultExecutorAgentBindingId ?? null,
    defaultExecutorType: project.defaultExecutorType ?? "model-api"
  };
}
type StatusMessage =
  | { kind: "status"; key: keyof Messages["status"] }
  | { kind: "named"; key: keyof Messages["namedStatus"]; name: string }
  | { kind: "count"; key: keyof Messages["countStatus"]; count: number }
  | { kind: "error"; message: string };
type ProjectSelectionStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

const idleStatusKeys = new Set<keyof Messages["status"]>([
  "projectIdle",
  "workflowIdle",
  "requirementIdle",
  "settingsIdle",
  "taskBoardIdle"
]);
const selectedProjectStorageKey = "forge:selected-project-id";
const taskWorkflowSelectionStorageKey = "forge:task-workflow-selections";
const configuredModelApiKeyMask = "••••••••••••";
const pagePathByPage: Record<ActivePage, string> = {
  "control-room": "/main",
  requirements: "/requirements",
  settings: "/settings",
  "workflow-templates": "/workflow-templates"
};

export function resolvePageFromPath(pathname: string): ActivePage {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";

  if (normalizedPath === pagePathByPage.settings) {
    return "settings";
  }
  if (normalizedPath === pagePathByPage.requirements) {
    return "requirements";
  }
  if (normalizedPath === pagePathByPage["workflow-templates"]) {
    return "workflow-templates";
  }
  return "control-room";
}

export function getPathForPage(page: ActivePage) {
  return pagePathByPage[page];
}

function getForgeCliDownloadUrl() {
  if (typeof window === "undefined" || !window.location?.origin) {
    return "/release/forgecli";
  }

  return new URL("/release/forgecli", window.location.origin).href;
}

function readActivePageFromLocation(): ActivePage {
  return typeof window === "undefined"
    ? "control-room"
    : resolvePageFromPath(window.location?.pathname ?? "/");
}

function getBrowserStorage(): Storage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

export function readStoredProjectId(storage?: ProjectSelectionStorage) {
  try {
    return storage?.getItem(selectedProjectStorageKey)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function saveStoredProjectId(
  storage: ProjectSelectionStorage | undefined,
  projectId: string
) {
  try {
    const normalizedProjectId = projectId.trim();

    if (normalizedProjectId) {
      storage?.setItem(selectedProjectStorageKey, normalizedProjectId);
    } else {
      storage?.removeItem(selectedProjectStorageKey);
    }
  } catch {
    // Ignore storage failures so project switching still works in restricted browsers.
  }
}

export function readStoredTaskWorkflowSelections(
  storage?: ProjectSelectionStorage
) {
  try {
    const parsed = JSON.parse(
      storage?.getItem(taskWorkflowSelectionStorageKey) ?? "{}"
    ) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([taskId, workflowFileId]) => [
          taskId.trim(),
          typeof workflowFileId === "string" ? workflowFileId.trim() : ""
        ])
        .filter(([taskId, workflowFileId]) => taskId && workflowFileId)
    );
  } catch {
    return {};
  }
}

export function saveStoredTaskWorkflowSelection(
  storage: ProjectSelectionStorage | undefined,
  taskId: string,
  workflowFileId: string
) {
  try {
    const normalizedTaskId = taskId.trim();
    const normalizedWorkflowFileId = workflowFileId.trim();
    const selections = readStoredTaskWorkflowSelections(storage);

    if (normalizedTaskId && normalizedWorkflowFileId) {
      selections[normalizedTaskId] = normalizedWorkflowFileId;
    } else if (normalizedTaskId) {
      delete selections[normalizedTaskId];
    }

    if (Object.keys(selections).length > 0) {
      storage?.setItem(taskWorkflowSelectionStorageKey, JSON.stringify(selections));
    } else {
      storage?.removeItem(taskWorkflowSelectionStorageKey);
    }
  } catch {
    // Ignore storage failures so Task Workflow selection still works in-session.
  }
}

function resolveTaskWorkflowSelection(
  taskId: string,
  selections: Record<string, string>,
  taskWorkflowFiles: WorkflowFileMetadata[]
) {
  const selectedWorkflowFileId = selections[taskId];

  return taskWorkflowFiles.some(
    (workflowFile) => workflowFile.id === selectedWorkflowFileId
  )
    ? selectedWorkflowFileId
    : taskWorkflowFiles[0]?.id ?? "";
}

function getStatusMessage(t: Messages, status: StatusMessage) {
  if (status.kind === "named") {
    return t.namedStatus[status.key](status.name);
  }
  if (status.kind === "count") {
    return t.countStatus[status.key](status.count);
  }
  if (status.kind === "error") {
    return status.message;
  }
  return t.status[status.key];
}

function isIdleStatus(status: StatusMessage) {
  return status.kind === "status" && idleStatusKeys.has(status.key);
}

function getNodeRunTone(status: string): StatusTone {
  if (["succeeded", "done"].includes(status)) {
    return "success";
  }
  if (["running", "queued"].includes(status)) {
    return "info";
  }
  if (["waiting", "reviewing"].includes(status)) {
    return "warning";
  }
  if (["blocked", "failed"].includes(status)) {
    return "danger";
  }
  return "neutral";
}

function getTaskStatusTone(status: Task["status"]): StatusTone {
  if (status === "completed") {
    return "success";
  }
  if (status === "running" || status === "pending_acceptance") {
    return "info";
  }
  if (status === "failed" || status === "cancelled") {
    return "danger";
  }
  return "neutral";
}

function getAgentBindingStatusTone(status: AgentBinding["status"]): StatusTone {
  if (status === "online") {
    return "success";
  }

  if (status === "error") {
    return "danger";
  }

  return "warning";
}

function getRequirementStatusLabel(t: Messages, status: string) {
  const labels = t.workspace.requirementStatus as Record<string, string>;

  return labels[status] ?? status.replace(/_/g, " ");
}

function formatManagementTimestamp(value: string) {
  if (!value) {
    return "-";
  }

  return value.slice(0, 16).replace("T", " ");
}

function canPlanRequirementStatus(status: string) {
  return ["draft", "init", "open", "decomposition_failed"].includes(status);
}

function getRequirementClarificationPrompt(
  requirement: Requirement
): ClarificationPrompt | null {
  if (
    requirement.status !== "decomposition_failed" ||
    !requirement.errorMessage
  ) {
    return null;
  }

  const lines = requirement.errorMessage
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const questions = lines
    .filter((line) => line.startsWith("-"))
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);

  if (questions.length === 0) {
    return null;
  }

  return {
    questions,
    summary: lines.find((line) => !line.startsWith("-")) ?? ""
  };
}

function createEditableDecompositionItems(
  decompositionResult: DecompositionResult
): EditableDecompositionItem[] {
  return decompositionResult.items.map((item) => ({
    id: item.id,
    body: item.body,
    dependsOn: item.dependsOn,
    executorAgentBindingId: item.executorAgentBindingId,
    executorLabel: item.executorLabel,
    executorType: item.executorType,
    title: item.title
  }));
}

function getTaskDependencyLabels(task: Task, tasks: Task[]) {
  return task.dependsOn.map(
    (dependencyId) =>
      tasks.find((candidate) => candidate.id === dependencyId)?.title ??
      dependencyId
  );
}

function areTaskDependenciesSatisfied(
  task: Task,
  workflowRunsByTaskId: Record<string, WorkflowRunWithNodes[]>
) {
  return task.dependsOn.every((dependencyId) =>
    (workflowRunsByTaskId[dependencyId] ?? []).some(
      (run) => run.workflowRun.status === "succeeded"
    )
  );
}

export function getTaskRunOrder(
  tasks: Array<Pick<Task, "dependsOn" | "id">>
) {
  const pendingTasks = new Map(tasks.map((task) => [task.id, task]));
  const orderedTaskIds: string[] = [];

  while (pendingTasks.size > 0) {
    const nextTask = tasks.find(
      (task) =>
        pendingTasks.has(task.id) &&
        task.dependsOn.every((dependencyId) => !pendingTasks.has(dependencyId))
    );

    if (!nextTask) {
      orderedTaskIds.push(...pendingTasks.keys());
      break;
    }

    orderedTaskIds.push(nextTask.id);
    pendingTasks.delete(nextTask.id);
  }

  return orderedTaskIds;
}

export function getVisibleTaskBoardTasks<T extends Pick<Task, "requirementId">>(
  tasks: T[],
  requirementId: string
) {
  return requirementId
    ? tasks.filter((task) => task.requirementId === requirementId)
    : tasks;
}

export function applyRealtimeTaskEvent(tasks: Task[], event: RealtimeEvent) {
  if (event.type === "tasks.deleted") {
    return tasks.filter((task) => task.requirementId !== event.requirementId);
  }

  if (event.type !== "task.created" && event.type !== "task.updated") {
    return tasks;
  }

  const existingTaskIndex = tasks.findIndex((task) => task.id === event.task.id);

  if (existingTaskIndex === -1) {
    return [...tasks, event.task];
  }

  return tasks.map((task, index) =>
    index === existingTaskIndex ? event.task : task
  );
}

export function applyRealtimeWorkflowRunEvent(
  workflowRunsByTaskId: Record<string, WorkflowRunWithNodes[]>,
  event: RealtimeEvent
) {
  if (event.type === "workflowRun.created" || event.type === "workflowRun.updated") {
    const taskRuns = workflowRunsByTaskId[event.workflowRun.taskId] ?? [];
    const existingRunIndex = taskRuns.findIndex(
      (run) => run.workflowRun.id === event.workflowRun.id
    );
    const nextTaskRuns =
      existingRunIndex === -1
        ? [...taskRuns, { nodeRuns: [], workflowRun: event.workflowRun }]
        : taskRuns.map((run, index) =>
            index === existingRunIndex
              ? { ...run, workflowRun: event.workflowRun }
              : run
          );

    return {
      ...workflowRunsByTaskId,
      [event.workflowRun.taskId]: nextTaskRuns
    };
  }

  if (event.type !== "nodeRun.created" && event.type !== "nodeRun.updated") {
    return workflowRunsByTaskId;
  }

  if (!event.workflowRun) {
    return workflowRunsByTaskId;
  }

  const taskRuns = workflowRunsByTaskId[event.workflowRun.taskId] ?? [];
  const existingRunIndex = taskRuns.findIndex(
    (run) => run.workflowRun.id === event.workflowRun?.id
  );
  const mergeNodeRuns = (nodeRuns: WorkflowRunWithNodes["nodeRuns"]) => {
    const existingNodeRunIndex = nodeRuns.findIndex(
      (nodeRun) => nodeRun.id === event.nodeRun.id
    );

    return existingNodeRunIndex === -1
      ? [...nodeRuns, event.nodeRun]
      : nodeRuns.map((nodeRun, index) =>
          index === existingNodeRunIndex ? event.nodeRun : nodeRun
        );
  };
  const nextTaskRuns =
    existingRunIndex === -1
      ? [{ nodeRuns: [event.nodeRun], workflowRun: event.workflowRun }]
      : taskRuns.map((run, index) =>
          index === existingRunIndex
            ? {
                nodeRuns: mergeNodeRuns(run.nodeRuns),
                workflowRun: event.workflowRun!
              }
            : run
        );

  return {
    ...workflowRunsByTaskId,
    [event.workflowRun.taskId]: nextTaskRuns
  };
}

function hasSucceededWorkflowRun(
  taskId: string,
  workflowRunsByTaskId: Record<string, WorkflowRunWithNodes[]>
) {
  return (workflowRunsByTaskId[taskId] ?? []).some(
    (run) => run.workflowRun.status === "succeeded"
  );
}

function shouldRunTaskInRunAll(task: Task) {
  return !["completed", "pending_acceptance", "running"].includes(task.status);
}

function waitFor(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createRealtimeEventSource(baseUrl = "") {
  return new EventSource(`${baseUrl.replace(/\/$/, "")}/api/events`);
}

function getOrderedNodeRuns(run: WorkflowRunWithNodes) {
  return [...run.nodeRuns].sort((left, right) => left.sortOrder - right.sortOrder);
}

function getWorkflowRunFocusNodeRun(run: WorkflowRunWithNodes) {
  const orderedNodeRuns = getOrderedNodeRuns(run);

  return (
    orderedNodeRuns.find((nodeRun) => nodeRun.status === "running") ??
    orderedNodeRuns.find((nodeRun) => nodeRun.status === "failed") ??
    orderedNodeRuns.find((nodeRun) => nodeRun.status === "queued") ??
    orderedNodeRuns.at(-1) ??
    null
  );
}

function getWorkflowRunProgress(
  run: WorkflowRunWithNodes,
  workflow: WorkflowFile | null
) {
  const focusNodeRun = getWorkflowRunFocusNodeRun(run);
  const orderedNodeRuns = getOrderedNodeRuns(run);
  const workflowNodeCount = workflow?.nodes.length ?? 0;
  const total = Math.max(workflowNodeCount, orderedNodeRuns.length);

  if (!focusNodeRun || total === 0) {
    return { current: 0, focusNodeRun, total };
  }

  const workflowIndex =
    workflow?.nodes.findIndex((node) => node.id === focusNodeRun.nodeId) ?? -1;
  const nodeRunIndex = orderedNodeRuns.findIndex(
    (nodeRun) => nodeRun.id === focusNodeRun.id
  );
  const current = (workflowIndex >= 0 ? workflowIndex : nodeRunIndex) + 1;

  return { current, focusNodeRun, total };
}

function getWorkflowRunNoProcessDetailsMessage(
  nodeRun: WorkflowRunWithNodes["nodeRuns"][number],
  messages: Messages
) {
  if (nodeRun.status === "running") {
    return messages.workspace.workflowRunRunningNoProcessDetails;
  }

  if (nodeRun.status === "failed") {
    return messages.workspace.workflowRunFailedNoProcessDetails;
  }

  if (nodeRun.status === "succeeded") {
    return messages.workspace.workflowRunSucceededNoProcessDetails;
  }

  return messages.workspace.workflowRunNoProcessDetails;
}

function getExecutorOptionValue(
  executorType: ExecutorType,
  executorAgentBindingId: string | null
) {
  return executorType === "agent-binding" && executorAgentBindingId
    ? `agent-binding:${executorAgentBindingId}`
    : "model-api";
}

function readExecutorOptionValue(value: string): {
  executorAgentBindingId: string | null;
  executorType: ExecutorType;
} {
  if (value.startsWith("agent-binding:")) {
    return {
      executorAgentBindingId: value.replace("agent-binding:", ""),
      executorType: "agent-binding"
    };
  }

  return {
    executorAgentBindingId: null,
    executorType: "model-api"
  };
}

function getProjectDefaultExecutorValue(project: Project | null) {
  return getExecutorOptionValue(
    project?.defaultExecutorType ?? "model-api",
    project?.defaultExecutorAgentBindingId ?? null
  );
}

function createWorkflowRunExecutorAssignments(
  workflow: WorkflowFile,
  defaultExecutorValue: string
) {
  return Object.fromEntries(
    workflow.nodes.map((node) => [node.id, defaultExecutorValue])
  );
}

function canUseDomMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.addEventListener === "function" &&
    typeof document !== "undefined"
  );
}

function MotionShell({ children }: { children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion();

  if (!canUseDomMotion()) {
    return (
      <main className="studio-shell" data-motion-scope="app-shell">
        {children}
      </main>
    );
  }

  return (
    <motion.main
      animate={shouldReduceMotion ? false : { opacity: 1, y: 0 }}
      className="studio-shell"
      data-motion-scope="app-shell"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.main>
  );
}

function MotionModalBackdrop({
  children,
  ...props
}: MotionModalBackdropProps) {
  const shouldReduceMotion = useReducedMotion();
  const className = `modal-backdrop ${props.className ?? ""}`.trim();

  if (!canUseDomMotion()) {
    return (
      <div {...props} className={className} data-motion-scope="modal-backdrop">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      {...props}
      animate={shouldReduceMotion ? false : { opacity: 1 }}
      className={className}
      data-motion-scope="modal-backdrop"
      exit={shouldReduceMotion ? undefined : { opacity: 0 }}
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function MotionModalPanel({
  children,
  ...props
}: MotionModalPanelProps) {
  const shouldReduceMotion = useReducedMotion();

  if (!canUseDomMotion()) {
    return (
      <section {...props} data-motion-scope="modal-panel">
        {children}
      </section>
    );
  }

  return (
    <motion.section
      {...props}
      animate={shouldReduceMotion ? false : { opacity: 1, scale: 1, y: 0 }}
      data-motion-scope="modal-panel"
      exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98, y: 4 }}
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: 6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.section>
  );
}

function MotionModalDivPanel({
  children,
  ...props
}: MotionModalBackdropProps) {
  const shouldReduceMotion = useReducedMotion();

  if (!canUseDomMotion()) {
    return (
      <div {...props} data-motion-scope="modal-panel">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      {...props}
      animate={shouldReduceMotion ? false : { opacity: 1, scale: 1, y: 0 }}
      data-motion-scope="modal-panel"
      exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98, y: 4 }}
      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98, y: 6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function CatActionIcon({ className = "" }: { className?: string }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={`cat-action-icon ${className}`.trim()}
      height="24"
      src="/brand/mascot/forge-cat-mascot-guide.png"
      width="24"
    />
  );
}

function SettingsGearIcon() {
  return (
    <svg
      aria-hidden="true"
      className="settings-gear-icon"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function MascotCue({
  className = "",
  variant
}: {
  className?: string;
  variant: MascotVariant;
}) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={`mascot-cue mascot-cue-${variant} ${className}`.trim()}
      height="96"
      src={`/brand/mascot/forge-cat-mascot-${variant}.png`}
      width="96"
    />
  );
}

function getMascotVariantForStatus(status: StatusMessage): MascotVariant {
  if (status.kind === "error" || status.kind === "count") {
    return status.kind === "error" ? "blocked" : "success";
  }

  if (status.kind === "named") {
    if (status.key === "workflowRunStatus") {
      return getNodeRunTone(status.name) === "danger" ? "blocked" : "info";
    }

    return "success";
  }

  switch (status.key) {
    case "creatingProject":
    case "deletingRequirement":
    case "importingWorkflowFile":
    case "runningRequirementWorkflow":
    case "savingDecompositionResult":
    case "savingRequirement":
    case "savingWorkflow":
    case "savingAgentProxySettings":
    case "savingModelSettings":
    case "savingSettings":
    case "startingWorkflowRun":
    case "retryingWorkflowNode":
    case "testingModelApi":
      return "thinking";
    case "agentProxySettingsSaved":
    case "deletedRequirement":
    case "decompositionResultSaved":
    case "clarificationAnswerSaved":
    case "modelApiTestSucceeded":
    case "modelSettingsSaved":
    case "renamedRequirement":
    case "renamedWorkflow":
    case "ready":
    case "settingsSaved":
      return "success";
    case "importTaskWorkflowFirst":
    case "modelNotConfigured":
      return "warning";
    case "projectCreationFailed":
    case "projectListUnavailable":
    case "requirementCreationFailed":
    case "requirementDeletionFailed":
    case "requirementUpdateFailed":
    case "requirementResourcesUnavailable":
    case "resourcesUnavailable":
    case "modelApiTestFailed":
    case "settingsSaveFailed":
    case "workflowImportFailed":
    case "workflowUpdateFailed":
    case "workflowRunFailed":
      return "blocked";
    default:
      return "info";
  }
}

function StatusMascotMessage({
  className = "",
  status,
  t
}: {
  className?: string;
  status: StatusMessage;
  t: Messages;
}) {
  return (
    <p className={`mascot-status-message ${className}`.trim()} aria-live="polite">
      <MascotCue
        className="mascot-cue-status"
        variant={getMascotVariantForStatus(status)}
      />
      <span>{getStatusMessage(t, status)}</span>
    </p>
  );
}

function MascotEmptyState({
  body,
  children,
  title,
  variant
}: {
  body: string;
  children?: ReactNode;
  title: string;
  variant: MascotVariant;
}) {
  return (
    <div className="empty-state empty-state-with-mascot">
      <MascotCue className="mascot-cue-empty" variant={variant} />
      <div className="empty-state-copy">
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      {children}
    </div>
  );
}

function MascotLaneEmpty({
  children,
  quiet = false,
  variant = "guide"
}: {
  children: ReactNode;
  quiet?: boolean;
  variant?: MascotVariant;
}) {
  return (
    <div
      className={`lane-empty ${
        quiet ? "lane-empty-quiet" : "lane-empty-with-mascot"
      }`}
    >
      {quiet ? null : <MascotCue className="mascot-cue-lane" variant={variant} />}
      <span>{children}</span>
    </div>
  );
}

const defaultWorkflowSource = defaultWorkflowTemplates[0].source;
const defaultWorkflowTemplateNames = new Set(
  defaultWorkflowTemplates.map((template) => template.workflow.name.trim())
);

function getWorkflowOutputLabel(output: WorkflowNodeOutput | string) {
  if (typeof output === "string") {
    return output;
  }

  if ("artifact" in output) {
    return `artifact:${output.artifact}`;
  }

  return output.ref;
}

const getWorkflowNodeOutputLabel = getWorkflowOutputLabel;

function getWorkflowContractCountLabel(
  count: number,
  singular: string,
  plural: string
) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

function getWorkflowContractValues(values: string[], fallback: string) {
  return values.length > 0 ? values.join(", ") : fallback;
}

type WorkflowPreviewNode = WorkflowFile["nodes"][number];
type WorkflowDagCardKind = "start" | "node" | "end";
type WorkflowDagCard = {
  childCount: number;
  dependencyCount: number;
  id: string;
  isEntry: boolean;
  isTerminal: boolean;
  kind: WorkflowDagCardKind;
  node?: WorkflowPreviewNode;
  x: number;
  y: number;
};
type WorkflowDagEdge = {
  from: string;
  to: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};
type WorkflowDagLayout = {
  cards: WorkflowDagCard[];
  edges: WorkflowDagEdge[];
  height: number;
  width: number;
};

const workflowDagCardWidth = 246;
const workflowDagCardHeight = 260;
const workflowDagColumnGap = 48;
const workflowDagRowGap = 14;
const workflowDagPadding = 18;

function createWorkflowDagLayout(workflow: WorkflowFile): WorkflowDagLayout {
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const childrenByNodeId = new Map<string, string[]>(
    workflow.nodes.map((node) => [node.id, []])
  );

  for (const node of workflow.nodes) {
    for (const dependency of node.dependsOn ?? []) {
      childrenByNodeId.get(dependency)?.push(node.id);
    }
  }

  const levelByNodeId = new Map<string, number>();
  const resolving = new Set<string>();

  function getNodeLevel(node: WorkflowPreviewNode): number {
    const currentLevel = levelByNodeId.get(node.id);

    if (currentLevel !== undefined) {
      return currentLevel;
    }

    if (resolving.has(node.id)) {
      return 0;
    }

    resolving.add(node.id);

    const dependencyLevels = (node.dependsOn ?? [])
      .map((dependency) => nodesById.get(dependency))
      .filter((dependencyNode): dependencyNode is WorkflowPreviewNode =>
        Boolean(dependencyNode)
      )
      .map((dependencyNode) => getNodeLevel(dependencyNode) + 1);
    const nextLevel =
      dependencyLevels.length > 0 ? Math.max(...dependencyLevels) : 0;

    resolving.delete(node.id);
    levelByNodeId.set(node.id, nextLevel);

    return nextLevel;
  }

  for (const node of workflow.nodes) {
    getNodeLevel(node);
  }

  const maxWorkflowLevel = Math.max(...levelByNodeId.values(), 0);
  const workflowLayers = Array.from(
    { length: maxWorkflowLevel + 1 },
    () => [] as WorkflowPreviewNode[]
  );

  for (const node of workflow.nodes) {
    workflowLayers[getNodeLevel(node)]?.push(node);
  }

  const layoutLayers: Array<
    Array<{ id: string; kind: WorkflowDagCardKind; node?: WorkflowPreviewNode }>
  > = [
    [{ id: "__start", kind: "start" }],
    ...workflowLayers.map((layer) =>
      layer.map((node) => ({ id: node.id, kind: "node" as const, node }))
    ),
    [{ id: "__end", kind: "end" }]
  ];
  const maxRows = Math.max(...layoutLayers.map((layer) => layer.length), 1);
  const contentHeight =
    maxRows * workflowDagCardHeight + (maxRows - 1) * workflowDagRowGap;
  const height = workflowDagPadding * 2 + contentHeight;
  const width =
    workflowDagPadding * 2 +
    layoutLayers.length * workflowDagCardWidth +
    (layoutLayers.length - 1) * workflowDagColumnGap;
  const cards: WorkflowDagCard[] = [];

  layoutLayers.forEach((layer, columnIndex) => {
    const layerHeight =
      layer.length * workflowDagCardHeight +
      Math.max(layer.length - 1, 0) * workflowDagRowGap;
    const startY = workflowDagPadding + (contentHeight - layerHeight) / 2;

    layer.forEach((item, rowIndex) => {
      const dependencyCount =
        item.kind === "node" ? item.node?.dependsOn?.length ?? 0 : 0;
      const childCount =
        item.kind === "node"
          ? childrenByNodeId.get(item.id)?.length ?? 0
          : item.kind === "start"
            ? workflow.nodes.filter(
                (node) => (node.dependsOn ?? []).length === 0
              ).length
            : 0;

      cards.push({
        childCount,
        dependencyCount,
        id: item.id,
        isEntry: item.kind === "node" && dependencyCount === 0,
        isTerminal: item.kind === "node" && childCount === 0,
        kind: item.kind,
        node: item.node,
        x:
          workflowDagPadding +
          columnIndex * (workflowDagCardWidth + workflowDagColumnGap),
        y: startY + rowIndex * (workflowDagCardHeight + workflowDagRowGap)
      });
    });
  });

  const cardsById = new Map(cards.map((card) => [card.id, card]));
  const edges: WorkflowDagEdge[] = [];

  function addEdge(from: string, to: string) {
    const fromCard = cardsById.get(from);
    const toCard = cardsById.get(to);

    if (!fromCard || !toCard) {
      return;
    }

    edges.push({
      from,
      fromX: fromCard.x + workflowDagCardWidth,
      fromY: fromCard.y + workflowDagCardHeight / 2,
      to,
      toX: toCard.x,
      toY: toCard.y + workflowDagCardHeight / 2
    });
  }

  for (const node of workflow.nodes) {
    const dependencies = node.dependsOn ?? [];

    if (dependencies.length === 0) {
      addEdge("__start", node.id);
    } else {
      for (const dependency of dependencies) {
        addEdge(dependency, node.id);
      }
    }

    if ((childrenByNodeId.get(node.id)?.length ?? 0) === 0) {
      addEdge(node.id, "__end");
    }
  }

  return { cards, edges, height, width };
}

function parseWorkflowDefinition(definition: string): WorkflowFile | null {
  try {
    const parsed = JSON.parse(definition) as Partial<WorkflowFile>;

    if (
      typeof parsed.name !== "string" ||
      !Array.isArray(parsed.nodes)
    ) {
      return null;
    }

    return parsed as WorkflowFile;
  } catch {
    return null;
  }
}

function getWorkflowDefinitionScope(workflowFile: WorkflowFileMetadata) {
  const scope =
    getJsonWorkflowDefinitionScope(workflowFile.definition) ??
    readLegacyWorkflowScope(workflowFile.definition);

  return scope === "requirement" ? "requirement" : "task";
}

function getJsonWorkflowDefinitionScope(definition: string) {
  try {
    const parsed = JSON.parse(definition) as { scope?: unknown };

    return typeof parsed.scope === "string" ? parsed.scope : null;
  } catch {
    return null;
  }
}

function isTaskWorkflowTemplate(workflowFile: WorkflowFileMetadata) {
  return getWorkflowDefinitionScope(workflowFile) === "task";
}

function getVisibleWorkflowTemplates(workflowFiles: WorkflowFileMetadata[]) {
  return workflowFiles.filter(isTaskWorkflowTemplate);
}

function getWorkflowTemplateType(workflowFile: WorkflowFileMetadata) {
  return workflowFile.templateType === "builtin" ? "builtin" : "custom";
}

function getWorkflowTemplateDisplayName(
  t: Messages,
  workflowFile: WorkflowFileMetadata
) {
  const parsedWorkflow = parseWorkflowDefinition(workflowFile.definition);
  const displayName = workflowFile.name.trim() || parsedWorkflow?.name.trim();

  return displayName || t.templatePage.unnamedWorkflowTemplate;
}

function isDuplicateDefaultWorkflowTemplate(workflowFile: WorkflowFileMetadata) {
  if (getWorkflowTemplateType(workflowFile) !== "builtin") {
    return false;
  }

  const parsedWorkflow = parseWorkflowDefinition(workflowFile.definition);
  const displayName = workflowFile.name.trim() || parsedWorkflow?.name.trim() || "";

  return defaultWorkflowTemplateNames.has(displayName);
}

function quoteWorkflowValue(value: string) {
  return JSON.stringify(value.trim());
}

function createWorkflowSkillLocalId(ref: string, fallback: string) {
  const withoutPrefix = ref.startsWith("skill:") ? ref.slice("skill:".length) : ref;
  const normalized = withoutPrefix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

async function readFileAsBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("error", () => reject(reader.error));
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.readAsDataURL(file);
  });

  return dataUrl.split(",")[1] ?? "";
}

export function createWorkflowSourceFromBuilder(
  name: string,
  nodes: TemplateBuilderNode[],
  availableSkills: Skill[] = []
) {
  const safeName = name.trim() || "Untitled Workflow template";
  const safeNodes =
    nodes.length > 0
      ? nodes
      : [
          {
            id: "work",
            maxRetries: 1,
            output: "work.md",
            skillRef: "",
            type: "task-work"
          }
        ];
  const skillByRef = new Map(availableSkills.map((skill) => [skill.ref, skill]));
  const selectedSkillRefs = [
    ...new Set(safeNodes.map((node) => node.skillRef.trim()).filter(Boolean))
  ];
  const workflowSkillEntries = selectedSkillRefs.map((ref, index) => ({
    id: createWorkflowSkillLocalId(ref, `skill-${index + 1}`),
    ref: skillByRef.get(ref)?.ref ?? ref
  }));
  const workflowSkillLocalIdByRef = new Map(
    workflowSkillEntries.map((skill) => [skill.ref, skill.id])
  );
  const skillsBlock =
    workflowSkillEntries.length > 0
      ? `skills:
${workflowSkillEntries
  .map(
    (skill) => `  - id: ${quoteWorkflowValue(skill.id)}
    ref: ${quoteWorkflowValue(skill.ref)}`
  )
  .join("\n")}
`
      : "";

  return `name: ${quoteWorkflowValue(safeName)}
version: "1.1"
inputs:
  - id: task
    type: task
    required: true
${skillsBlock}nodes:
${safeNodes
  .map((node, index) => {
    const safeNodeId = node.id.trim() || `node-${index + 1}`;
    const previousNodeId =
      safeNodes[index - 1]?.id.trim() || `node-${index}`;
    const dependsOn =
      index === 0
        ? ""
        : `    dependsOn: ${quoteWorkflowValue(previousNodeId)}\n`;
    const skillRef = node.skillRef.trim();
    const skillLocalId = workflowSkillLocalIdByRef.get(skillRef);
    const usesBlock = skillLocalId
      ? `    uses:
      - ${quoteWorkflowValue(`skill:${skillLocalId}`)}
`
      : "";

    return `  - id: ${quoteWorkflowValue(safeNodeId)}
    type: ${quoteWorkflowValue(node.type.trim() || "task-work")}
${dependsOn}${usesBlock}    outputs:
      - kind: file
        ref: ${quoteWorkflowValue(node.output.trim() || `${safeNodeId}.md`)}
    exit:
      maxRetries: ${Number.isFinite(node.maxRetries) ? Math.max(0, Math.trunc(node.maxRetries)) : 1}
      review: model
      criteria:
        - Node output is complete enough for the next Workflow Node.`;
  })
  .join("\n")}
`;
}

export function App({
  initialAgentBindings = [],
  initialExecutionSettings = null,
  initialDecompositionResults = [],
  initialCliDownloadHelpOpen = false,
  initialModelSettingsSection = "model",
  initialPage,
  initialProjects = [],
  initialRequirements = [],
  initialSelectedSkillId = "",
  initialSkillContentDialogOpen = false,
  initialSkillUploadDialogOpen = false,
  initialSkillUploadMode = "zip",
  initialSettingsSection = "basic",
  initialSkills = [],
  initialTasks = [],
  initialWorkbenchAction = null,
  initialClarificationRequirementId = "",
  initialEditingRequirementId = "",
  initialWorkflowTemplateDialog = null,
  initialEditingWorkflowId = "",
  initialPreviewWorkflowId = "",
  initialWorkflowRunDetailDialog = null,
  initialWorkflowRunsByTaskId = {},
  initialWorkflowFiles = []
}: AppProps = {}) {
  const normalizedInitialProjects = initialProjects.map(normalizeProject);
  const [activePage, setActivePage] = useState<ActivePage>(
    () => initialPage ?? readActivePageFromLocation()
  );
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSection>(initialSettingsSection);
  const [activeModelSettingsSection, setActiveModelSettingsSection] =
    useState<ModelSettingsSection>(initialModelSettingsSection);
  const [activeWorkbenchAction, setActiveWorkbenchAction] =
    useState<ActiveWorkbenchAction>(initialWorkbenchAction);
  const [activeWorkflowTemplateDialog, setActiveWorkflowTemplateDialog] =
    useState<WorkflowTemplateDialog>(initialWorkflowTemplateDialog);
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    const storedProjectId = readStoredProjectId(getBrowserStorage());

    return normalizedInitialProjects.some((project) => project.id === storedProjectId)
      ? storedProjectId
      : normalizedInitialProjects[0]?.id ?? storedProjectId;
  });
  const [locale, setLocale] = useState<Locale>(() =>
    readStoredLocale(typeof window === "undefined" ? undefined : window.localStorage)
  );
  const t = getMessages(locale);
  const forgeCliDownloadUrl = getForgeCliDownloadUrl();
  const [projects, setProjects] = useState<Project[]>(normalizedInitialProjects);
  const [projectName, setProjectName] = useState("");
  const [editedProjectName, setEditedProjectName] = useState(() => {
    const storedProjectId = readStoredProjectId(getBrowserStorage());
    const selectedInitialProjectId = normalizedInitialProjects.some(
      (project) => project.id === storedProjectId
    )
      ? storedProjectId
      : normalizedInitialProjects[0]?.id ?? storedProjectId;

    return (
      normalizedInitialProjects.find((project) => project.id === selectedInitialProjectId)
        ?.name ?? ""
    );
  });
  const [artifactStorageMode, setArtifactStorageMode] =
    useState<ArtifactStorageMode>("local-only");
  const [dbStrategy, setDbStrategy] = useState<DbStrategy>("sqlite");
  const [projectStatus, setProjectStatus] = useState<StatusMessage>({
    kind: "status",
    key: "projectIdle"
  });
  const [workflowSource, setWorkflowSource] = useState("");
  const [workflowImportMode, setWorkflowImportMode] =
    useState<WorkflowImportMode>("source");
  const [builderWorkflowName, setBuilderWorkflowName] = useState("");
  const [builderNodes, setBuilderNodes] = useState<TemplateBuilderNode[]>([
    {
      id: "work",
      maxRetries: 1,
      output: "work.md",
      skillRef: "",
      type: "task-work"
    }
  ]);
  const [selectedPreviewWorkflowId, setSelectedPreviewWorkflowId] = useState(
    initialPreviewWorkflowId
  );
  const [workflowPreview, setWorkflowPreview] = useState<WorkflowFile | null>(
    null
  );
  const [workflowFiles, setWorkflowFiles] =
    useState<WorkflowFileMetadata[]>(initialWorkflowFiles);
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [skillUploadArchive, setSkillUploadArchive] =
    useState<SkillUploadArchive | null>(null);
  const [skillSourceUrl, setSkillSourceUrl] = useState("");
  const [skillUploadMode, setSkillUploadMode] =
    useState<SkillUploadMode>(initialSkillUploadMode);
  const [selectedSkillId, setSelectedSkillId] = useState(initialSelectedSkillId);
  const [selectedSkillFilePath, setSelectedSkillFilePath] = useState("");
  const [isSkillContentDialogOpen, setIsSkillContentDialogOpen] = useState(
    initialSkillContentDialogOpen
  );
  const [isSkillUploadDialogOpen, setIsSkillUploadDialogOpen] = useState(
    initialSkillUploadDialogOpen
  );
  const [isCliDownloadHelpOpen, setIsCliDownloadHelpOpen] = useState(
    initialCliDownloadHelpOpen
  );
  const [editedWorkflowNames, setEditedWorkflowNames] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      initialWorkflowFiles.map((workflowFile) => [
        workflowFile.id,
        workflowFile.name
      ])
    )
  );
  const [editingWorkflowId, setEditingWorkflowId] = useState(
    initialEditingWorkflowId
  );
  const [workflowImportStatus, setWorkflowImportStatus] =
    useState<StatusMessage>({
      kind: "status",
      key: "workflowIdle"
    });
  const [requirements, setRequirements] =
    useState<Requirement[]>(initialRequirements);
  const [decompositionResults, setDecompositionResults] = useState<
    DecompositionResult[]
  >(initialDecompositionResults);
  const [editedDecompositionSummaries, setEditedDecompositionSummaries] =
    useState<Record<string, string>>(() =>
      Object.fromEntries(
        initialDecompositionResults.map((decompositionResult) => [
          decompositionResult.id,
          decompositionResult.summary
        ])
      )
    );
  const [editedDecompositionItems, setEditedDecompositionItems] = useState<
    Record<string, EditableDecompositionItem[]>
  >(() =>
    Object.fromEntries(
      initialDecompositionResults.map((decompositionResult) => [
        decompositionResult.id,
        createEditableDecompositionItems(decompositionResult)
      ])
    )
  );
  const [editedRequirementTitles, setEditedRequirementTitles] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      initialRequirements.map((requirement) => [
        requirement.id,
        requirement.title
      ])
    )
  );
  const [editedRequirementBodies, setEditedRequirementBodies] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      initialRequirements.map((requirement) => [
        requirement.id,
        requirement.body
      ])
    )
  );
  const [editingRequirementId, setEditingRequirementId] = useState(
    initialEditingRequirementId
  );
  const [clarificationRequirementId, setClarificationRequirementId] = useState(
    initialClarificationRequirementId
  );
  const [clarificationAnswers, setClarificationAnswers] = useState<
    Record<string, string>
  >({});
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTaskBoardRequirementId, setSelectedTaskBoardRequirementId] =
    useState("");
  const [workflowRunsByTaskId, setWorkflowRunsByTaskId] = useState<
    Record<string, WorkflowRunWithNodes[]>
  >(initialWorkflowRunsByTaskId);
  const [requirementTitle, setRequirementTitle] = useState("");
  const [requirementBody, setRequirementBody] = useState("");
  const [selectedRequirementWorkflowId, setSelectedRequirementWorkflowId] =
    useState("");
  const [selectedTaskWorkflowIds, setSelectedTaskWorkflowIds] = useState<
    Record<string, string>
  >(() => readStoredTaskWorkflowSelections(getBrowserStorage()));
  const [requirementStatus, setRequirementStatus] = useState<StatusMessage>({
    kind: "status",
    key: "requirementIdle"
  });
  const [taskBoardStatus, setTaskBoardStatus] = useState<StatusMessage>({
    kind: "status",
    key: "taskBoardIdle"
  });
  const [executionSettings, setExecutionSettings] =
    useState<ExecutionSettings | null>(initialExecutionSettings);
  const [agentBindings, setAgentBindings] =
    useState<AgentBinding[]>(initialAgentBindings);
  const [modelProvider, setModelProvider] = useState<ModelProviderKind>(
    initialExecutionSettings?.modelProvider ?? "openai-compatible"
  );
  const [modelBaseUrl, setModelBaseUrl] = useState(
    initialExecutionSettings?.modelBaseUrl ?? ""
  );
  const [modelName, setModelName] = useState(
    initialExecutionSettings?.modelName ?? ""
  );
  const [modelApiKey, setModelApiKey] = useState("");
  const initialSelectedProject = normalizedInitialProjects.find(
    (project) => project.id === selectedProjectId
  );
  const [defaultExecutorType, setDefaultExecutorType] = useState<ExecutorType>(
    initialSelectedProject?.defaultExecutorType ?? "model-api"
  );
  const [defaultExecutorAgentBindingId, setDefaultExecutorAgentBindingId] =
    useState(initialSelectedProject?.defaultExecutorAgentBindingId ?? "");
  const [decompositionDialog, setDecompositionDialog] =
    useState<DecompositionDialogState>(null);
  const [pendingRequirementAction, setPendingRequirementAction] =
    useState<PendingRequirementAction>(null);
  const [workflowRunExecutorDialog, setWorkflowRunExecutorDialog] =
    useState<WorkflowRunExecutorDialogState>(null);
  const [workflowRunDetailDialog, setWorkflowRunDetailDialog] =
    useState<WorkflowRunDetailDialogState>(initialWorkflowRunDetailDialog);
  const [retryingNodeRunIds, setRetryingNodeRunIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isRunningAllTaskWorkflows, setIsRunningAllTaskWorkflows] =
    useState(false);
  const [workflowRunExecutorError, setWorkflowRunExecutorError] = useState("");
  const [selectedDecompositionExecutorValue, setSelectedDecompositionExecutorValue] =
    useState(
      getExecutorOptionValue(
        initialSelectedProject?.defaultExecutorType ?? "model-api",
        initialSelectedProject?.defaultExecutorAgentBindingId ?? null
      )
    );
  const [isReplacingModelApiKey, setIsReplacingModelApiKey] = useState(false);
  const [agentProxyUrl, setAgentProxyUrl] = useState(
    initialExecutionSettings?.agentProxyUrl ?? ""
  );
  const [settingsStatus, setSettingsStatus] = useState<StatusMessage>({
    kind: "status",
    key: "settingsIdle"
  });

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return;
    }

    const eventSource = createRealtimeEventSource();
    const eventTypes = [
      "task.created",
      "task.updated",
      "tasks.deleted",
      "workflowRun.created",
      "workflowRun.updated",
      "nodeRun.created",
      "nodeRun.updated"
    ];
    const handleRealtimeEvent = (message: Event) => {
      try {
        const event = JSON.parse(
          (message as MessageEvent<string>).data
        ) as RealtimeEvent;

        setTasks((currentTasks) => applyRealtimeTaskEvent(currentTasks, event));
        setWorkflowRunsByTaskId((currentWorkflowRuns) =>
          applyRealtimeWorkflowRunEvent(currentWorkflowRuns, event)
        );
      } catch {
        // Ignore malformed realtime messages and keep the current board state.
      }
    };

    for (const eventType of eventTypes) {
      eventSource.addEventListener(eventType, handleRealtimeEvent);
    }

    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listWorkflowFiles(),
      listRequirements(),
      listDecompositionResults(),
      listTasks(),
      getExecutionSettings(),
      listAgentBindings()
    ])
      .then(([
        nextWorkflowFiles,
        nextRequirements,
        nextDecompositionResults,
        nextTasks,
        nextExecutionSettings,
        nextAgentBindings
      ]) => {
        if (!cancelled) {
          setWorkflowFiles(nextWorkflowFiles);
          setRequirements(nextRequirements);
          setDecompositionResults(nextDecompositionResults);
          setEditedDecompositionSummaries(
            Object.fromEntries(
              nextDecompositionResults.map((decompositionResult) => [
                decompositionResult.id,
                decompositionResult.summary
              ])
            )
          );
          setEditedDecompositionItems(
            Object.fromEntries(
              nextDecompositionResults.map((decompositionResult) => [
                decompositionResult.id,
                createEditableDecompositionItems(decompositionResult)
              ])
            )
          );
          setEditedRequirementTitles(
            Object.fromEntries(
              nextRequirements.map((requirement) => [
                requirement.id,
                requirement.title
              ])
            )
          );
          setEditedRequirementBodies(
            Object.fromEntries(
              nextRequirements.map((requirement) => [
                requirement.id,
                requirement.body
              ])
            )
          );
          setTasks(nextTasks);
          setExecutionSettings(nextExecutionSettings);
          setAgentBindings(nextAgentBindings);
          setModelProvider(nextExecutionSettings.modelProvider);
          setModelBaseUrl(nextExecutionSettings.modelBaseUrl);
          setModelName(nextExecutionSettings.modelName);
          const nextSelectedProject =
            projects.find((project) => project.id === selectedProjectId) ??
            projects[0];
          setDefaultExecutorType(
            nextSelectedProject?.defaultExecutorType ?? "model-api"
          );
          setDefaultExecutorAgentBindingId(
            nextSelectedProject?.defaultExecutorAgentBindingId ?? ""
          );
          setSelectedDecompositionExecutorValue(
            getExecutorOptionValue(
              nextSelectedProject?.defaultExecutorType ?? "model-api",
              nextSelectedProject?.defaultExecutorAgentBindingId ?? null
            )
          );
          setAgentProxyUrl(nextExecutionSettings.agentProxyUrl);
          setSelectedRequirementWorkflowId(nextWorkflowFiles[0]?.id ?? "");
          setSelectedPreviewWorkflowId((currentWorkflowFileId) =>
            nextWorkflowFiles.some(
              (workflowFile) =>
                workflowFile.id === currentWorkflowFileId &&
                isTaskWorkflowTemplate(workflowFile)
            )
              ? currentWorkflowFileId
              : ""
          );
        }

        return Promise.all(
          nextTasks.map(async (task) => [
            task.id,
            await listTaskWorkflowRuns(task.id).catch(() => [])
          ] as const)
        );
      })
      .then((workflowRunEntries) => {
        if (!cancelled) {
          setWorkflowRunsByTaskId(Object.fromEntries(workflowRunEntries));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExecutionSettings((currentSettings) =>
            currentSettings ?? {
              agentProxyConfigured: false,
              agentProxyUrl: "",
              defaultExecutorAgentBindingId: null,
              defaultExecutorType: "model-api",
              modelBaseUrl: "",
              modelConfigured: false,
              modelName: "",
              modelProvider: "openai-compatible",
              updatedAt: ""
            }
          );
          setModelProvider("openai-compatible");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshRequirementPlanningResources() {
    const [nextRequirements, nextDecompositionResults, nextTasks] =
      await Promise.all([
        listRequirements(),
        listDecompositionResults(),
        listTasks()
      ]);

    setRequirements(nextRequirements);
    setDecompositionResults(nextDecompositionResults);
    setEditedDecompositionSummaries((currentSummaries) => ({
      ...Object.fromEntries(
        nextDecompositionResults.map((decompositionResult) => [
          decompositionResult.id,
          decompositionResult.summary
        ])
      ),
      ...currentSummaries
    }));
    setEditedDecompositionItems((currentItems) => ({
      ...Object.fromEntries(
        nextDecompositionResults.map((decompositionResult) => [
          decompositionResult.id,
          createEditableDecompositionItems(decompositionResult)
        ])
      ),
      ...currentItems
    }));
    setTasks(nextTasks);

    return {
      decompositionResults: nextDecompositionResults,
      requirements: nextRequirements,
      tasks: nextTasks
    };
  }

  useEffect(() => {
    if (decompositionDialog?.mode !== "running") {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(() => {
      void refreshRequirementPlanningResources()
        .then(({ requirements: nextRequirements }) => {
          if (cancelled || decompositionDialog.mode !== "running") {
            return;
          }

          const requirement = nextRequirements.find(
            (item) => item.id === decompositionDialog.requirementId
          );

          if (!requirement) {
            setDecompositionDialog(null);
            return;
          }

          if (requirement.status === "decomposition_failed") {
            setDecompositionDialog(null);
            setRequirementStatus(
              requirement.errorMessage
                ? { kind: "error", message: requirement.errorMessage }
                : { kind: "status", key: "requirementCreationFailed" }
            );
            return;
          }

          if (requirement.status === "ready_to_generate_tasks") {
            setDecompositionDialog(null);
            setRequirementStatus({ kind: "status", key: "decompositionReady" });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRequirementStatus({
              kind: "status",
              key: "requirementResourcesUnavailable"
            });
          }
        });
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [decompositionDialog]);

  useEffect(() => {
    const project = projects.find((item) => item.id === selectedProjectId);

    setEditedProjectName(project?.name ?? "");
    setDefaultExecutorType(project?.defaultExecutorType ?? "model-api");
    setDefaultExecutorAgentBindingId(project?.defaultExecutorAgentBindingId ?? "");
    setSelectedDecompositionExecutorValue(
      getExecutorOptionValue(
        project?.defaultExecutorType ?? "model-api",
        project?.defaultExecutorAgentBindingId ?? null
      )
    );
  }, [projects, selectedProjectId]);

  useEffect(() => {
    let cancelled = false;

    listSkills(selectedProjectId)
      .then((nextSkills) => {
        if (!cancelled) {
          setSkills(nextSkills);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSettingsStatus({ kind: "status", key: "skillListUnavailable" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    let cancelled = false;

    listProjects()
      .then((nextProjects) => {
        if (!cancelled) {
          setProjects(nextProjects);
          setSelectedProjectId((currentProjectId) => {
            const storedProjectId = readStoredProjectId(getBrowserStorage());
            const candidateProjectId = currentProjectId || storedProjectId;
            const nextProjectId = nextProjects.some(
              (project) => project.id === candidateProjectId
            )
              ? candidateProjectId
              : nextProjects[0]?.id ?? "";

            saveStoredProjectId(getBrowserStorage(), nextProjectId);

            return nextProjectId;
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjectStatus({ kind: "status", key: "projectListUnavailable" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function handlePopState() {
      setActivePage(readActivePageFromLocation());
      setActiveWorkbenchAction(null);
      setActiveWorkflowTemplateDialog(null);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  function handleNavigatePage(page: ActivePage) {
    setActivePage(page);
    setActiveWorkbenchAction(null);
    setActiveWorkflowTemplateDialog(null);

    if (typeof window !== "undefined") {
      const nextPath = getPathForPage(page);

      if (window.location.pathname !== nextPath) {
        window.history.pushState(null, "", nextPath);
      }
    }
  }

  function handleOpenWorkflowTemplateDialog(dialog: Exclude<WorkflowTemplateDialog, null>) {
    setActiveWorkflowTemplateDialog(dialog);
    setWorkflowImportMode("source");

    if (dialog === "import") {
      setWorkflowSource("");
    }
  }

  function handleCloseWorkflowTemplateDialog() {
    setActiveWorkflowTemplateDialog(null);
  }

  function handleOpenSkillUploadDialog(mode: SkillUploadMode) {
    setSkillUploadMode(mode);
    setSkillUploadArchive(null);
    setSkillSourceUrl("");
    setIsSkillUploadDialogOpen(true);
  }

  function handleSelectProject(projectId: string) {
    setSelectedProjectId(projectId);
    saveStoredProjectId(getBrowserStorage(), projectId);
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProjectStatus({ kind: "status", key: "creatingProject" });

    try {
      const project = await createProject({
        artifactStorageMode,
        dbStrategy,
        name: projectName
      });

      setProjects((currentProjects) => [...currentProjects, project]);
      handleSelectProject(project.id);
      setProjectName("");
      setActiveWorkbenchAction(null);
      setProjectStatus({
        kind: "named",
        key: "createdProject",
        name: project.name
      });
    } catch {
      setProjectStatus({ kind: "status", key: "projectCreationFailed" });
    }
  }

  function handleChangeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    saveStoredLocale(
      typeof window === "undefined" ? undefined : window.localStorage,
      nextLocale
    );
  }

  async function handleSaveProjectName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProjectId) {
      return;
    }

    setSettingsStatus({ kind: "status", key: "savingSettings" });

    try {
      const updatedProject = await updateProject(selectedProjectId, {
        name: editedProjectName
      });

      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === updatedProject.id ? updatedProject : project
        )
      );
      setEditedProjectName(updatedProject.name);
      setSettingsStatus({ kind: "status", key: "settingsSaved" });
    } catch (error) {
      setSettingsStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "settingsSaveFailed" }
      );
    }
  }

  async function handleSaveProjectDefaultExecutor(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedProjectId) {
      return;
    }

    setSettingsStatus({ kind: "status", key: "savingSettings" });

    try {
      const updatedProject = await updateProject(selectedProjectId, {
        defaultExecutorAgentBindingId:
          defaultExecutorType === "agent-binding"
            ? defaultExecutorAgentBindingId || null
            : null,
        defaultExecutorType
      });

      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === updatedProject.id ? updatedProject : project
        )
      );
      setDefaultExecutorType(updatedProject.defaultExecutorType);
      setDefaultExecutorAgentBindingId(
        updatedProject.defaultExecutorAgentBindingId ?? ""
      );
      setSettingsStatus({ kind: "status", key: "settingsSaved" });
    } catch (error) {
      setSettingsStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "settingsSaveFailed" }
      );
    }
  }

  async function handleSaveSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsStatus({ kind: "status", key: "savingSkill" });

    try {
      const trimmedSourceUrl = skillSourceUrl.trim();
      const skill = await uploadSkill(
        skillUploadMode === "zip"
          ? {
              archive: {
                contentBase64: skillUploadArchive?.contentBase64 ?? "",
                name: skillUploadArchive?.name ?? ""
              },
              projectId: selectedProjectId || null
            }
          : {
              projectId: selectedProjectId || null,
              sourceUrl: trimmedSourceUrl
            }
      );

      setSkills((currentSkills) => [...currentSkills, skill]);
      setSkillUploadArchive(null);
      setSkillSourceUrl("");
      setIsSkillUploadDialogOpen(false);
      setSelectedSkillId(skill.id);
      setSelectedSkillFilePath("");
      setIsSkillContentDialogOpen(false);
      setSettingsStatus({ kind: "status", key: "skillSaved" });
    } catch (error) {
      setSettingsStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "settingsSaveFailed" }
      );
    }
  }

  async function handleSkillFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setSkillUploadArchive(null);
      return;
    }

    setSkillUploadArchive({
      contentBase64: await readFileAsBase64(file),
      name: file.name,
      size: file.size
    });
    setSkillSourceUrl("");
  }

  async function handleDeleteSkill(skillId: string) {
    setSettingsStatus({ kind: "status", key: "deletingSkill" });

    try {
      await deleteSkill(skillId);
      setSkills((currentSkills) =>
        currentSkills.filter((skill) => skill.id !== skillId)
      );
      setSelectedSkillId((currentSkillId) =>
        currentSkillId === skillId ? "" : currentSkillId
      );
      setSelectedSkillFilePath((currentPath) =>
        selectedSkillId === skillId ? "" : currentPath
      );
      if (selectedSkillId === skillId) {
        setIsSkillContentDialogOpen(false);
      }
      setSettingsStatus({ kind: "status", key: "skillDeleted" });
    } catch (error) {
      setSettingsStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "skillDeletionFailed" }
      );
    }
  }

  async function handleUpdateSkillFromSource(skillId: string) {
    setSettingsStatus({ kind: "status", key: "updatingSkill" });

    try {
      const skill = await updateSkillFromSource(skillId);

      setSkills((currentSkills) =>
        currentSkills.map((currentSkill) =>
          currentSkill.id === skill.id ? skill : currentSkill
        )
      );
      setSettingsStatus({ kind: "status", key: "skillUpdated" });
    } catch (error) {
      setSettingsStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "skillUpdateFailed" }
      );
    }
  }

  async function handleImportWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkflowImportStatus({
      kind: "status",
      key: "importingWorkflowFile"
    });

    try {
      const result = await importWorkflowFile(workflowSource);

      setWorkflowPreview(result.workflow);
      setWorkflowFiles((currentWorkflowFiles) => [
        ...currentWorkflowFiles,
        result.workflowFile
      ]);
      setEditedWorkflowNames((currentNames) => ({
        ...currentNames,
        [result.workflowFile.id]: result.workflowFile.name
      }));
      setSelectedRequirementWorkflowId(result.workflowFile.id);
      setActiveWorkflowTemplateDialog(null);
      setWorkflowImportStatus({
        kind: "named",
        key: "importedWorkflow",
        name: result.workflowFile.name
      });
    } catch (error) {
      setWorkflowPreview(null);
      setWorkflowImportStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "workflowImportFailed" }
      );
    }
  }

  async function handleCreateWorkflowFromBuilder(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setWorkflowImportStatus({
      kind: "status",
      key: "importingWorkflowFile"
    });

    const source = createWorkflowSourceFromBuilder(
      builderWorkflowName,
      builderNodes,
      skills
    );

    try {
      const result = await importWorkflowFile(source);

      setWorkflowPreview(result.workflow);
      setWorkflowFiles((currentWorkflowFiles) => [
        ...currentWorkflowFiles,
        result.workflowFile
      ]);
      setEditedWorkflowNames((currentNames) => ({
        ...currentNames,
        [result.workflowFile.id]: result.workflowFile.name
      }));
      setActiveWorkflowTemplateDialog(null);
      setWorkflowImportStatus({
        kind: "named",
        key: "importedWorkflow",
        name: result.workflowFile.name
      });
    } catch (error) {
      setWorkflowPreview(null);
      setWorkflowImportStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "workflowImportFailed" }
      );
    }
  }

  async function handleWorkflowFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setWorkflowImportMode("file");
    setWorkflowSource(await file.text());
  }

  async function handleCreateRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequirementStatus({
      kind: "status",
      key: "runningRequirementWorkflow"
    });

    try {
      let workflowFileId = selectedRequirementWorkflowId;

      if (!workflowFileId) {
        const result = await importWorkflowFile(defaultWorkflowSource, "", {
          templateType: "builtin"
        });

        setWorkflowPreview(result.workflow);
        setWorkflowFiles((currentWorkflowFiles) => [
          ...currentWorkflowFiles,
          result.workflowFile
        ]);
        setEditedWorkflowNames((currentNames) => ({
          ...currentNames,
          [result.workflowFile.id]: result.workflowFile.name
        }));
        workflowFileId = result.workflowFile.id;
        setSelectedRequirementWorkflowId(workflowFileId);
      }

      const result = await createRequirement({
        body: requirementBody,
        projectId: selectedProjectId || null,
        title: requirementTitle,
        workflowFileId
      });
      setRequirements((currentRequirements) => [
        ...currentRequirements,
        result.requirement
      ]);
      setEditedRequirementTitles((currentTitles) => ({
        ...currentTitles,
        [result.requirement.id]: result.requirement.title
      }));
      setEditedRequirementBodies((currentBodies) => ({
        ...currentBodies,
        [result.requirement.id]: result.requirement.body
      }));

      setRequirementTitle("");
      setRequirementBody("");
      setActiveWorkbenchAction(null);
      setRequirementStatus({ kind: "status", key: "createdRequirement" });
    } catch (error) {
      setRequirementStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "requirementCreationFailed" }
      );
    }
  }

  async function handleDeleteRequirement(requirementId: string) {
    setRequirementStatus({ kind: "status", key: "deletingRequirement" });

    try {
      await deleteRequirement(requirementId);
      const deletedTaskIds = new Set(
        tasks
          .filter((task) => task.requirementId === requirementId)
          .map((task) => task.id)
      );

      setRequirements((currentRequirements) =>
        currentRequirements.filter((requirement) => requirement.id !== requirementId)
      );
      setEditedRequirementTitles((currentTitles) => {
        const remainingTitles = { ...currentTitles };

        delete remainingTitles[requirementId];

        return remainingTitles;
      });
      setEditedRequirementBodies((currentBodies) => {
        const remainingBodies = { ...currentBodies };

        delete remainingBodies[requirementId];

        return remainingBodies;
      });
      setEditingRequirementId((currentRequirementId) =>
        currentRequirementId === requirementId ? "" : currentRequirementId
      );
      setTasks((currentTasks) =>
        currentTasks.filter((task) => task.requirementId !== requirementId)
      );
      setWorkflowRunsByTaskId((currentWorkflowRuns) =>
        Object.fromEntries(
          Object.entries(currentWorkflowRuns).filter(
            ([taskId]) => !deletedTaskIds.has(taskId)
          )
        )
      );
      setPendingRequirementAction(null);
      setRequirementStatus({ kind: "status", key: "deletedRequirement" });
    } catch (error) {
      setRequirementStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "requirementDeletionFailed" }
      );
    }
  }

  async function handleResetRequirement(requirementId: string) {
    setRequirementStatus({ kind: "status", key: "resettingRequirement" });

    try {
      const result = await resetRequirement(requirementId);
      const deletedTaskIds = new Set(
        tasks
          .filter((task) => task.requirementId === requirementId)
          .map((task) => task.id)
      );
      const removedDecompositionResultIds = new Set(
        decompositionResults
          .filter((decompositionResult) =>
            decompositionResult.requirementId === requirementId
          )
          .map((decompositionResult) => decompositionResult.id)
      );

      setRequirements((currentRequirements) =>
        currentRequirements.map((requirement) =>
          requirement.id === requirementId ? result.requirement : requirement
        )
      );
      setTasks((currentTasks) =>
        currentTasks.filter((task) => task.requirementId !== requirementId)
      );
      setWorkflowRunsByTaskId((currentWorkflowRuns) =>
        Object.fromEntries(
          Object.entries(currentWorkflowRuns).filter(
            ([taskId]) => !deletedTaskIds.has(taskId)
          )
        )
      );
      setDecompositionResults((currentResults) =>
        currentResults.filter(
          (decompositionResult) =>
            decompositionResult.requirementId !== requirementId
        )
      );
      setEditedDecompositionSummaries((currentSummaries) =>
        Object.fromEntries(
          Object.entries(currentSummaries).filter(
            ([decompositionResultId]) =>
              !removedDecompositionResultIds.has(decompositionResultId)
          )
        )
      );
      setEditedDecompositionItems((currentItems) =>
        Object.fromEntries(
          Object.entries(currentItems).filter(
            ([decompositionResultId]) =>
              !removedDecompositionResultIds.has(decompositionResultId)
          )
        )
      );
      setDecompositionDialog((currentDialog) =>
        currentDialog?.requirementId === requirementId ? null : currentDialog
      );
      setPendingRequirementAction(null);
      setRequirementStatus({ kind: "status", key: "resetRequirement" });
    } catch (error) {
      setRequirementStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "requirementResetFailed" }
      );
    }
  }

  function openDecompositionDialog(requirement: Requirement) {
    if (requirement.status === "decomposing") {
      setDecompositionDialog({
        estimatedSeconds: 30,
        executorLabel: t.workspace.executorInProgressLabel,
        mode: "running",
        requirementId: requirement.id
      });
      return;
    }

    const defaultValue = getExecutorOptionValue(
      defaultExecutorType,
      defaultExecutorType === "agent-binding"
        ? defaultExecutorAgentBindingId || null
        : null
    );

    setSelectedDecompositionExecutorValue(defaultValue);
    setDecompositionDialog({
      estimatedSeconds: 0,
      executorLabel: "",
      mode: "select",
      requirementId: requirement.id
    });
  }

  function openClarificationDialog(requirement: Requirement) {
    setClarificationAnswers((currentAnswers) => ({
      ...currentAnswers,
      [requirement.id]: ""
    }));
    setClarificationRequirementId(requirement.id);
  }

  async function handleCreateDecompositionResult(requirementId: string) {
    setRequirementStatus({ kind: "status", key: "runningRequirementWorkflow" });

    try {
      const executor = readExecutorOptionValue(selectedDecompositionExecutorValue);
      const result = await createRequirementDecompositionResult(
        requirementId,
        executor
      );
      setRequirements((currentRequirements) =>
        currentRequirements.map((requirement) =>
          requirement.id === result.requirement.id
            ? result.requirement
            : requirement
        )
      );
      if (result.decompositionResult) {
        setDecompositionResults((currentResults) => [
          ...currentResults.filter(
            (decompositionResult) =>
              decompositionResult.requirementId !== result.requirement.id
          ),
          result.decompositionResult!
        ]);
        setEditedDecompositionSummaries((currentSummaries) => ({
          ...currentSummaries,
          [result.decompositionResult!.id]: result.decompositionResult!.summary
        }));
        setEditedDecompositionItems((currentItems) => ({
          ...currentItems,
          [result.decompositionResult!.id]: createEditableDecompositionItems(
            result.decompositionResult!
          )
        }));
      }
      setDecompositionDialog({
        estimatedSeconds: result.estimatedSeconds ?? 30,
        executorLabel: result.executor?.executorLabel ?? t.workspace.executorInProgressLabel,
        mode: "running",
        requirementId
      });
      setRequirementStatus(
        result.decompositionResult
          ? { kind: "status", key: "decompositionReady" }
          : { kind: "status", key: "runningRequirementWorkflow" }
      );
    } catch (error) {
      setRequirementStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "requirementCreationFailed" }
      );
      setDecompositionDialog((currentDialog) =>
        currentDialog?.requirementId === requirementId ? null : currentDialog
      );
    }
  }

  async function handleGenerateTasksFromDecompositionResult(
    decompositionResultId: string
  ) {
    setRequirementStatus({ kind: "status", key: "generatingTasks" });

    try {
      const result = await generateTasksFromDecompositionResult(
        decompositionResultId
      );

      setRequirements((currentRequirements) =>
        currentRequirements.map((requirement) =>
          requirement.id === result.requirement.id
            ? result.requirement
            : requirement
        )
      );
      setTasks((currentTasks) => [...currentTasks, ...result.tasks]);
      setWorkflowRunsByTaskId((currentWorkflowRuns) => ({
        ...currentWorkflowRuns,
        ...Object.fromEntries(result.tasks.map((task) => [task.id, []]))
      }));
      setRequirementStatus({
        kind: "count",
        key: "generatedTasks",
        count: result.tasks.length
      });
    } catch (error) {
      setRequirementStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "requirementCreationFailed" }
      );
    }
  }

  async function handleSaveDecompositionResult(
    event: FormEvent<HTMLFormElement>,
    decompositionResult: DecompositionResult
  ) {
    event.preventDefault();
    setRequirementStatus({ kind: "status", key: "savingDecompositionResult" });

    try {
      const updatedDecompositionResult = await updateDecompositionResult(
        decompositionResult.id,
        {
          summary:
            editedDecompositionSummaries[decompositionResult.id] ??
            decompositionResult.summary,
          tasks:
            editedDecompositionItems[decompositionResult.id] ??
            createEditableDecompositionItems(decompositionResult)
        }
      );

      setDecompositionResults((currentResults) =>
        currentResults.map((currentResult) =>
          currentResult.id === updatedDecompositionResult.id
            ? updatedDecompositionResult
            : currentResult
        )
      );
      setEditedDecompositionSummaries((currentSummaries) => ({
        ...currentSummaries,
        [updatedDecompositionResult.id]: updatedDecompositionResult.summary
      }));
      setEditedDecompositionItems((currentItems) => ({
        ...currentItems,
        [updatedDecompositionResult.id]: createEditableDecompositionItems(
          updatedDecompositionResult
        )
      }));
      setRequirementStatus({
        kind: "status",
        key: "decompositionResultSaved"
      });
    } catch (error) {
      setRequirementStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "requirementUpdateFailed" }
      );
    }
  }

  async function handleUpdateRequirement(
    event: FormEvent<HTMLFormElement>,
    requirementId: string
  ) {
    event.preventDefault();
    setRequirementStatus({ kind: "status", key: "savingRequirement" });

    try {
      const updatedRequirement = await updateRequirement(requirementId, {
        body: editedRequirementBodies[requirementId] ?? "",
        title: editedRequirementTitles[requirementId] ?? ""
      });

      setRequirements((currentRequirements) =>
        currentRequirements.map((requirement) =>
          requirement.id === updatedRequirement.id
            ? updatedRequirement
            : requirement
        )
      );
      setEditedRequirementTitles((currentTitles) => ({
        ...currentTitles,
        [updatedRequirement.id]: updatedRequirement.title
      }));
      setEditedRequirementBodies((currentBodies) => ({
        ...currentBodies,
        [updatedRequirement.id]: updatedRequirement.body
      }));
      setEditingRequirementId("");
      setRequirementStatus({ kind: "status", key: "renamedRequirement" });
    } catch (error) {
      setRequirementStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "requirementUpdateFailed" }
      );
    }
  }

  function closeClarificationDialog() {
    setClarificationAnswers((currentAnswers) => {
      if (!clarificationRequirementId) {
        return currentAnswers;
      }

      const nextAnswers = { ...currentAnswers };
      delete nextAnswers[clarificationRequirementId];
      return nextAnswers;
    });
    setClarificationRequirementId("");
  }

  async function handleSaveClarificationAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeClarificationRequirement) {
      return;
    }

    const answer = (clarificationAnswers[activeClarificationRequirement.id] ?? "")
      .trim();

    if (!answer) {
      return;
    }

    setRequirementStatus({ kind: "status", key: "savingRequirement" });

    try {
      const updatedRequirement = await updateRequirement(
        activeClarificationRequirement.id,
        {
          body: [
            activeClarificationRequirement.body.trim(),
            "",
            t.workspace.clarificationAnswerSectionTitle,
            answer
          ]
            .filter((line, index) => index === 1 || line)
            .join("\n"),
          title: activeClarificationRequirement.title
        }
      );
      const resetResult = await resetRequirement(activeClarificationRequirement.id);
      const nextRequirement = {
        ...resetResult.requirement,
        body: updatedRequirement.body,
        title: updatedRequirement.title
      };

      setRequirements((currentRequirements) =>
        currentRequirements.map((requirement) =>
          requirement.id === nextRequirement.id ? nextRequirement : requirement
        )
      );
      setEditedRequirementTitles((currentTitles) => ({
        ...currentTitles,
        [nextRequirement.id]: nextRequirement.title
      }));
      setEditedRequirementBodies((currentBodies) => ({
        ...currentBodies,
        [nextRequirement.id]: nextRequirement.body
      }));
      closeClarificationDialog();

      const defaultExecutorValue = getExecutorOptionValue(
        defaultExecutorType,
        defaultExecutorType === "agent-binding"
          ? defaultExecutorAgentBindingId || null
          : null
      );
      const decompositionResponse = await createRequirementDecompositionResult(
        nextRequirement.id,
        readExecutorOptionValue(defaultExecutorValue)
      );
      const decomposingRequirement = {
        ...decompositionResponse.requirement,
        body: updatedRequirement.body,
        title: updatedRequirement.title
      };

      setRequirements((currentRequirements) =>
        currentRequirements.map((requirement) =>
          requirement.id === decomposingRequirement.id
            ? decomposingRequirement
            : requirement
        )
      );

      const nextDecompositionResult = decompositionResponse.decompositionResult;
      if (nextDecompositionResult) {
        setDecompositionResults((currentResults) => [
          ...currentResults.filter(
            (result) =>
              result.requirementId !== decomposingRequirement.id
          ),
          nextDecompositionResult
        ]);
        setEditedDecompositionSummaries((currentSummaries) => ({
          ...currentSummaries,
          [nextDecompositionResult.id]: nextDecompositionResult.summary
        }));
        setEditedDecompositionItems((currentItems) => ({
          ...currentItems,
          [nextDecompositionResult.id]:
            createEditableDecompositionItems(nextDecompositionResult)
        }));
      }

      setDecompositionDialog({
        estimatedSeconds: decompositionResponse.estimatedSeconds ?? 30,
        executorLabel:
          decompositionResponse.executor?.executorLabel ??
          t.workspace.executorInProgressLabel,
        mode: "running",
        requirementId: nextRequirement.id
      });
      setRequirementStatus(
        nextDecompositionResult
          ? { kind: "status", key: "decompositionReady" }
          : { kind: "status", key: "runningRequirementWorkflow" }
      );
    } catch (error) {
      setRequirementStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "requirementUpdateFailed" }
      );
    }
  }

  async function handleUpdateWorkflowFile(
    event: FormEvent<HTMLFormElement>,
    workflowFileId: string
  ) {
    event.preventDefault();
    setWorkflowImportStatus({ kind: "status", key: "savingWorkflow" });

    try {
      const updatedWorkflowFile = await updateWorkflowFile(workflowFileId, {
        name: editedWorkflowNames[workflowFileId] ?? ""
      });

      setWorkflowFiles((currentWorkflowFiles) =>
        currentWorkflowFiles.map((workflowFile) =>
          workflowFile.id === updatedWorkflowFile.id
            ? updatedWorkflowFile
            : workflowFile
        )
      );
      setEditedWorkflowNames((currentNames) => ({
        ...currentNames,
        [updatedWorkflowFile.id]: updatedWorkflowFile.name
      }));
      if (selectedPreviewWorkflowId === updatedWorkflowFile.id) {
        const updatedWorkflow = parseWorkflowDefinition(
          updatedWorkflowFile.definition
        );

        setWorkflowPreview(updatedWorkflow);
      }
      setEditingWorkflowId("");
      setWorkflowImportStatus({ kind: "status", key: "renamedWorkflow" });
    } catch (error) {
      setWorkflowImportStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "workflowUpdateFailed" }
      );
    }
  }

  const taskWorkflowFiles = workflowFiles.filter(isTaskWorkflowTemplate);
  const taskStatuses = [
    "init",
    "running",
    "failed",
    "pending_acceptance",
    "completed",
    "cancelled"
  ] as const;

  function getSelectedTaskWorkflowId(taskId: string) {
    return resolveTaskWorkflowSelection(
      taskId,
      selectedTaskWorkflowIds,
      taskWorkflowFiles
    );
  }

  function handleSelectTaskWorkflow(taskId: string, workflowFileId: string) {
    setSelectedTaskWorkflowIds((currentSelections) => ({
      ...currentSelections,
      [taskId]: workflowFileId
    }));
    saveStoredTaskWorkflowSelection(
      getBrowserStorage(),
      taskId,
      workflowFileId
    );
  }

  function handleOpenWorkflowRunExecutorDialog(taskId: string) {
    setWorkflowRunExecutorError("");
    const selectedTaskWorkflowId = getSelectedTaskWorkflowId(taskId);

    if (!selectedTaskWorkflowId) {
      setTaskBoardStatus({ kind: "status", key: "importTaskWorkflowFirst" });
      return;
    }

    const workflowFile = workflowFiles.find(
      (candidate) => candidate.id === selectedTaskWorkflowId
    );
    const workflow = workflowFile
      ? parseWorkflowDefinition(workflowFile.definition)
      : null;

    if (!workflowFile || !workflow) {
      setTaskBoardStatus({
        kind: "error",
        message: t.workspace.unknownWorkflowTemplate
      });
      return;
    }

    setWorkflowRunExecutorDialog({
      assignments: createWorkflowRunExecutorAssignments(
        workflow,
        getProjectDefaultExecutorValue(selectedProject)
      ),
      taskId,
      workflowFileId: workflowFile.id
    });
  }

  async function handleStartTaskWorkflowRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workflowRunExecutorDialog) {
      return;
    }

    setWorkflowRunExecutorError("");
    setTaskBoardStatus({ kind: "status", key: "startingWorkflowRun" });

    try {
      const nodeExecutorAssignments = Object.entries(
        workflowRunExecutorDialog.assignments
      ).map(([nodeId, value]) => ({
        ...readExecutorOptionValue(value),
        nodeId
      }));
      const workflowRun = await startTaskWorkflowRun(
        workflowRunExecutorDialog.taskId,
        workflowRunExecutorDialog.workflowFileId,
        { nodeExecutorAssignments }
      );

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === workflowRun.task.id ? workflowRun.task : task
        )
      );
      setWorkflowRunsByTaskId((currentWorkflowRuns) => ({
        ...currentWorkflowRuns,
        [workflowRunExecutorDialog.taskId]: [
          ...(currentWorkflowRuns[workflowRunExecutorDialog.taskId] ?? []),
          workflowRun
        ]
      }));
      setWorkflowRunExecutorDialog(null);
      setWorkflowRunExecutorError("");
      setTaskBoardStatus({
        kind: "named",
        key: "workflowRunStatus",
        name: workflowRun.workflowRun.status
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t.status.workflowRunFailed;
      setWorkflowRunExecutorError(message);
      setTaskBoardStatus({ kind: "error", message });
    }
  }

  async function waitForTaskWorkflowRunCompletion(
    taskId: string,
    workflowRunId: string
  ) {
    for (let attempt = 0; attempt < 600; attempt += 1) {
      await waitFor(1000);

      const [nextRuns, nextTasks] = await Promise.all([
        listTaskWorkflowRuns(taskId),
        listTasks()
      ]);
      const currentRun = nextRuns.find(
        (run) => run.workflowRun.id === workflowRunId
      );

      setWorkflowRunsByTaskId((currentWorkflowRuns) => ({
        ...currentWorkflowRuns,
        [taskId]: nextRuns
      }));
      setTasks(nextTasks);

      if (
        currentRun &&
        currentRun.workflowRun.status !== "running"
      ) {
        return { run: currentRun, runs: nextRuns };
      }
    }

    throw new Error("Task Workflow did not finish before the run-all timeout");
  }

  async function handleRunAllTaskWorkflows() {
    if (taskWorkflowFiles.length === 0) {
      setTaskBoardStatus({ kind: "status", key: "importTaskWorkflowFirst" });
      return;
    }

    const runAllTasks = visibleTaskBoardTasks.filter(
      (task) => shouldRunTaskInRunAll(task)
    );

    if (runAllTasks.length === 0) {
      setTaskBoardStatus({ kind: "status", key: "ranAllTaskWorkflows" });
      return;
    }

    setIsRunningAllTaskWorkflows(true);
    setTaskBoardStatus({ kind: "status", key: "runningAllTaskWorkflows" });

    try {
      let latestWorkflowRunsByTaskId = workflowRunsByTaskId;
      const orderedTaskIds = getTaskRunOrder(visibleTaskBoardTasks).filter((taskId) =>
        runAllTasks.some((task) => task.id === taskId)
      );

      for (const taskId of orderedTaskIds) {
        const task = visibleTaskBoardTasks.find((candidate) => candidate.id === taskId);

        if (!task) {
          continue;
        }

        const unfinishedDependencyId = task.dependsOn.find(
          (dependencyId) =>
            !hasSucceededWorkflowRun(dependencyId, latestWorkflowRunsByTaskId)
        );

        if (unfinishedDependencyId) {
          throw new Error(
            `Task dependency is not complete: ${unfinishedDependencyId}`
          );
        }

        const workflowFileId = getSelectedTaskWorkflowId(task.id);
        const workflowFile = taskWorkflowFiles.find(
          (candidate) => candidate.id === workflowFileId
        );
        const workflow = workflowFile
          ? parseWorkflowDefinition(workflowFile.definition)
          : null;

        if (!workflowFile || !workflow) {
          throw new Error(t.workspace.unknownWorkflowTemplate);
        }

        const nodeExecutorAssignments = Object.entries(
          createWorkflowRunExecutorAssignments(
            workflow,
            getProjectDefaultExecutorValue(selectedProject)
          )
        ).map(([nodeId, value]) => ({
          ...readExecutorOptionValue(value),
          nodeId
        }));
        const startedRun = await startTaskWorkflowRun(
          task.id,
          workflowFile.id,
          { nodeExecutorAssignments }
        );

        latestWorkflowRunsByTaskId = {
          ...latestWorkflowRunsByTaskId,
          [task.id]: [
            ...(latestWorkflowRunsByTaskId[task.id] ?? []),
            startedRun
          ]
        };
        setTasks((currentTasks) =>
          currentTasks.map((currentTask) =>
            currentTask.id === startedRun.task.id
              ? startedRun.task
              : currentTask
          )
        );
        setWorkflowRunsByTaskId(latestWorkflowRunsByTaskId);

        const completedRun = await waitForTaskWorkflowRunCompletion(
          task.id,
          startedRun.workflowRun.id
        );

        latestWorkflowRunsByTaskId = {
          ...latestWorkflowRunsByTaskId,
          [task.id]: completedRun.runs
        };

        if (completedRun.run.workflowRun.status !== "succeeded") {
          throw new Error(
            `Task Workflow ${completedRun.run.workflowRun.status}: ${task.title}`
          );
        }
      }

      setTaskBoardStatus({ kind: "status", key: "ranAllTaskWorkflows" });
    } catch (error) {
      setTaskBoardStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "runAllTaskWorkflowsFailed" }
      );
    } finally {
      setIsRunningAllTaskWorkflows(false);
    }
  }

  async function handleRetryTaskWorkflowNodeRun(
    taskId: string,
    workflowRunId: string,
    nodeRunId: string
  ) {
    setRetryingNodeRunIds((currentIds) => new Set(currentIds).add(nodeRunId));
    setTaskBoardStatus({ kind: "status", key: "retryingWorkflowNode" });

    try {
      const workflowRun = await retryTaskWorkflowNodeRun(
        taskId,
        workflowRunId,
        nodeRunId
      );

      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === workflowRun.task.id ? workflowRun.task : task
        )
      );
      setWorkflowRunsByTaskId((currentWorkflowRuns) => ({
        ...currentWorkflowRuns,
        [taskId]: (currentWorkflowRuns[taskId] ?? []).map((currentRun) =>
          currentRun.workflowRun.id === workflowRun.workflowRun.id
            ? workflowRun
            : currentRun
        )
      }));
      setTaskBoardStatus({
        kind: "named",
        key: "workflowRunStatus",
        name: workflowRun.workflowRun.status
      });
    } catch (error) {
      setTaskBoardStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "workflowRunFailed" }
      );
    } finally {
      setRetryingNodeRunIds((currentIds) => {
        const nextIds = new Set(currentIds);

        nextIds.delete(nodeRunId);

        return nextIds;
      });
    }
  }

  async function handleSaveModelSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsStatus({ kind: "status", key: "savingModelSettings" });

    try {
      const nextSettings = await updateExecutionSettings({
        modelApiKey,
        modelBaseUrl,
        modelName,
        modelProvider
      });

      setExecutionSettings(nextSettings);
      setModelProvider(nextSettings.modelProvider);
      setModelBaseUrl(nextSettings.modelBaseUrl);
      setModelName(nextSettings.modelName);
      setAgentProxyUrl(nextSettings.agentProxyUrl);
      setModelApiKey("");
      setIsReplacingModelApiKey(false);
      setSettingsStatus({ kind: "status", key: "modelSettingsSaved" });
    } catch (error) {
      setSettingsStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "settingsSaveFailed" }
      );
    }
  }

  async function handleTestModelApi() {
    setSettingsStatus({ kind: "status", key: "testingModelApi" });

    try {
      await testModelApi({
        modelApiKey,
        modelBaseUrl,
        modelName,
        modelProvider
      });
      setSettingsStatus({ kind: "status", key: "modelApiTestSucceeded" });
    } catch (error) {
      setSettingsStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "modelApiTestFailed" }
      );
    }
  }

  async function handleSaveAgentProxySettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsStatus({ kind: "status", key: "savingAgentProxySettings" });

    try {
      const nextSettings = await updateExecutionSettings({
        agentProxyUrl
      });

      setExecutionSettings(nextSettings);
      setModelProvider(nextSettings.modelProvider);
      setModelBaseUrl(nextSettings.modelBaseUrl);
      setModelName(nextSettings.modelName);
      setAgentProxyUrl(nextSettings.agentProxyUrl);
      setSettingsStatus({ kind: "status", key: "agentProxySettingsSaved" });
    } catch (error) {
      setSettingsStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "settingsSaveFailed" }
      );
    }
  }

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;
  const projectRequirements = selectedProjectId
    ? requirements.filter(
        (requirement) => requirement.projectId === selectedProjectId
      )
    : requirements;
  const decompositionResultByRequirementId = new Map(
    decompositionResults.map((decompositionResult) => [
      decompositionResult.requirementId,
      decompositionResult
    ])
  );
  const projectTasks = selectedProjectId
    ? tasks.filter(
        (task) => task.projectId === selectedProjectId
      )
    : tasks;
  const activeTaskBoardRequirementId = projectRequirements.some(
    (requirement) => requirement.id === selectedTaskBoardRequirementId
  )
    ? selectedTaskBoardRequirementId
    : "";
  const visibleTaskBoardTasks = getVisibleTaskBoardTasks(
    projectTasks,
    activeTaskBoardRequirementId
  );
  const runAllTaskCandidates = visibleTaskBoardTasks.filter(
    (task) => shouldRunTaskInRunAll(task)
  );
  const projectTaskIds = new Set(projectTasks.map((task) => task.id));
  const workflowRunCount = Object.entries(workflowRunsByTaskId).reduce(
    (count, [taskId, runs]) =>
      projectTaskIds.has(taskId) ? count + runs.length : count,
    0
  );
  const latestStatusMessage =
    [
      taskBoardStatus,
      requirementStatus,
      workflowImportStatus,
      settingsStatus,
      projectStatus
    ].find((status) => !isIdleStatus(status));
  const visibleStoredWorkflowTemplates = getVisibleWorkflowTemplates(
    workflowFiles
  ).filter((workflowFile) => !isDuplicateDefaultWorkflowTemplate(workflowFile));
  const visibleWorkflowTemplateCount =
    defaultWorkflowTemplates.length + visibleStoredWorkflowTemplates.length;
  const progressSteps = [
    [t.progress.workflowTemplates, visibleWorkflowTemplateCount],
    [t.progress.ideas, projectRequirements.length],
    [t.progress.tasks, projectTasks.length]
  ] as const;
  const visibleWorkflowNodeCount =
    defaultWorkflowTemplates.reduce(
      (total, template) => total + template.workflow.nodes.length,
      0
    ) +
    visibleStoredWorkflowTemplates.reduce(
      (total, workflowFile) => total + workflowFile.nodeCount,
      0
    );
  const hasProjects = projects.length > 0;
  const hasGeneratedWork =
    projectRequirements.length > 0 ||
    projectTasks.length > 0 ||
    workflowRunCount > 0;
  const showControlRoomPanels = hasProjects && hasGeneratedWork;
  const isModelConfigured = executionSettings?.modelConfigured ?? false;
  const showModelConfigurationStatus = shouldShowModelConfigurationStatus({
    modelConfigured: executionSettings?.modelConfigured,
    requirementCount: projectRequirements.length
  });
  const selectedSkill =
    skills.find((skill) => skill.id === selectedSkillId) ?? null;
  const selectedSkillPreviewFile = selectedSkill
    ? selectedSkill.files.find((file) => file.path === selectedSkillFilePath) ??
      null
    : null;
  const workbenchTitle = hasProjects
    ? t.workbench.readyTitle
    : t.workbench.firstProjectTitle;
  const workbenchBody = hasProjects
    ? t.workbench.readyBody
    : t.workbench.firstProjectBody;
  const projectForm = (
    <form className="stack-form" onSubmit={handleCreateProject}>
      <label>
        {t.setup.projectNameLabel}
        <input
          data-testid="project-name-input"
          minLength={1}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder={t.setup.projectNamePlaceholder}
          required
          value={projectName}
        />
      </label>
      <div className="two-field-grid">
        <label>
          {t.setup.artifactsLabel}
          <select
            data-testid="artifact-storage-select"
            onChange={(event) =>
              setArtifactStorageMode(event.target.value as ArtifactStorageMode)
            }
            value={artifactStorageMode}
          >
            <option value="local-only">{t.options.localOnly}</option>
            <option value="cloud">{t.options.cloud}</option>
          </select>
        </label>
        <label>
          {t.setup.databaseLabel}
          <select
            data-testid="db-strategy-select"
            onChange={(event) => setDbStrategy(event.target.value as DbStrategy)}
            value={dbStrategy}
          >
            <option value="sqlite">{t.options.sqlite}</option>
            <option value="postgres">{t.options.postgres}</option>
            <option value="mysql">{t.options.mysql}</option>
          </select>
        </label>
      </div>
      <button type="submit">{t.setup.createProject}</button>
    </form>
  );
  const selectedBuiltinTemplate = selectedPreviewWorkflowId.startsWith("builtin:")
    ? defaultWorkflowTemplates.find(
        (template) => `builtin:${template.key}` === selectedPreviewWorkflowId
      ) ?? null
    : null;
  const selectedWorkflowFile =
    workflowFiles.find(
      (workflowFile) =>
        workflowFile.id === selectedPreviewWorkflowId &&
        isTaskWorkflowTemplate(workflowFile)
    ) ?? null;
  const parsedSelectedWorkflow = selectedWorkflowFile
    ? parseWorkflowDefinition(selectedWorkflowFile.definition)
    : null;
  const selectedWorkflowPreview =
    selectedBuiltinTemplate?.workflow ??
    parsedSelectedWorkflow ??
    (selectedWorkflowFile?.id === selectedPreviewWorkflowId
      ? workflowPreview
      : null);
  const isNewWorkflowDialog = activeWorkflowTemplateDialog === "new";
  const workflowTemplateDialogTitle = isNewWorkflowDialog
    ? t.templatePage.newWorkflow
    : t.templatePage.importWorkflow;

  function renderWorkflowPreviewGraph(
    preview: WorkflowFile,
    workflowFile?: WorkflowFileMetadata | null
  ) {
    const workflowInputs = preview.inputs ?? [];
    const workflowSkills = preview.skills ?? [];
    const workflowAgents = preview.agents ?? [];
    const workflowArtifacts = preview.artifacts ?? [];
    const workflowArtifactTypes = [
      ...new Set(workflowArtifacts.map((artifact) => artifact.type))
    ];
    const workflowDagLayout = createWorkflowDagLayout(preview);

    return (
      <div
        aria-label={t.templatePage.previewGraphLabel}
        className="workflow-preview-graph"
      >
        <div className="workflow-preview-summary">
          <div>
            <strong>
              {workflowFile
                ? getWorkflowTemplateDisplayName(t, workflowFile)
                : preview.name}
            </strong>
            <p>{t.templatePage.templateSummary(preview.nodes.length)}</p>
          </div>
        </div>
        <div className="workflow-contract-grid">
          <article className="workflow-contract-stat">
            <span>{t.templatePage.inputsLabel}</span>
            <strong>
              {getWorkflowContractCountLabel(
                workflowInputs.length,
                "input",
                "inputs"
              )}
            </strong>
            <p>
              {getWorkflowContractValues(
                workflowInputs.map((input) => input.id),
                t.templatePage.noOutputs
              )}
            </p>
          </article>
          <article className="workflow-contract-stat">
            <span>{t.templatePage.skillsLabel}</span>
            <strong>
              {getWorkflowContractCountLabel(
                workflowSkills.length,
                "skill",
                "skills"
              )}
            </strong>
            <p>
              {getWorkflowContractValues(
                workflowSkills.map((skill) => skill.ref),
                t.templatePage.noOutputs
              )}
            </p>
          </article>
          <article className="workflow-contract-stat">
            <span>{t.templatePage.agentRolesLabel}</span>
            <strong>
              {getWorkflowContractCountLabel(
                workflowAgents.length,
                "role",
                "roles"
              )}
            </strong>
            <p>
              {getWorkflowContractValues(
                workflowAgents.map((agent) => agent.role),
                t.templatePage.noOutputs
              )}
            </p>
          </article>
          <article className="workflow-contract-stat">
            <span>{t.templatePage.artifactTypesLabel}</span>
            <strong>
              {getWorkflowContractCountLabel(
                workflowArtifactTypes.length,
                "type",
                "types"
              )}
            </strong>
            <p>
              {getWorkflowContractValues(
                workflowArtifactTypes,
                t.templatePage.noOutputs
              )}
            </p>
          </article>
        </div>
        <div className="workflow-dag-map">
          <div
            className="workflow-dag-canvas"
            style={
              {
                "--workflow-dag-height": `${workflowDagLayout.height}px`,
                "--workflow-dag-width": `${workflowDagLayout.width}px`
              } as CSSProperties
            }
          >
            <svg
              aria-hidden="true"
              className="workflow-dag-edges"
              height={workflowDagLayout.height}
              viewBox={`0 0 ${workflowDagLayout.width} ${workflowDagLayout.height}`}
              width={workflowDagLayout.width}
            >
              <defs>
                <marker
                  id="workflow-dag-arrow"
                  markerHeight="8"
                  markerWidth="8"
                  orient="auto"
                  refX="7"
                  refY="4"
                  viewBox="0 0 8 8"
                >
                  <path d="M0 0L8 4L0 8Z"></path>
                </marker>
              </defs>
              {workflowDagLayout.edges.map((edge) => {
                const controlOffset = Math.max(
                  36,
                  Math.min(84, (edge.toX - edge.fromX) / 2)
                );
                const fromLabel =
                  edge.from === "__start"
                    ? t.templatePage.startPointLabel
                    : edge.from;
                const toLabel =
                  edge.to === "__end"
                    ? t.templatePage.endPointLabel
                    : edge.to;
                const path =
                  `M ${edge.fromX} ${edge.fromY} ` +
                  `C ${edge.fromX + controlOffset} ${edge.fromY}, ` +
                  `${edge.toX - controlOffset} ${edge.toY}, ` +
                  `${edge.toX} ${edge.toY}`;

                return (
                  <path
                    aria-label={`${fromLabel} to ${toLabel}`}
                    d={path}
                    key={`${edge.from}-${edge.to}`}
                    markerEnd="url(#workflow-dag-arrow)"
                  />
                );
              })}
            </svg>
            {workflowDagLayout.cards.map((card) => {
              const node = card.node;
              const nodeInputs = node?.inputs ?? [];
              const nodeOutputs = node?.outputs ?? [];
              const nodeSkills = node?.uses ?? [];
              const nodeDependencies = node?.dependsOn ?? [];
              const exitCriteriaCount = node?.exit?.criteria?.length ?? 0;
              const reviewMode = node?.exit?.review ?? "model";
              const retryBudget = node?.exit?.maxRetries ?? 0;
              const cardStyle = {
                left: `${card.x}px`,
                top: `${card.y}px`
              };

              if (card.kind !== "node") {
                const isStart = card.kind === "start";

                return (
                  <article
                    className={`workflow-dag-card workflow-dag-card-${card.kind}`}
                    key={card.id}
                    style={cardStyle}
                  >
                    <div className="workflow-node-index">
                      {isStart ? "S" : "E"}
                    </div>
                    <div className="workflow-node-copy">
                      <h3>
                        {isStart
                          ? t.templatePage.startPointLabel
                          : t.templatePage.endPointLabel}
                      </h3>
                      <p>
                        {isStart
                          ? t.templatePage.startPointDescription(card.childCount)
                          : t.templatePage.endPointDescription(
                              workflowDagLayout.cards.filter(
                                (item) => item.kind === "node" && item.isTerminal
                              ).length
                            )}
                      </p>
                    </div>
                  </article>
                );
              }

              return (
                <article
                  className="workflow-dag-card workflow-dag-card-node"
                  key={card.id}
                  style={cardStyle}
                >
                  <div className="workflow-node-index">
                    {String(
                      preview.nodes.findIndex((item) => item.id === node?.id) +
                        1
                    ).padStart(2, "0")}
                  </div>
                  <div className="workflow-node-copy">
                    <div className="workflow-node-title-row">
                      <div>
                        <h3>{node?.id}</h3>
                        <span className="workflow-node-type-pill">
                          {node?.type}
                        </span>
                      </div>
                      <div className="workflow-node-badges">
                        {card.isEntry ? (
                          <span>{t.templatePage.startNodeBadge}</span>
                        ) : null}
                        {card.isTerminal ? (
                          <span>{t.templatePage.endNodeBadge}</span>
                        ) : null}
                      </div>
                    </div>
                    {node?.description ? (
                      <p className="workflow-node-description">
                        {node.description}
                      </p>
                    ) : null}
                    <div className="workflow-node-meta">
                      <span>
                        <strong>{t.templatePage.retryBudget(retryBudget)}</strong>
                      </span>
                      <span>
                        <strong>
                          {nodeOutputs.length > 0
                            ? nodeOutputs
                                .map(getWorkflowNodeOutputLabel)
                                .join(", ")
                            : t.templatePage.noOutputs}
                        </strong>
                      </span>
                    </div>
                    <div className="workflow-node-kv-grid">
                      <span className="workflow-node-kv-label">
                        {t.templatePage.usesLabel}
                      </span>
                      <span>
                        {getWorkflowContractValues(
                          nodeSkills,
                          t.templatePage.noOutputs
                        )}
                      </span>
                      <span className="workflow-node-kv-label">
                        {t.templatePage.nodeInputsLabel}
                      </span>
                      <span>
                        {getWorkflowContractValues(
                          nodeInputs,
                          t.templatePage.noOutputs
                        )}
                      </span>
                      <span className="workflow-node-kv-label">
                        {t.templatePage.exitCriteriaLabel}
                      </span>
                      <span>
                        {getWorkflowContractCountLabel(
                          exitCriteriaCount,
                          "criterion",
                          "criteria"
                        )}
                      </span>
                      <span className="workflow-node-kv-label">
                        {t.templatePage.reviewLabel}
                      </span>
                      <span>{reviewMode}</span>
                      {node?.humanReview?.required ? (
                        <>
                          <span className="workflow-node-kv-label">
                            {t.templatePage.humanReviewLabel}
                          </span>
                          <span>{t.templatePage.humanReviewRequired}</span>
                        </>
                      ) : null}
                    </div>
                    <p className="workflow-node-dependency">
                      {nodeDependencies.length > 0
                        ? t.templatePage.dependsOn(nodeDependencies.join(", "))
                        : t.workspace.noDependency}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function updateBuilderNode(
    index: number,
    update: Partial<TemplateBuilderNode>
  ) {
    setBuilderNodes((currentNodes) =>
      currentNodes.map((node, nodeIndex) =>
        nodeIndex === index ? { ...node, ...update } : node
      )
    );
  }

  function addBuilderNode() {
    setBuilderNodes((currentNodes) => [
      ...currentNodes,
      {
        id: `node-${currentNodes.length + 1}`,
        maxRetries: 1,
        output: `node-${currentNodes.length + 1}.md`,
        skillRef: "",
        type: "task-work"
      }
    ]);
  }

  function removeBuilderNode(index: number) {
    setBuilderNodes((currentNodes) =>
      currentNodes.length <= 1
        ? currentNodes
        : currentNodes.filter((_, nodeIndex) => nodeIndex !== index)
    );
  }

  const workflowBuilderForm = (
    <form className="stack-form" onSubmit={handleCreateWorkflowFromBuilder}>
      <label>
        {t.templatePage.builderNameLabel}
        <input
          minLength={1}
          onChange={(event) => setBuilderWorkflowName(event.target.value)}
          required
          value={builderWorkflowName}
        />
        <span className="form-helper template-builder-helper">
          {t.templatePage.builderNameHelp}
        </span>
      </label>
      <div className="template-builder-panel">
        <div className="section-heading-with-action">
          <div>
            <p className="template-builder-title">
              {t.templatePage.builderNodesTitle}
            </p>
            <p>{t.templatePage.createDescription}</p>
          </div>
          <button
            className="button-secondary"
            onClick={addBuilderNode}
            type="button"
          >
            {t.templatePage.addWorkflowNode}
          </button>
        </div>
        <div className="template-builder-node-list">
          {builderNodes.map((node, index) => (
            <article className="template-builder-node" key={index}>
              <div className="template-builder-node-heading">
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <button
                  className="button-secondary"
                  disabled={builderNodes.length <= 1}
                  onClick={() => removeBuilderNode(index)}
                  type="button"
                >
                  {t.templatePage.removeWorkflowNode}
                </button>
              </div>
              <div className="template-builder-grid">
                <label>
                  {t.templatePage.builderNodeIdLabel}
                  <input
                    minLength={1}
                    onChange={(event) =>
                      updateBuilderNode(index, { id: event.target.value })
                    }
                    required
                    value={node.id}
                  />
                  <span className="form-helper template-builder-helper">
                    {t.templatePage.builderNodeIdHelp}
                  </span>
                </label>
                <label>
                  {t.templatePage.builderNodeTypeLabel}
                  <input
                    minLength={1}
                    onChange={(event) =>
                      updateBuilderNode(index, { type: event.target.value })
                    }
                    required
                    value={node.type}
                  />
                  <span className="form-helper template-builder-helper">
                    {t.templatePage.builderNodeTypeHelp}
                  </span>
                </label>
                <label>
                  {t.templatePage.builderSkillLabel}
                  <select
                    onChange={(event) =>
                      updateBuilderNode(index, { skillRef: event.target.value })
                    }
                    value={node.skillRef}
                  >
                    <option value="">{t.templatePage.builderNoSkill}</option>
                    {skills.map((skill) => (
                      <option key={skill.id} value={skill.ref}>
                        {skill.name}
                      </option>
                    ))}
                  </select>
                  <span className="form-helper template-builder-helper">
                    {t.templatePage.builderSkillHelp}
                  </span>
                </label>
                <label>
                  {t.templatePage.builderOutputLabel}
                  <input
                    minLength={1}
                    onChange={(event) =>
                      updateBuilderNode(index, { output: event.target.value })
                    }
                    required
                    value={node.output}
                  />
                  <span className="form-helper template-builder-helper">
                    {t.templatePage.builderOutputHelp}
                  </span>
                </label>
                <label>
                  {t.templatePage.builderRetriesLabel}
                  <input
                    min={0}
                    onChange={(event) =>
                      updateBuilderNode(index, {
                        maxRetries: Number(event.target.value)
                      })
                    }
                    required
                    type="number"
                    value={node.maxRetries}
                  />
                  <span className="form-helper template-builder-helper">
                    {t.templatePage.builderRetriesHelp}
                  </span>
                </label>
              </div>
            </article>
          ))}
        </div>
      </div>
      <button type="submit">{t.templatePage.createWorkflow}</button>
    </form>
  );

  const workflowImportForm = (
    <form className="stack-form" onSubmit={handleImportWorkflow}>
        <div
          className="template-import-modes template-import-modes-compact"
          aria-label={t.templatePage.importModeLabel}
        >
          <button
            aria-pressed={workflowImportMode === "source"}
            className="button-secondary"
            onClick={() => setWorkflowImportMode("source")}
            type="button"
          >
            {t.templatePage.importModeSource}
          </button>
          <button
            aria-pressed={workflowImportMode === "file"}
            className="button-secondary"
            onClick={() => setWorkflowImportMode("file")}
            type="button"
          >
            {t.templatePage.importModeFile}
          </button>
        </div>
      <label>
        {workflowImportMode === "file"
          ? t.templatePage.fileSourceLabel
          : t.setup.workflowSourceLabel}
        {workflowImportMode === "file" ? (
          <input
            accept=".wf,.yaml,.yml,text/yaml,text/plain"
            data-testid="workflow-file-input"
            onChange={handleWorkflowFileUpload}
            type="file"
          />
        ) : null}
        <textarea
          className="workflow-source-editor"
          data-testid="workflow-source-textarea"
          onChange={(event) => {
            setWorkflowImportMode("source");
            setWorkflowSource(event.target.value);
          }}
          required={workflowImportMode !== "file"}
          spellCheck={false}
          value={workflowSource}
        />
      </label>
      {workflowImportMode === "file" ? (
        <p className="form-helper">{t.templatePage.fileSourceHelp}</p>
      ) : null}
      <button type="submit">{t.setup.importWorkflowTemplate}</button>
    </form>
  );
  const requirementForm = (
    <form className="composer-form" onSubmit={handleCreateRequirement}>
      <label>
        {t.hero.nameLabel}
        <input
          data-testid="requirement-title-input"
          minLength={1}
          onChange={(event) => setRequirementTitle(event.target.value)}
          placeholder={t.hero.namePlaceholder}
          required
          value={requirementTitle}
        />
      </label>
      <label>
        {t.hero.bodyLabel}
        <textarea
          className="composer-textarea"
          data-testid="requirement-body-textarea"
          onChange={(event) => setRequirementBody(event.target.value)}
          placeholder={t.hero.bodyPlaceholder}
          required
          value={requirementBody}
        />
      </label>
      <div className="composer-actions">
        <p className="form-helper">
          {isModelConfigured
            ? t.workbench.defaultWorkflowHelp
            : t.workbench.modelRequiredHelp}
        </p>
        <button className="cat-action-button" type="submit">
          <CatActionIcon />
          <span>{t.hero.createRequirement}</span>
        </button>
      </div>
    </form>
  );
  const executorOptions = [
    {
      label: t.workspace.modelApiExecutorLabel,
      value: "model-api"
    },
    ...agentBindings.map((agent) => ({
      label: `${agent.name} · ${agent.connector}`,
      value: `agent-binding:${agent.id}`
    }))
  ];
  const activeDecompositionRequirement = decompositionDialog
    ? requirements.find(
        (requirement) => requirement.id === decompositionDialog.requirementId
      )
    : undefined;
  const activeRequirementActionRequirement = pendingRequirementAction
    ? requirements.find(
        (requirement) => requirement.id === pendingRequirementAction.requirementId
      )
    : undefined;
  const activeRequirementNameDialogRequirement =
    activePage !== "requirements" && editingRequirementId
      ? requirements.find((requirement) => requirement.id === editingRequirementId)
      : undefined;
  const activeClarificationRequirement = clarificationRequirementId
    ? requirements.find(
        (requirement) => requirement.id === clarificationRequirementId
      )
    : undefined;
  const activeClarificationPrompt = activeClarificationRequirement
    ? getRequirementClarificationPrompt(activeClarificationRequirement)
    : null;
  const selectedDecompositionExecutorLabel =
    executorOptions.find(
      (option) => option.value === selectedDecompositionExecutorValue
    )?.label ?? t.workspace.modelApiExecutorLabel;
  const activeWorkflowRunFile = workflowRunExecutorDialog
    ? workflowFiles.find(
        (workflowFile) => workflowFile.id === workflowRunExecutorDialog.workflowFileId
      )
    : null;
  const activeWorkflowRunTemplate = activeWorkflowRunFile
    ? parseWorkflowDefinition(activeWorkflowRunFile.definition)
    : null;
  const defaultWorkflowRunExecutorLabel =
    executorOptions.find(
      (option) => option.value === getProjectDefaultExecutorValue(selectedProject)
    )?.label ?? t.workspace.modelApiExecutorLabel;
  const activeWorkflowRunDetailTask = workflowRunDetailDialog
    ? tasks.find((task) => task.id === workflowRunDetailDialog.taskId)
    : undefined;
  const activeWorkflowRunDetail = workflowRunDetailDialog
    ? (workflowRunsByTaskId[workflowRunDetailDialog.taskId] ?? []).find(
        (run) => run.workflowRun.id === workflowRunDetailDialog.workflowRunId
      )
    : undefined;
  const activeWorkflowRunDetailFile = activeWorkflowRunDetail
    ? workflowFiles.find(
        (workflowFile) =>
          workflowFile.id === activeWorkflowRunDetail.workflowRun.workflowFileId
      )
    : undefined;
  const activeWorkflowRunDetailTemplate = activeWorkflowRunDetailFile
    ? parseWorkflowDefinition(activeWorkflowRunDetailFile.definition)
    : null;

  function renderWorkflowRunExecutorDialog() {
    if (!workflowRunExecutorDialog || !activeWorkflowRunTemplate) {
      return null;
    }

    return (
      <MotionModalBackdrop>
        <MotionModalPanel
          aria-labelledby="workflow-run-executor-dialog-title"
          aria-modal="true"
          className="modal-panel decomposition-dialog"
          role="dialog"
        >
          <div className="modal-heading-row">
            <div>
              <p className="eyebrow">{t.workspace.taskBoardEyebrow}</p>
              <h2 id="workflow-run-executor-dialog-title">
                {t.workspace.chooseWorkflowRunExecutors}
              </h2>
              <p>{t.workspace.chooseWorkflowRunExecutorsHelp}</p>
            </div>
            <button
              className="button-secondary modal-close"
              onClick={() => setWorkflowRunExecutorDialog(null)}
              type="button"
            >
              {t.workspace.cancelRequirementEdit}
            </button>
          </div>
          <form
            className="decomposition-start-form"
            onSubmit={handleStartTaskWorkflowRun}
          >
              <p className="form-helper">
                {t.workspace.useDefaultExecutor}: {defaultWorkflowRunExecutorLabel}
              </p>
              {workflowRunExecutorError ? (
                <p className="form-error" role="alert">
                  {workflowRunExecutorError}
                </p>
              ) : null}
              {activeWorkflowRunTemplate.nodes.map((node) => (
                <label key={node.id}>
                  {t.workspace.workflowNodeExecutorLabel}: {node.id}
                <select
                  onChange={(event) =>
                    setWorkflowRunExecutorDialog((currentDialog) =>
                      currentDialog
                        ? {
                            ...currentDialog,
                            assignments: {
                              ...currentDialog.assignments,
                              [node.id]: event.target.value
                            }
                          }
                        : currentDialog
                    )
                  }
                  onInput={() => setWorkflowRunExecutorError("")}
                  value={
                    workflowRunExecutorDialog.assignments[node.id] ??
                    getProjectDefaultExecutorValue(selectedProject)
                  }
                >
                  {executorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <div className="decomposition-dialog-actions">
              <button type="submit">{t.workspace.startRun}</button>
            </div>
          </form>
        </MotionModalPanel>
      </MotionModalBackdrop>
    );
  }

  function renderWorkflowRunDetailDialog() {
    if (!workflowRunDetailDialog || !activeWorkflowRunDetail) {
      return null;
    }

    const orderedNodeRuns = getOrderedNodeRuns(activeWorkflowRunDetail);
    const progress = getWorkflowRunProgress(
      activeWorkflowRunDetail,
      activeWorkflowRunDetailTemplate
    );
    const templateNodesById = new Map(
      activeWorkflowRunDetailTemplate?.nodes.map((node) => [node.id, node]) ?? []
    );

    return (
      <MotionModalBackdrop>
        <MotionModalPanel
          aria-labelledby="workflow-run-detail-dialog-title"
          aria-modal="true"
          className="modal-panel workflow-run-detail-modal"
          role="dialog"
        >
          <div className="modal-heading-row workflow-run-detail-header">
            <div>
              <p className="eyebrow">{t.workspace.workflowRun}</p>
              <h2 id="workflow-run-detail-dialog-title">
                {t.workspace.workflowRunDetailsTitle}
              </h2>
              <p>
                {activeWorkflowRunDetailTask?.title ??
                  activeWorkflowRunDetail.workflowRun.taskId}
              </p>
            </div>
            <button
              className="button-secondary modal-close"
              onClick={() => setWorkflowRunDetailDialog(null)}
              type="button"
            >
              {t.workbench.close}
            </button>
          </div>

          <div className="workflow-run-detail-body">
            <div className="workflow-run-detail-summary">
            <div>
              <span>{t.workspace.workflowRunProgressLabel}</span>
              <strong>
                {progress.current > 0 && progress.total > 0
                  ? t.workspace.workflowRunCurrentNode(
                      progress.current,
                      progress.total
                    )
                  : t.workspace.workflowRunProgressUnknown}
              </strong>
            </div>
            <div>
              <span>{t.workspace.workflowRunTemplateLabel}</span>
              <strong>
                {activeWorkflowRunDetailFile
                  ? getWorkflowTemplateDisplayName(t, activeWorkflowRunDetailFile)
                  : activeWorkflowRunDetail.workflowRun.workflowFileId}
              </strong>
            </div>
            <StatusBadge
              tone={getNodeRunTone(activeWorkflowRunDetail.workflowRun.status)}
            >
              {activeWorkflowRunDetail.workflowRun.status}
            </StatusBadge>
            </div>

            <div className="workflow-run-detail-node-list">
            {orderedNodeRuns.map((nodeRun, index) => {
              const nodeDefinition = templateNodesById.get(nodeRun.nodeId);
              const dependencies =
                nodeDefinition?.dependsOn.length
                  ? nodeDefinition.dependsOn
                  : nodeRun.dependsOn;
              const dependencySummaries = dependencies.map((dependencyId) => {
                const dependencyRun = orderedNodeRuns.find(
                  (candidate) => candidate.nodeId === dependencyId
                );

                return dependencyRun
                  ? `${dependencyId} · ${dependencyRun.status}`
                  : dependencyId;
              });
              const inputs = nodeDefinition?.inputs ?? [];
              const outputs =
                nodeDefinition?.outputs.map(getWorkflowNodeOutputLabel) ?? [];
              const uses = nodeDefinition?.uses ?? [];
              const criteria = nodeDefinition?.exit.criteria ?? [];
              const instructionText =
                nodeDefinition?.instruction?.text ??
                nodeDefinition?.instruction?.ref ??
                "";

              return (
                <article
                  className={`workflow-run-detail-node ${
                    progress.focusNodeRun?.id === nodeRun.id
                      ? "workflow-run-detail-node-active"
                      : ""
                  }`}
                  key={nodeRun.id}
                >
                  <div className="workflow-run-detail-node-header">
                    <div className="workflow-run-detail-node-title">
                      <span className="workflow-run-detail-node-index">
                        {index + 1}
                      </span>
                      <h3>{nodeRun.nodeId}</h3>
                    </div>
                    <div className="workflow-run-detail-node-status">
                      <StatusBadge tone={getNodeRunTone(nodeRun.status)}>
                        {nodeRun.status}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="workflow-run-detail-grid">
                    <section>
                      <h4>{t.workspace.workflowRunInputsLabel}</h4>
                      <p>
                        {inputs.length > 0
                          ? inputs.join(", ")
                          : t.workspace.workflowRunNoNodeMetadata}
                      </p>
                    </section>
                    <section>
                      <h4>{t.workspace.workflowRunOutputsLabel}</h4>
                      <p>
                        {outputs.length > 0
                          ? outputs.join(", ")
                          : t.workspace.workflowRunNoNodeMetadata}
                      </p>
                    </section>
                    <section>
                      <h4>{t.workspace.workflowRunDependsOnLabel}</h4>
                      <p>
                        {dependencySummaries.length > 0
                          ? dependencySummaries.join(", ")
                          : t.workspace.noDependency}
                      </p>
                    </section>
                    <section>
                      <h4>{t.workspace.workflowRunUsesLabel}</h4>
                      <p>
                        {uses.length > 0
                          ? uses.join(", ")
                          : t.workspace.workflowRunNoNodeMetadata}
                      </p>
                    </section>
                  </div>

                  {instructionText || criteria.length > 0 ? (
                    <div className="workflow-run-detail-definition">
                      {instructionText ? (
                        <section>
                          <h4>{t.workspace.workflowRunInstructionLabel}</h4>
                          <p>{instructionText}</p>
                        </section>
                      ) : null}
                      {criteria.length > 0 ? (
                        <section>
                          <h4>{t.workspace.workflowRunExitCriteriaLabel}</h4>
                          <ul>
                            {criteria.map((criterion) => (
                              <li key={criterion}>{criterion}</li>
                            ))}
                          </ul>
                        </section>
                      ) : null}
                    </div>
                  ) : null}

                  <section className="workflow-run-detail-trace">
                    <h4>{t.workspace.workflowRunProcessLabel}</h4>
                    <dl>
                      <div>
                        <dt>{t.workspace.workflowRunNodeRunIdLabel}</dt>
                        <dd>{nodeRun.id}</dd>
                      </div>
                      <div>
                        <dt>{t.workspace.workflowRunUpdatedAtLabel}</dt>
                        <dd>{formatManagementTimestamp(nodeRun.updatedAt)}</dd>
                      </div>
                    </dl>
                    {nodeRun.errorMessage ? (
                      <div className="workflow-run-detail-trace-block workflow-run-detail-trace-error">
                        <strong>{t.workspace.workflowRunErrorLabel}</strong>
                        <pre>{nodeRun.errorMessage}</pre>
                      </div>
                    ) : null}
                    {nodeRun.output ? (
                      <div className="workflow-run-detail-trace-block">
                        <strong>{t.workspace.workflowRunOutputLabel}</strong>
                        <pre>{nodeRun.output}</pre>
                      </div>
                    ) : null}
                    {!nodeRun.errorMessage && !nodeRun.output ? (
                      <p>{getWorkflowRunNoProcessDetailsMessage(nodeRun, t)}</p>
                    ) : null}
                    {nodeRun.status === "failed" ? (
                      <div className="workflow-run-detail-retry-panel">
                        <div>
                          <strong>{t.workspace.retryWorkflowNodeTitle}</strong>
                          <p>{t.workspace.retryWorkflowNodeHelp}</p>
                        </div>
                        <button
                          className="button-secondary workflow-run-retry-button"
                          disabled={retryingNodeRunIds.has(nodeRun.id)}
                          onClick={() =>
                            void handleRetryTaskWorkflowNodeRun(
                              activeWorkflowRunDetail.workflowRun.taskId,
                              activeWorkflowRunDetail.workflowRun.id,
                              nodeRun.id
                            )
                          }
                          type="button"
                        >
                          {retryingNodeRunIds.has(nodeRun.id)
                            ? t.workspace.retryingWorkflowNode
                            : t.workspace.retryWorkflowNode}
                        </button>
                      </div>
                    ) : null}
                  </section>
                </article>
              );
            })}
            </div>
          </div>
        </MotionModalPanel>
      </MotionModalBackdrop>
    );
  }

  function renderDecompositionDialog() {
    if (!decompositionDialog || !activeDecompositionRequirement) {
      return null;
    }

    return (
      <MotionModalBackdrop>
        <MotionModalPanel
          aria-labelledby="decomposition-dialog-title"
          aria-modal="true"
          className="modal-panel decomposition-dialog"
          role="dialog"
        >
          <div className="modal-heading-row">
            <div>
              <p className="eyebrow">{t.workspace.requirementsEyebrow}</p>
              <h2 id="decomposition-dialog-title">
                {decompositionDialog.mode === "select"
                  ? t.workspace.chooseDecompositionExecutor
                  : t.workspace.decompositionRunningTitle}
              </h2>
              <p>{activeDecompositionRequirement.title}</p>
            </div>
            <button
              className="button-secondary modal-close"
              onClick={() => setDecompositionDialog(null)}
              type="button"
            >
              {t.workspace.cancelRequirementEdit}
            </button>
          </div>

          {decompositionDialog.mode === "select" ? (
            <form
              className="decomposition-start-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateDecompositionResult(
                  activeDecompositionRequirement.id
                );
              }}
            >
              <label>
                {t.workspace.executorLabel}
                <select
                  onChange={(event) =>
                    setSelectedDecompositionExecutorValue(event.target.value)
                  }
                  value={selectedDecompositionExecutorValue}
                >
                  {executorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="form-helper">
                {t.workspace.chooseDecompositionExecutorHelp}
              </p>
              <div className="decomposition-dialog-actions">
                <button type="submit">{t.workspace.startDecomposition}</button>
              </div>
            </form>
          ) : (
            <div className="decomposition-running-panel">
              <div>
                <StatusBadge tone="info">
                  {getRequirementStatusLabel(t, "decomposing")}
                </StatusBadge>
                <strong>
                  {decompositionDialog.executorLabel ||
                    selectedDecompositionExecutorLabel}
                </strong>
              </div>
              <p>{t.workspace.decompositionRunningHelp}</p>
              <span>
                {t.workspace.decompositionEstimatedTime(
                  decompositionDialog.estimatedSeconds
                )}
              </span>
            </div>
          )}
        </MotionModalPanel>
      </MotionModalBackdrop>
    );
  }

  function renderRequirementActionDialog() {
    if (!pendingRequirementAction || !activeRequirementActionRequirement) {
      return null;
    }

    const isReset = pendingRequirementAction.kind === "reset";

    return (
      <MotionModalBackdrop
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setPendingRequirementAction(null);
          }
        }}
      >
        <MotionModalPanel
          aria-labelledby="requirement-action-dialog-title"
          aria-modal="true"
          className="modal-panel requirement-action-dialog"
          role="dialog"
        >
          <div className="modal-heading-row">
            <div>
              <p className="eyebrow">{t.workspace.requirementsEyebrow}</p>
              <h2 id="requirement-action-dialog-title">
                {isReset
                  ? t.workspace.resetRequirementConfirmTitle
                  : t.workspace.deleteRequirementConfirmTitle}
              </h2>
              <p>
                {isReset
                  ? t.workspace.resetRequirementConfirmBody
                  : t.workspace.deleteRequirementConfirmBody}
              </p>
            </div>
            <button
              className="button-secondary modal-close"
              onClick={() => setPendingRequirementAction(null)}
              type="button"
            >
              {t.workspace.cancelRequirementAction}
            </button>
          </div>
          <div className="requirement-action-summary">
            <strong>{activeRequirementActionRequirement.title}</strong>
            <span>{activeRequirementActionRequirement.body}</span>
          </div>
          <div className="decomposition-dialog-actions">
            <button
              className={isReset ? "button-secondary" : "button-danger"}
              onClick={() => {
                void (isReset
                  ? handleResetRequirement(activeRequirementActionRequirement.id)
                  : handleDeleteRequirement(activeRequirementActionRequirement.id));
              }}
              type="button"
            >
              {isReset
                ? t.workspace.confirmRequirementReset
                : t.workspace.deleteRequirementAction}
            </button>
          </div>
        </MotionModalPanel>
      </MotionModalBackdrop>
    );
  }

  function renderRequirementNameDialog() {
    if (!activeRequirementNameDialogRequirement) {
      return null;
    }

    return (
      <MotionModalBackdrop
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setEditedRequirementTitles((currentTitles) => ({
              ...currentTitles,
              [activeRequirementNameDialogRequirement.id]:
                activeRequirementNameDialogRequirement.title
            }));
            setEditedRequirementBodies((currentBodies) => ({
              ...currentBodies,
              [activeRequirementNameDialogRequirement.id]:
                activeRequirementNameDialogRequirement.body
            }));
            setEditingRequirementId("");
          }
        }}
      >
        <MotionModalPanel
          aria-labelledby="requirement-name-dialog-title"
          aria-modal="true"
          className="modal-panel requirement-name-dialog"
          role="dialog"
        >
          <div className="modal-heading-row">
            <div>
              <p className="eyebrow">{t.workspace.requirementsEyebrow}</p>
              <h2 id="requirement-name-dialog-title">
                {t.workspace.editRequirement}
              </h2>
              <p>{t.workspace.requirementRenameHelp}</p>
            </div>
            <button
              className="button-secondary modal-close"
              onClick={() => {
                setEditedRequirementTitles((currentTitles) => ({
                  ...currentTitles,
                  [activeRequirementNameDialogRequirement.id]:
                    activeRequirementNameDialogRequirement.title
                }));
                setEditedRequirementBodies((currentBodies) => ({
                  ...currentBodies,
                  [activeRequirementNameDialogRequirement.id]:
                    activeRequirementNameDialogRequirement.body
                }));
                setEditingRequirementId("");
              }}
              type="button"
            >
              {t.workspace.cancelRequirementEdit}
            </button>
          </div>
          <form
            className="requirement-name-form"
            onSubmit={(event) =>
              handleUpdateRequirement(
                event,
                activeRequirementNameDialogRequirement.id
              )
            }
          >
            <label>
              {t.workspace.requirementNameLabel}
              <input
                aria-label={`${t.workspace.editRequirement} ${activeRequirementNameDialogRequirement.title}`}
                minLength={1}
                onChange={(event) =>
                  setEditedRequirementTitles((currentTitles) => ({
                    ...currentTitles,
                    [activeRequirementNameDialogRequirement.id]:
                      event.target.value
                  }))
                }
                required
                value={
                  editedRequirementTitles[
                    activeRequirementNameDialogRequirement.id
                  ] ?? activeRequirementNameDialogRequirement.title
                }
              />
            </label>
            <label>
              {t.workspace.requirementBodyLabel}
              <textarea
                aria-label={`${t.workspace.requirementBodyLabel} ${activeRequirementNameDialogRequirement.title}`}
                minLength={1}
                onChange={(event) =>
                  setEditedRequirementBodies((currentBodies) => ({
                    ...currentBodies,
                    [activeRequirementNameDialogRequirement.id]:
                      event.target.value
                  }))
                }
                required
                rows={6}
                value={
                  editedRequirementBodies[
                    activeRequirementNameDialogRequirement.id
                  ] ?? activeRequirementNameDialogRequirement.body
                }
              />
            </label>
            <p className="form-helper">{t.workspace.requirementBodyHelp}</p>
            <div className="decomposition-dialog-actions">
              <button type="submit">{t.workspace.saveRequirement}</button>
            </div>
          </form>
        </MotionModalPanel>
      </MotionModalBackdrop>
    );
  }

  function renderClarificationDialog() {
    if (!activeClarificationRequirement || !activeClarificationPrompt) {
      return null;
    }

    return (
      <MotionModalBackdrop
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            closeClarificationDialog();
          }
        }}
      >
        <MotionModalPanel
          aria-labelledby="clarification-dialog-title"
          aria-modal="true"
          className="modal-panel clarification-dialog"
          role="dialog"
        >
          <div className="modal-heading-row">
            <div>
              <p className="eyebrow">{t.workspace.requirementsEyebrow}</p>
              <h2 id="clarification-dialog-title">
                {t.workspace.clarificationDialogTitle}
              </h2>
              <p>{t.workspace.clarificationDialogHelp}</p>
            </div>
            <button
              className="button-secondary modal-close"
              onClick={closeClarificationDialog}
              type="button"
            >
              {t.workspace.cancelRequirementEdit}
            </button>
          </div>
          <div className="clarification-question-panel">
            {activeClarificationPrompt.summary ? (
              <p>{activeClarificationPrompt.summary}</p>
            ) : null}
            <strong>{t.workspace.clarificationQuestionsLabel}</strong>
            <ul>
              {activeClarificationPrompt.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
          <form
            className="clarification-answer-form"
            onSubmit={handleSaveClarificationAnswer}
          >
            <label>
              {t.workspace.clarificationAnswerLabel}
              <textarea
                minLength={1}
                onChange={(event) =>
                  setClarificationAnswers((currentAnswers) => ({
                    ...currentAnswers,
                    [activeClarificationRequirement.id]: event.target.value
                  }))
                }
                required
                rows={6}
                value={
                  clarificationAnswers[activeClarificationRequirement.id] ?? ""
                }
              />
            </label>
            <p className="form-helper">
              {t.workspace.clarificationAnswerHelp}
            </p>
            <div className="decomposition-dialog-actions">
              <button type="submit">
                {t.workspace.saveClarificationAnswer}
              </button>
            </div>
          </form>
        </MotionModalPanel>
      </MotionModalBackdrop>
    );
  }

  function getRequirementProjectName(requirement: Requirement) {
    return (
      projects.find((project) => project.id === requirement.projectId)?.name ??
      t.workspace.unknownProject
    );
  }

  function getRequirementNextActionLabel(
    requirement: Requirement,
    linkedTasks: Task[],
    decompositionResult?: DecompositionResult
  ) {
    if (requirement.status === "completed") {
      return t.workspace.nextActionDone;
    }
    if (getRequirementClarificationPrompt(requirement)) {
      return t.workspace.nextActionAnswerClarification;
    }
    if (requirement.status === "decomposition_failed") {
      return t.workspace.nextActionResolveError;
    }
    if (requirement.status === "decomposing") {
      return t.workspace.nextActionDecomposing;
    }
    if (
      requirement.status === "ready_to_generate_tasks" &&
      decompositionResult &&
      linkedTasks.length === 0
    ) {
      return t.workspace.nextActionGenerateTasks;
    }
    if (linkedTasks.length > 0 || requirement.status === "tasks_generated") {
      return t.workspace.nextActionTrackTasks;
    }

    return t.workspace.nextActionPlan;
  }

  function renderRequirementManagementDetails(
    requirement: Requirement,
    linkedTasks: Task[],
    decompositionResult?: DecompositionResult
  ) {
    return (
      <div className="requirement-management-details">
        <dl className="requirement-management-summary">
          <div>
            <dt>{t.workspace.requirementProjectLabel}</dt>
            <dd>{getRequirementProjectName(requirement)}</dd>
          </div>
          <div>
            <dt>{t.workspace.requirementCreatedLabel}</dt>
            <dd>{formatManagementTimestamp(requirement.createdAt)}</dd>
          </div>
          <div>
            <dt>{t.workspace.requirementUpdatedLabel}</dt>
            <dd>{formatManagementTimestamp(requirement.updatedAt)}</dd>
          </div>
        </dl>
        <dl className="requirement-management-metrics">
          <div>
            <dt>{t.workspace.decompositionItemsLabel}</dt>
            <dd>
              {decompositionResult
                ? t.workspace.itemsCount(decompositionResult.items.length)
                : t.workspace.noDecompositionItems}
            </dd>
          </div>
          <div>
            <dt>{t.workspace.linkedTasksLabel}</dt>
            <dd>{t.workspace.tasksCount(linkedTasks.length)}</dd>
          </div>
          <div>
            <dt>{t.workspace.nextActionLabel}</dt>
            <dd>
              {getRequirementNextActionLabel(
                requirement,
                linkedTasks,
                decompositionResult
              )}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  function renderDecompositionResultEditor(
    decompositionResult: DecompositionResult
  ) {
    const editedItems =
      editedDecompositionItems[decompositionResult.id] ??
      createEditableDecompositionItems(decompositionResult);

    return (
      <form
        className="decomposition-editor"
        onSubmit={(event) =>
          handleSaveDecompositionResult(event, decompositionResult)
        }
      >
        <div className="decomposition-editor-header">
          <div>
            <strong>{t.workspace.decompositionResultTitle}</strong>
            <span>{t.workspace.decompositionResultHelp}</span>
          </div>
          <button className="button-secondary" type="submit">
            {t.workspace.saveDecompositionResult}
          </button>
        </div>
        <label className="decomposition-summary-field">
          {t.workspace.decompositionSummaryLabel}
          <textarea
            onChange={(event) =>
              setEditedDecompositionSummaries((currentSummaries) => ({
                ...currentSummaries,
                [decompositionResult.id]: event.target.value
              }))
            }
            rows={2}
            value={
              editedDecompositionSummaries[decompositionResult.id] ??
              decompositionResult.summary
            }
          />
        </label>
        <div className="decomposition-item-list">
          {editedItems.map((item, index) => (
            <fieldset className="decomposition-item-editor" key={index}>
              <legend>
                {t.workspace.decompositionItemLabel} {index + 1}
              </legend>
              <label className="decomposition-item-title-field">
                {t.workspace.decompositionItemTitleLabel}
                <input
                  minLength={1}
                  onChange={(event) =>
                    setEditedDecompositionItems((currentItems) => {
                      const nextItems = [
                        ...(currentItems[decompositionResult.id] ?? editedItems)
                      ];
                      nextItems[index] = {
                        ...nextItems[index]!,
                        title: event.target.value
                      };

                      return {
                        ...currentItems,
                        [decompositionResult.id]: nextItems
                      };
                    })
                  }
                  required
                  value={item.title}
                />
              </label>
              <label className="decomposition-item-body-field">
                {t.workspace.decompositionItemBodyLabel}
                <textarea
                  minLength={1}
                  onChange={(event) =>
                    setEditedDecompositionItems((currentItems) => {
                      const nextItems = [
                        ...(currentItems[decompositionResult.id] ?? editedItems)
                      ];
                      nextItems[index] = {
                        ...nextItems[index]!,
                        body: event.target.value
                      };

                      return {
                        ...currentItems,
                        [decompositionResult.id]: nextItems
                      };
                    })
                  }
                  required
                  rows={3}
                  value={item.body}
                />
              </label>
              <label className="decomposition-item-dependency-field">
                {t.workspace.decompositionItemDependenciesLabel}
                <select
                  multiple
                  onChange={(event) =>
                    setEditedDecompositionItems((currentItems) => {
                      const nextItems = [
                        ...(currentItems[decompositionResult.id] ?? editedItems)
                      ];
                      nextItems[index] = {
                        ...nextItems[index]!,
                        dependsOn: Array.from(
                          event.target.selectedOptions,
                          (option) => option.value
                        )
                      };

                      return {
                        ...currentItems,
                        [decompositionResult.id]: nextItems
                      };
                    })
                  }
                  value={item.dependsOn}
                >
                  {editedItems
                    .filter((candidate) => candidate.id !== item.id)
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.title}
                      </option>
                    ))}
                </select>
                <span className="form-helper">
                  {t.workspace.decompositionItemDependenciesHelp}
                </span>
              </label>
              <label className="decomposition-item-executor-field">
                {t.workspace.executorLabel}
                <select
                  onChange={(event) =>
                    setEditedDecompositionItems((currentItems) => {
                      const nextItems = [
                        ...(currentItems[decompositionResult.id] ?? editedItems)
                      ];
                      const value = event.target.value;
                      const agentBindingId = value.startsWith("agent-binding:")
                        ? value.replace("agent-binding:", "")
                        : null;
                      const agent = agentBindings.find(
                        (binding) => binding.id === agentBindingId
                      );
                      nextItems[index] = {
                        ...nextItems[index]!,
                        executorAgentBindingId: agentBindingId,
                        executorLabel: agent?.name ?? t.workspace.modelApiExecutorLabel,
                        executorType: agentBindingId ? "agent-binding" : "model-api"
                      };

                      return {
                        ...currentItems,
                        [decompositionResult.id]: nextItems
                      };
                    })
                  }
                  value={getExecutorOptionValue(
                    item.executorType,
                    item.executorAgentBindingId
                  )}
                >
                  {executorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          ))}
        </div>
      </form>
    );
  }

  function renderRequirementActionsMenu(requirement: Requirement) {
    return (
      <details className="requirement-actions-menu">
        <summary
          aria-label={t.workspace.moreRequirementActions}
          title={t.workspace.moreRequirementActions}
        >
          ...
        </summary>
        <div className="requirement-actions-menu-panel" role="menu">
          <button
            className="button-secondary"
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              setPendingRequirementAction({
                kind: "reset",
                requirementId: requirement.id
              });
            }}
            role="menuitem"
            title={t.workspace.resetRequirementConfirmTitle}
            type="button"
          >
            {t.workspace.resetRequirement}
          </button>
          <button
            className="button-danger"
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              setPendingRequirementAction({
                kind: "delete",
                requirementId: requirement.id
              });
            }}
            role="menuitem"
            title={t.workspace.deleteRequirementConfirmTitle}
            type="button"
          >
            {t.workspace.deleteRequirementAction}
          </button>
        </div>
      </details>
    );
  }

  const editableRequirementList =
    projectRequirements.length === 0 ? (
      <MascotEmptyState
        body={t.workspace.allRequirementsBody}
        title={t.workspace.noRequirements}
        variant="guide"
      />
    ) : (
      <div className="requirements-management-list">
        {projectRequirements.map((requirement) => {
          const isEditingRequirement = editingRequirementId === requirement.id;
          const linkedTasks = projectTasks.filter(
            (task) => task.requirementId === requirement.id
          );
          const canPlanRequirement =
            canPlanRequirementStatus(requirement.status) &&
            linkedTasks.length === 0;
          const canViewDecompositionProgress =
            requirement.status === "decomposing" && linkedTasks.length === 0;
          const decompositionResult = decompositionResultByRequirementId.get(
            requirement.id
          );
          const clarificationPrompt =
            getRequirementClarificationPrompt(requirement);
          const canGenerateTasks =
            requirement.status === "ready_to_generate_tasks" &&
            decompositionResult !== undefined &&
            linkedTasks.length === 0;

          return (
            <article className="requirement-management-row" key={requirement.id}>
              {isEditingRequirement ? (
                <form
                  className="requirement-rename-form"
                  onSubmit={(event) =>
                    handleUpdateRequirement(event, requirement.id)
                  }
                >
                  <label>
                    {t.workspace.requirementNameLabel}
                    <input
                      aria-label={`${t.workspace.renameRequirement} ${requirement.title}`}
                      minLength={1}
                      onChange={(event) =>
                        setEditedRequirementTitles((currentTitles) => ({
                          ...currentTitles,
                          [requirement.id]: event.target.value
                        }))
                      }
                      required
                      value={
                        editedRequirementTitles[requirement.id] ??
                        requirement.title
                      }
                    />
                  </label>
                  <label>
                    {t.workspace.requirementBodyLabel}
                    <textarea
                      aria-label={`${t.workspace.requirementBodyLabel} ${requirement.title}`}
                      minLength={1}
                      onChange={(event) =>
                        setEditedRequirementBodies((currentBodies) => ({
                          ...currentBodies,
                          [requirement.id]: event.target.value
                        }))
                      }
                      required
                      rows={5}
                      value={
                        editedRequirementBodies[requirement.id] ??
                        requirement.body
                      }
                    />
                  </label>
                  <div className="requirement-row-meta">
                    <StatusBadge tone={getNodeRunTone(requirement.status)}>
                      {getRequirementStatusLabel(t, requirement.status)}
                    </StatusBadge>
                    <span>{requirement.errorMessage ?? requirement.body}</span>
                  </div>
                  <p className="form-helper">{t.workspace.requirementRenameHelp}</p>
                  <p className="form-helper">{t.workspace.requirementBodyHelp}</p>
                  {renderRequirementManagementDetails(
                    requirement,
                    linkedTasks,
                    decompositionResult
                  )}
                  <div className="requirement-row-actions">
                    {clarificationPrompt ? (
                      <button
                        className="button-secondary"
                        onClick={() => openClarificationDialog(requirement)}
                        type="button"
                      >
                        {t.workspace.answerClarification}
                      </button>
                    ) : canPlanRequirement ? (
                      <button
                        className="button-secondary"
                        onClick={() => openDecompositionDialog(requirement)}
                        type="button"
                      >
                        {t.workspace.planRequirement}
                      </button>
                    ) : null}
                    {canViewDecompositionProgress ? (
                      <button
                        className="button-secondary"
                        onClick={() => openDecompositionDialog(requirement)}
                        type="button"
                      >
                        {t.workspace.continueDecomposition}
                      </button>
                    ) : null}
                    {canGenerateTasks ? (
                      <button
                        className="button-secondary"
                        onClick={() =>
                          handleGenerateTasksFromDecompositionResult(
                            decompositionResult.id
                          )
                        }
                        type="button"
                      >
                        {t.workspace.generateTasks}
                      </button>
                    ) : null}
                    <button type="submit">{t.workspace.saveRequirement}</button>
                    <button
                      className="button-secondary"
                      onClick={() => {
                        setEditedRequirementTitles((currentTitles) => ({
                          ...currentTitles,
                          [requirement.id]: requirement.title
                        }));
                        setEditedRequirementBodies((currentBodies) => ({
                          ...currentBodies,
                          [requirement.id]: requirement.body
                        }));
                        setEditingRequirementId("");
                      }}
                      type="button"
                    >
                      {t.workspace.cancelRequirementEdit}
                    </button>
                    {renderRequirementActionsMenu(requirement)}
                  </div>
                </form>
              ) : (
                <>
                  <div className="record-header">
                    <div>
                      <h3>{requirement.title}</h3>
                      <p>{requirement.errorMessage ?? requirement.body}</p>
                    </div>
                    <StatusBadge tone={getNodeRunTone(requirement.status)}>
                      {getRequirementStatusLabel(t, requirement.status)}
                    </StatusBadge>
                  </div>
                  {renderRequirementManagementDetails(
                    requirement,
                    linkedTasks,
                    decompositionResult
                  )}
                  {canGenerateTasks && decompositionResult
                    ? renderDecompositionResultEditor(decompositionResult)
                    : null}
                  <div className="requirement-row-actions">
                    {clarificationPrompt ? (
                      <button
                        className="button-secondary"
                        aria-label={t.workspace.answerClarificationAriaLabel(
                          requirement.title
                        )}
                        onClick={() => openClarificationDialog(requirement)}
                        type="button"
                      >
                        {t.workspace.answerClarification}
                      </button>
                    ) : canPlanRequirement ? (
                      <button
                        className="button-secondary"
                        onClick={() => openDecompositionDialog(requirement)}
                        type="button"
                      >
                        {t.workspace.planRequirement}
                      </button>
                    ) : null}
                    {canViewDecompositionProgress ? (
                      <button
                        className="button-secondary"
                        onClick={() => openDecompositionDialog(requirement)}
                        type="button"
                      >
                        {t.workspace.continueDecomposition}
                      </button>
                    ) : null}
                    {canGenerateTasks ? (
                      <button
                        className="button-secondary"
                        onClick={() =>
                          handleGenerateTasksFromDecompositionResult(
                            decompositionResult.id
                          )
                        }
                        type="button"
                      >
                        {t.workspace.generateTasks}
                      </button>
                    ) : null}
                    <button
                      className="button-secondary"
                      onClick={() => {
                        setEditedRequirementTitles((currentTitles) => ({
                          ...currentTitles,
                          [requirement.id]: requirement.title
                        }));
                        setEditedRequirementBodies((currentBodies) => ({
                          ...currentBodies,
                          [requirement.id]: requirement.body
                        }));
                        setEditingRequirementId(requirement.id);
                      }}
                      type="button"
                    >
                      {t.workspace.editRequirement}
                    </button>
                    {renderRequirementActionsMenu(requirement)}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    );
  const primaryNavItems: { label: string; page: ActivePage }[] = [
    { label: t.nav.controlRoom, page: "control-room" },
    { label: t.nav.requirements, page: "requirements" },
    { label: t.nav.workflowTemplates, page: "workflow-templates" }
  ];

  return (
    <MotionShell>
      <AnimatePresence>
        {renderDecompositionDialog()}
        {renderRequirementActionDialog()}
        {renderClarificationDialog()}
        {renderRequirementNameDialog()}
        {renderWorkflowRunExecutorDialog()}
        {renderWorkflowRunDetailDialog()}
      </AnimatePresence>
      <header className="studio-hero">
        <nav className="studio-nav" aria-label={t.nav.statusLabel}>
          <a className="brand-lockup" aria-label={t.nav.controlRoom} href="/">
            <img
              alt={t.nav.brandAlt}
              className="brand-logo"
              height="56"
              src="/brand/forge-cat-logo-256.png"
              width="56"
            />
            <div>
              <h1>{t.nav.appLabel}</h1>
              <p className="brand-tagline">{t.hero.title}</p>
            </div>
          </a>
          <div className="nav-actions">
            <div className="project-switcher" aria-label={t.workbench.currentProject}>
              <span className="project-switcher-label">
                {t.workbench.currentProject}
              </span>
              <div className="project-switcher-control">
                <button
                  aria-label={t.workbench.newProject}
                  className="project-create-button"
                  onClick={() => {
                    handleNavigatePage("control-room");
                    setActiveWorkbenchAction("project");
                  }}
                  title={t.workbench.newProject}
                  type="button"
                >
                  <span aria-hidden="true" className="project-create-icon">
                    +
                  </span>
                </button>
                <select
                  aria-label={t.workbench.currentProject}
                  data-testid="project-switcher-select"
                  disabled={projects.length === 0}
                  onChange={(event) => handleSelectProject(event.target.value)}
                  value={selectedProjectId}
                >
                  {projects.length === 0 ? (
                    <option value="">{t.workbench.noActiveProject}</option>
                  ) : null}
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="page-nav">
              {primaryNavItems.map((item) => (
                <button
                  aria-current={activePage === item.page ? "page" : undefined}
                  className="button-secondary nav-button"
                  key={item.page}
                  onClick={() => handleNavigatePage(item.page)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              aria-current={activePage === "settings" ? "page" : undefined}
              aria-label={t.nav.settings}
              className="button-secondary settings-icon-button"
              onClick={() => handleNavigatePage("settings")}
              title={t.nav.settings}
              type="button"
            >
              <SettingsGearIcon />
            </button>
          </div>
        </nav>

        {showModelConfigurationStatus ? (
          <button
            aria-live="polite"
            className="persistent-status-bar persistent-status-bar-danger"
            onClick={() => {
              handleNavigatePage("settings");
              setActiveSettingsSection("model");
            }}
            type="button"
          >
            <MascotCue className="mascot-cue-alert" variant="blocked" />
            <span>{t.status.modelNotConfigured}</span>
            <strong>{t.nav.settings}</strong>
          </button>
        ) : null}

        {activePage === "control-room" ? (
          <section
            className={`workbench-panel ${
              hasProjects ? "workbench-ready" : "workbench-empty"
            }`}
            aria-labelledby="workbench-heading"
          >
            <div className="workbench-copy">
              <p className="studio-label">{t.workbench.eyebrow}</p>
              <h2 id="workbench-heading">{workbenchTitle}</h2>
              <p>{workbenchBody}</p>
            </div>

            {hasProjects ? (
              <section className="quick-actions-panel">
                <div className="section-heading">
                  <p className="studio-label">{t.workbench.nextActions}</p>
                  <h3>{t.workbench.quickActionsHeading}</h3>
                </div>
                <div className="quick-action-list">
                  <button
                    className="quick-action"
                    onClick={() => setActiveWorkbenchAction("requirement")}
                    type="button"
                  >
                    <span className="quick-action-mark">
                      <CatActionIcon />
                    </span>
                    <span className="quick-action-copy">
                      <strong>{t.workbench.newRequirement}</strong>
                      <span>{t.workbench.newRequirementHelp}</span>
                    </span>
                  </button>
                </div>
              </section>
            ) : (
              <div className="first-project-layout">
                <section className="first-project-card">
                  <div className="section-heading">
                    <p className="studio-label">{t.setup.workspaceEyebrow}</p>
                    <h3>{t.workbench.createFirstProject}</h3>
                    <p>{t.workbench.createFirstProjectBody}</p>
                  </div>
                  {projectForm}
                  <StatusMascotMessage
                    className="live-note"
                    status={projectStatus}
                    t={t}
                  />
                </section>
                <ol className="onboarding-list" aria-label={t.workbench.pathLabel}>
                  <li>
                    <strong>{t.workbench.pathProject}</strong>
                    <span>{t.workbench.pathProjectHelp}</span>
                  </li>
                  <li>
                    <strong>{t.workbench.pathRequirement}</strong>
                    <span>{t.workbench.pathRequirementHelp}</span>
                  </li>
                  <li>
                    <strong>{t.workbench.pathReview}</strong>
                    <span>{t.workbench.pathReviewHelp}</span>
                  </li>
                </ol>
              </div>
            )}
          </section>
        ) : activePage === "requirements" ? (
          <section
            className="requirements-page"
            aria-labelledby="requirements-page-heading"
          >
            <div className="template-page-heading-row">
              <div className="section-heading">
                <p className="studio-label">{t.workspace.requirementsEyebrow}</p>
                <h2 id="requirements-page-heading">
                  {t.workspace.allRequirementsHeading}
                </h2>
                <p>{t.workspace.allRequirementsBody}</p>
              </div>
            </div>
            {!isIdleStatus(requirementStatus) ? (
              <StatusMascotMessage
                className="live-note"
                status={requirementStatus}
                t={t}
              />
            ) : null}
            {editableRequirementList}
          </section>
        ) : activePage === "settings" ? (
          <section className="settings-page" aria-labelledby="settings-heading">
            <div className="section-heading">
              <p className="studio-label">{t.settings.eyebrow}</p>
              <h2 id="settings-heading">{t.settings.title}</h2>
              <p>{t.settings.description}</p>
            </div>
            <div className="settings-layout">
              <aside className="settings-sidebar">
                <nav aria-label={t.settings.navigationLabel}>
                  <button
                    aria-controls="settings-basic"
                    aria-pressed={activeSettingsSection === "basic"}
                    className="settings-nav-item"
                    onClick={() => setActiveSettingsSection("basic")}
                    type="button"
                  >
                    {t.settings.basicSectionTitle}
                  </button>
                  <button
                    aria-controls="settings-model"
                    aria-pressed={activeSettingsSection === "model"}
                    className="settings-nav-item"
                    onClick={() => setActiveSettingsSection("model")}
                    type="button"
                  >
                    {t.settings.modelSectionTitle}
                  </button>
                  <button
                    aria-controls="settings-skills"
                    aria-pressed={activeSettingsSection === "skills"}
                    className="settings-nav-item"
                    onClick={() => setActiveSettingsSection("skills")}
                    type="button"
                  >
                    {t.settings.skillSectionTitle}
                  </button>
                </nav>
              </aside>
              <div className="settings-content">
                {activeSettingsSection === "basic" ? (
                  <section
                    className="settings-section"
                    id="settings-basic"
                    aria-labelledby="settings-basic-heading"
                  >
                    <div className="section-heading">
                      <h3 id="settings-basic-heading">
                        {t.settings.basicSectionTitle}
                      </h3>
                      <p>{t.settings.basicSectionDescription}</p>
                    </div>
                    <form
                      className="settings-project-form"
                      onSubmit={handleSaveProjectName}
                    >
                      <label>
                        {t.settings.projectNameLabel}
                        <input
                          disabled={!selectedProjectId}
                          onChange={(event) =>
                            setEditedProjectName(event.target.value)
                          }
                          required
                          type="text"
                          value={editedProjectName}
                        />
                      </label>
                      <p className="form-helper">
                        {selectedProjectId
                          ? t.settings.projectNameHelp
                          : t.settings.noProjectNameHelp}
                      </p>
                      <div className="settings-actions settings-actions-end">
                        <button disabled={!selectedProjectId} type="submit">
                          {t.settings.saveProjectName}
                        </button>
                      </div>
                    </form>
                    <div className="settings-grid">
                      <label>
                        {t.settings.languageLabel}
                        <select
                          data-testid="language-select"
                          onChange={(event) =>
                            handleChangeLocale(event.target.value as Locale)
                          }
                          value={locale}
                        >
                          {supportedLocales.map((language) => (
                            <option key={language.code} value={language.code}>
                              {language.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t.settings.defaultArtifactsLabel}
                        <select
                          onChange={(event) =>
                            setArtifactStorageMode(
                              event.target.value as ArtifactStorageMode
                            )
                          }
                          value={artifactStorageMode}
                        >
                          <option value="local-only">{t.options.localOnly}</option>
                          <option value="cloud">{t.options.cloud}</option>
                        </select>
                      </label>
                      <label>
                        {t.settings.defaultDatabaseLabel}
                        <select
                          onChange={(event) =>
                            setDbStrategy(event.target.value as DbStrategy)
                          }
                          value={dbStrategy}
                        >
                          <option value="sqlite">{t.options.sqlite}</option>
                          <option value="postgres">{t.options.postgres}</option>
                          <option value="mysql">{t.options.mysql}</option>
                        </select>
                      </label>
                    </div>
                  </section>
                ) : null}
                {activeSettingsSection === "skills" ? (
                  <div className="settings-form">
                    <section
                      className="settings-section"
                      id="settings-skills"
                      aria-labelledby="settings-skills-heading"
                    >
                      <div className="section-heading">
                        <h3 id="settings-skills-heading">
                          {t.settings.skillSectionTitle}
                        </h3>
                        <p>{t.settings.skillSectionDescription}</p>
                      </div>
                      <div className="skill-library-toolbar">
                        <div>
                          <strong>{t.settings.skillLibraryTitle}</strong>
                          <span>{t.settings.skillLibraryDescription}</span>
                        </div>
                        <div className="skill-library-actions">
                          <button
                            onClick={() => handleOpenSkillUploadDialog("zip")}
                            type="button"
                          >
                            {t.settings.uploadSkillZip}
                          </button>
                          <button
                            className="button-secondary"
                            onClick={() => handleOpenSkillUploadDialog("url")}
                            type="button"
                          >
                            {t.settings.importSkillFromLink}
                          </button>
                        </div>
                      </div>
                      <div className="skill-library-layout">
                        <section
                          className="settings-subsection skill-library-panel"
                          aria-label={t.settings.skillLibraryLabel}
                        >
                          {skills.length > 0 ? (
                            <div className="skill-list">
                              {skills.map((skill) => (
                                <article
                                  className="skill-record skill-record-row"
                                  key={skill.id}
                                >
                                  <div className="skill-record-main">
                                    <strong>{skill.name}</strong>
                                    <span>{skill.ref}</span>
                                    {skill.sourceUrl ? (
                                      <span>{t.settings.linkedSkillSource}</span>
                                    ) : null}
                                    {skill.description ? (
                                      <p>{skill.description}</p>
                                    ) : null}
                                  </div>
                                  <div className="skill-record-actions">
                                    <button
                                      className="button-secondary"
                                      onClick={() => {
                                        setSelectedSkillId(skill.id);
                                        setSelectedSkillFilePath("");
                                        setIsSkillContentDialogOpen(true);
                                      }}
                                      type="button"
                                    >
                                      {t.settings.viewSkill}
                                    </button>
                                    {skill.sourceUrl ? (
                                      <button
                                        className="button-secondary"
                                        onClick={() =>
                                          handleUpdateSkillFromSource(skill.id)
                                        }
                                        type="button"
                                      >
                                        {t.settings.updateSkillFromSource}
                                      </button>
                                    ) : null}
                                    <button
                                      className="button-secondary button-danger"
                                      onClick={() => handleDeleteSkill(skill.id)}
                                      type="button"
                                    >
                                      {t.settings.deleteSkill}
                                    </button>
                                  </div>
                                </article>
                              ))}
                            </div>
                          ) : (
                            <p className="form-helper">
                              {t.settings.noSkills}
                            </p>
                          )}
                        </section>
                      </div>
                    </section>
                    <AnimatePresence>
                    {isSkillUploadDialogOpen ? (
                      <MotionModalBackdrop
                        aria-labelledby="skill-upload-heading"
                        role="dialog"
                      >
                        <MotionModalDivPanel className="modal-panel skill-upload-modal">
                          <div className="modal-heading-row">
                            <div className="section-heading">
                              <p className="studio-label">
                                {t.settings.skillPlaneLabel}
                              </p>
                              <h3 id="skill-upload-heading">
                                {t.settings.skillUploadTitle}
                              </h3>
                              <p>{t.settings.skillUploadDescription}</p>
                            </div>
                            <button
                              className="button-secondary"
                              onClick={() => setIsSkillUploadDialogOpen(false)}
                              type="button"
                            >
                              {t.workbench.close}
                            </button>
                          </div>
                          <form
                            className="settings-subsection settings-capability-panel skill-upload-panel"
                            onSubmit={handleSaveSkill}
                          >
                            {skillUploadMode === "zip" ? (
                              <>
                                <span className="skill-upload-label">
                                  {t.settings.skillFileLabel}
                                </span>
                                <label className="skill-upload-dropzone">
                                  <input
                                    accept=".zip,application/zip,application/x-zip-compressed"
                                    className="skill-file-input"
                                    onChange={handleSkillFileUpload}
                                    type="file"
                                  />
                                  <span className="skill-upload-dropzone-copy">
                                    <strong>
                                      {skillUploadArchive
                                        ? t.settings.skillUploadSelectedTitle
                                        : t.settings.skillUploadNoFileTitle}
                                    </strong>
                                    <span>
                                      {skillUploadArchive
                                        ? skillUploadArchive.name
                                        : t.settings.skillUploadNoFileDescription}
                                    </span>
                                  </span>
                                  <span className="skill-upload-button">
                                    {t.settings.skillUploadChooseFiles}
                                  </span>
                                </label>
                                {skillUploadArchive ? (
                                  <ul
                                    aria-label={t.settings.skillUploadSelectedTitle}
                                    className="skill-upload-file-list"
                                  >
                                    <li>{skillUploadArchive.name}</li>
                                  </ul>
                                ) : null}
                                <p className="form-helper">
                                  {skillUploadArchive
                                    ? t.settings.skillUploadFileCount(1)
                                    : t.settings.skillUploadValidationHelp}
                                </p>
                              </>
                            ) : (
                              <>
                                <label className="settings-field skill-source-url-field">
                                  <span>{t.settings.skillSourceUrlLabel}</span>
                                  <input
                                    onChange={(event) =>
                                      setSkillSourceUrl(event.target.value)
                                    }
                                    placeholder={t.settings.skillSourceUrlPlaceholder}
                                    type="url"
                                    value={skillSourceUrl}
                                  />
                                </label>
                                <p className="form-helper">
                                  {t.settings.skillSourceUrlHelp}
                                </p>
                              </>
                            )}
                            {settingsStatus.kind === "error" ? (
                              <StatusMascotMessage
                                className="skill-upload-status"
                                status={settingsStatus}
                                t={t}
                              />
                            ) : null}
                            <div className="settings-actions settings-actions-end">
                              <button
                                disabled={
                                  skillUploadMode === "zip"
                                    ? !skillUploadArchive
                                    : !skillSourceUrl.trim()
                                }
                                type="submit"
                              >
                                {skillUploadMode === "zip"
                                  ? t.settings.confirmSkillUpload
                                  : t.settings.importSkillFromLink}
                              </button>
                            </div>
                          </form>
                        </MotionModalDivPanel>
                      </MotionModalBackdrop>
                    ) : null}
                    {selectedSkill && isSkillContentDialogOpen ? (
                      <MotionModalBackdrop
                        aria-labelledby="skill-file-tree-heading"
                        role="dialog"
                      >
                        <MotionModalDivPanel className="modal-panel skill-file-tree-modal">
                          <div className="modal-heading-row">
                            <div className="section-heading">
                              <p className="studio-label">
                                {t.settings.skillFileTreeTitle}
                              </p>
                              <h3 id="skill-file-tree-heading">
                                {selectedSkill.name}
                              </h3>
                              <p>{selectedSkill.ref}</p>
                            </div>
                            <button
                              className="button-secondary"
                              onClick={() => {
                                setIsSkillContentDialogOpen(false);
                                setSelectedSkillFilePath("");
                              }}
                              type="button"
                            >
                              {t.workbench.close}
                            </button>
                          </div>
                          <div className="skill-file-tree-modal-layout">
                            <div className="skill-file-tree skill-file-tree-only">
                              <strong>{t.settings.skillFileTreeTitle}</strong>
                              <div className="skill-file-directory">
                                {selectedSkill.files.map((file) => (
                                  <button
                                    aria-pressed={
                                      file.path === selectedSkillPreviewFile?.path
                                    }
                                    className="skill-file-node"
                                    key={file.path}
                                    onClick={() =>
                                      setSelectedSkillFilePath(file.path)
                                    }
                                    title={file.path}
                                    type="button"
                                  >
                                    {file.path}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {selectedSkillPreviewFile ? (
                              <div className="skill-content-preview skill-content-preview-modal">
                                <strong>{selectedSkillPreviewFile.path}</strong>
                                <pre>{selectedSkillPreviewFile.content}</pre>
                              </div>
                            ) : (
                              <div className="skill-preview-empty">
                                {t.settings.skillPreviewTitle}
                              </div>
                            )}
                          </div>
                        </MotionModalDivPanel>
                      </MotionModalBackdrop>
                    ) : null}
                    </AnimatePresence>
                    <StatusMascotMessage
                      className="live-note"
                      status={settingsStatus}
                      t={t}
                    />
                  </div>
                ) : null}
                {activeSettingsSection === "model" ? (
                  <div className="settings-form">
                    <section
                      className="settings-section"
                      id="settings-model"
                      aria-labelledby="settings-model-heading"
                    >
                      <div className="section-heading">
                        <p className="studio-label">
                          {t.settings.executionEyebrow}
                        </p>
                        <h3 id="settings-model-heading">
                          {t.settings.modelSectionTitle}
                        </h3>
                        <p>{t.settings.modelSectionDescription}</p>
                      </div>
                      <form
                        className="settings-default-executor"
                        onSubmit={handleSaveProjectDefaultExecutor}
                      >
                        <div>
                          <strong>{t.settings.defaultExecutorTitle}</strong>
                          <span>{t.settings.defaultExecutorDescription}</span>
                        </div>
                        <div className="settings-grid">
                          <label>
                            {t.settings.defaultExecutorTypeLabel}
                            <select
                              disabled={!selectedProject}
                              onChange={(event) => {
                                const nextType = event.target
                                  .value as ExecutorType;

                                setDefaultExecutorType(nextType);
                                if (
                                  nextType === "agent-binding" &&
                                  !defaultExecutorAgentBindingId
                                ) {
                                  setDefaultExecutorAgentBindingId(
                                    agentBindings[0]?.id ?? ""
                                  );
                                }
                                if (nextType === "model-api") {
                                  setDefaultExecutorAgentBindingId("");
                                }
                              }}
                              value={defaultExecutorType}
                            >
                              <option value="model-api">
                                {t.workspace.modelApiExecutorLabel}
                              </option>
                              <option
                                disabled={agentBindings.length === 0}
                                value="agent-binding"
                              >
                                {t.settings.agentBindingExecutorLabel}
                              </option>
                            </select>
                          </label>
                          <label>
                            {t.settings.defaultAgentBindingLabel}
                            <select
                              disabled={
                                !selectedProject ||
                                defaultExecutorType !== "agent-binding" ||
                                agentBindings.length === 0
                              }
                              onChange={(event) =>
                                setDefaultExecutorAgentBindingId(
                                  event.target.value
                                )
                              }
                              value={defaultExecutorAgentBindingId}
                            >
                              {agentBindings.length === 0 ? (
                                <option value="">
                                  {t.settings.noAgentBindings}
                                </option>
                              ) : null}
                              {agentBindings.map((agent) => (
                                <option key={agent.id} value={agent.id}>
                                  {agent.name} · {agent.connector}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="settings-actions settings-actions-end">
                          <button disabled={!selectedProject} type="submit">
                            {t.settings.saveDefaultExecutor}
                          </button>
                        </div>
                      </form>
                      <nav
                        aria-label={t.settings.modelNavigationLabel}
                        className="settings-secondary-nav"
                      >
                        <button
                          aria-controls="settings-model-api"
                          aria-pressed={activeModelSettingsSection === "model"}
                          className="settings-secondary-nav-item"
                          onClick={() => setActiveModelSettingsSection("model")}
                          type="button"
                        >
                          {t.settings.modelSectionTitle}
                        </button>
                        <button
                          aria-controls="settings-local-bridge"
                          aria-pressed={
                            activeModelSettingsSection === "local-bridge"
                          }
                          className="settings-secondary-nav-item"
                          onClick={() =>
                            setActiveModelSettingsSection("local-bridge")
                          }
                          type="button"
                        >
                          {t.settings.localBridgeSectionTitle}
                        </button>
                      </nav>
                      <div className="settings-block-stack">
                        {activeModelSettingsSection === "model" ? (
                        <form
                          className="settings-subsection settings-capability-panel settings-model-api-panel"
                          id="settings-model-api"
                          onSubmit={handleSaveModelSettings}
                        >
                          <div className="section-heading">
                            <div className="settings-panel-kicker">
                              <span>{t.settings.modelApiPlaneLabel}</span>
                              <strong>{t.settings.modelApiScopeLabel}</strong>
                            </div>
                            <h4>{t.settings.modelApiBlockTitle}</h4>
                            <p>{t.settings.modelApiBlockDescription}</p>
                            <p className="settings-title-helper">
                              {t.settings.executionHelp}
                            </p>
                          </div>
                          <div className="settings-grid">
                            <label>
                              {t.settings.modelProviderLabel}
                              <select
                                value={modelProvider}
                                onChange={(event) => {
                                  const nextSettings =
                                    getModelSettingsForProviderChange(
                                      event.target.value as ModelProviderKind
                                    );

                                  setModelProvider(nextSettings.modelProvider);
                                  setModelBaseUrl(nextSettings.modelBaseUrl);
                                  setModelName(nextSettings.modelName);
                                }}
                              >
                                {modelProviderOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              {t.settings.modelBaseUrlLabel}
                              <input
                                onChange={(event) =>
                                  setModelBaseUrl(event.target.value)
                                }
                                placeholder="https://api.openai.com/v1"
                                required
                                value={modelBaseUrl}
                              />
                            </label>
                            <label>
                              {t.settings.modelNameLabel}
                              <input
                                onChange={(event) =>
                                  setModelName(event.target.value)
                                }
                                placeholder="gpt-4.1-mini"
                                required
                                value={modelName}
                              />
                            </label>
                            <label>
                              {t.settings.modelApiKeyLabel}
                              <input
                                autoComplete="off"
                                onChange={(event) =>
                                  setModelApiKey(event.target.value)
                                }
                                onBlur={() => {
                                  if (!modelApiKey) {
                                    setIsReplacingModelApiKey(false);
                                  }
                                }}
                                onFocus={() => setIsReplacingModelApiKey(true)}
                                placeholder={
                                  executionSettings?.modelConfigured
                                    ? t.settings.modelApiKeyConfigured
                                    : t.settings.modelApiKeyPlaceholder
                                }
                                type="password"
                                value={
                                  modelApiKey ||
                                  (executionSettings?.modelConfigured &&
                                  !isReplacingModelApiKey
                                    ? configuredModelApiKeyMask
                                    : "")
                                }
                              />
                            </label>
                          </div>
                          <div className="settings-capability-row">
                            <span>
                              {isModelConfigured
                                ? t.settings.modelConfigured
                                : t.settings.modelMissing}
                            </span>
                          </div>
                          <div className="settings-actions">
                            <div className="settings-action-buttons">
                              <button
                                className="button-secondary"
                                type="button"
                                onClick={handleTestModelApi}
                              >
                                {t.settings.testModelApi}
                              </button>
                              <button type="submit">
                                {t.settings.saveModelApi}
                              </button>
                            </div>
                          </div>
                        </form>
                        ) : null}
                        {activeModelSettingsSection === "local-bridge" ? (
                        <form
                          className="settings-subsection settings-capability-panel settings-agent-proxy-panel"
                          id="settings-local-bridge"
                          onSubmit={handleSaveAgentProxySettings}
                        >
                          <div className="section-heading">
                            <div className="settings-panel-kicker">
                              <span>{t.settings.agentProxyPlaneLabel}</span>
                              <strong>{t.settings.agentProxyScopeLabel}</strong>
                            </div>
                            <h4>{t.settings.agentProxyBlockTitle}</h4>
                            <p>{t.settings.agentSectionDescription}</p>
                          </div>
                          <div className="settings-setup-note">
                            <div className="settings-setup-note-heading">
                              <strong>{t.settings.agentProxySetupTitle}</strong>
                              <button
                                aria-label={t.settings.agentProxySetupHelpLabel}
                                className="settings-help-button"
                                onClick={() => setIsCliDownloadHelpOpen(true)}
                                title={t.settings.agentProxySetupHelpLabel}
                                type="button"
                              >
                                ?
                              </button>
                            </div>
                            <span>{t.settings.agentProxySetupDescription}</span>
                            <span>{t.settings.agentProxyCliUnavailable}</span>
                          </div>
                          <div className="agent-binding-registry">
                            <div className="agent-binding-registry-heading">
                              <div>
                                <strong>
                                  {t.settings.registeredAgentBindingsTitle}
                                </strong>
                                <span>
                                  {t.settings.registeredAgentBindingsDescription}
                                </span>
                              </div>
                            </div>
                            {agentBindings.length === 0 ? (
                              <p className="agent-binding-empty">
                                {t.settings.noRegisteredAgentBindings}
                              </p>
                            ) : (
                              <div className="agent-binding-list">
                                {agentBindings.map((agent) => (
                                  <article
                                    className="agent-binding-record"
                                    key={agent.id}
                                  >
                                    <div className="agent-binding-record-main">
                                      <div>
                                        <strong>{agent.name}</strong>
                                        <span>{agent.connector}</span>
                                      </div>
                                      <StatusBadge
                                        tone={getAgentBindingStatusTone(
                                          agent.status
                                        )}
                                      >
                                        {agent.status}
                                      </StatusBadge>
                                    </div>
                                    <dl className="agent-binding-record-details">
                                      <div>
                                        <dt>
                                          {t.settings.agentBindingCommandLabel}
                                        </dt>
                                        <dd>{agent.command}</dd>
                                      </div>
                                      <div>
                                        <dt>
                                          {
                                            t.settings
                                              .agentBindingCapabilitiesLabel
                                          }
                                        </dt>
                                        <dd>
                                          {agent.capabilities.join(", ") ||
                                            agent.connector}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt>
                                          {t.settings.agentBindingLastSeenLabel}
                                        </dt>
                                        <dd>
                                          {agent.lastSeenAt
                                            ? formatManagementTimestamp(
                                                agent.lastSeenAt
                                              )
                                            : "-"}
                                        </dd>
                                      </div>
                                    </dl>
                                  </article>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="settings-grid">
                            <label className="settings-wide-field">
                              {t.settings.agentProxyUrlLabel}
                              <input
                                onChange={(event) =>
                                  setAgentProxyUrl(event.target.value)
                                }
                                placeholder="http://127.0.0.1:8787"
                                value={agentProxyUrl}
                              />
                            </label>
                          </div>
                          <div className="settings-capability-row">
                            <span>
                              {executionSettings?.agentProxyConfigured
                                ? t.settings.agentProxyConfigured
                                : t.settings.agentProxyMissing}
                            </span>
                          </div>
                          <div className="settings-actions settings-actions-end">
                            <button type="submit">
                              {t.settings.saveAgentProxy}
                            </button>
                          </div>
                        </form>
                        ) : null}
                      </div>
                    </section>
                    <StatusMascotMessage
                      className="live-note"
                      status={settingsStatus}
                      t={t}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : (
          <section
            className="workflow-templates-page"
            aria-labelledby="workflow-templates-heading"
          >
            <div className="template-page-heading-row">
              <div className="section-heading">
                <p className="studio-label">{t.templatePage.eyebrow}</p>
                <h2 id="workflow-templates-heading">{t.templatePage.title}</h2>
                <p>{t.templatePage.description}</p>
              </div>
              <div className="template-page-actions">
                <button
                  onClick={() => handleOpenWorkflowTemplateDialog("new")}
                  type="button"
                >
                  {t.templatePage.newWorkflow}
                </button>
                <button
                  className="button-secondary"
                  onClick={() => handleOpenWorkflowTemplateDialog("import")}
                  type="button"
                >
                  {t.templatePage.importWorkflow}
                </button>
              </div>
            </div>
            <div className="template-overview-grid">
              <article className="template-stat">
                <span>{t.templatePage.totalTemplates}</span>
                <strong>{visibleWorkflowTemplateCount}</strong>
              </article>
              <article className="template-stat">
                <span>{t.templatePage.totalWorkflowNodes}</span>
                <strong>{visibleWorkflowNodeCount}</strong>
              </article>
            </div>
            <section className="template-library-panel template-library-panel-thin">
              <div className="section-heading">
                <p className="studio-label">{t.templatePage.libraryEyebrow}</p>
                <h3>{t.templatePage.libraryTitle}</h3>
                <p>{t.templatePage.libraryDescription}</p>
              </div>
              <div className="template-card-list template-thin-list">
                {defaultWorkflowTemplates.map((template) => (
                    <article
                      className="template-card template-thin-row"
                      key={template.key}
                    >
                      <div className="template-row-main">
                        <div className="template-row-title">
                          <h3>{template.workflow.name}</h3>
                          <p>
                            {
                              t.templatePage.defaultTemplateDescriptions[
                                template.key
                              ]
                            }
                          </p>
                        </div>
                        <span className="template-node-count">
                          {t.templatePage.templateSummary(
                            template.workflow.nodes.length
                          )}
                        </span>
                        <span className="template-type-badge">
                          {t.templatePage.templateTypeLabels.builtin}
                        </span>
                      </div>
                      <div className="template-row-actions">
                        <button
                          className="button-secondary"
                          onClick={() => {
                            setSelectedPreviewWorkflowId(`builtin:${template.key}`);
                          }}
                          type="button"
                        >
                          {t.templatePage.previewEyebrow}
                        </button>
                      </div>
                    </article>
                  ))}
                {visibleStoredWorkflowTemplates.map((workflowFile) => {
                    const isEditing = editingWorkflowId === workflowFile.id;
                    const displayName = getWorkflowTemplateDisplayName(
                      t,
                      workflowFile
                    );
                    const templateType =
                      t.templatePage.templateTypeLabels[
                        getWorkflowTemplateType(workflowFile)
                      ];
                    return (
                      <article
                        className="template-card template-thin-row"
                        key={workflowFile.id}
                      >
                        <div className="template-row-main">
                          <div className="template-row-title">
                            <h3>{displayName}</h3>
                          </div>
                          <span className="template-node-count">
                            {t.templatePage.templateSummary(
                              workflowFile.nodeCount
                            )}
                          </span>
                          <span className="template-type-badge">
                            {templateType}
                          </span>
                        </div>
                        {isEditing ? (
                          <form
                            className="workflow-rename-form workflow-rename-form-inline"
                            onSubmit={(event) =>
                              handleUpdateWorkflowFile(event, workflowFile.id)
                            }
                          >
                            <label>
                              {t.templatePage.workflowNameLabel}
                              <input
                                aria-label={`${t.templatePage.renameWorkflow} ${workflowFile.name}`}
                                minLength={1}
                                onChange={(event) =>
                                  setEditedWorkflowNames((currentNames) => ({
                                    ...currentNames,
                                    [workflowFile.id]: event.target.value
                                  }))
                                }
                                required
                                value={
                                  editedWorkflowNames[workflowFile.id] ??
                                  workflowFile.name
                                }
                              />
                            </label>
                            <p className="form-helper">
                              {t.templatePage.workflowRenameHelp}
                            </p>
                            <div className="template-row-actions">
                              <button type="submit">
                                {t.templatePage.saveWorkflowName}
                              </button>
                              <button
                                className="button-secondary"
                                onClick={() => {
                                  setEditedWorkflowNames((currentNames) => ({
                                    ...currentNames,
                                    [workflowFile.id]: workflowFile.name
                                  }));
                                  setEditingWorkflowId("");
                                }}
                                type="button"
                              >
                                {t.templatePage.cancelWorkflowEdit}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="template-row-actions">
                            <button
                              aria-label={`${t.templatePage.editWorkflowAria} ${workflowFile.name}`}
                              className="button-secondary"
                              onClick={() => setEditingWorkflowId(workflowFile.id)}
                              type="button"
                            >
                              {t.templatePage.editWorkflow}
                            </button>
                            <button
                              aria-label={`${t.templatePage.previewWorkflow} ${workflowFile.name}`}
                              className="button-secondary"
                              onClick={() =>
                                setSelectedPreviewWorkflowId(workflowFile.id)
                              }
                              type="button"
                            >
                              {t.templatePage.previewEyebrow}
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
              </div>
            </section>
          </section>
        )}
      </header>

      <AnimatePresence>
      {activeWorkbenchAction === "project" ? (
        <MotionModalBackdrop
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveWorkbenchAction(null);
            }
          }}
        >
          <MotionModalPanel
            aria-labelledby="project-modal-heading"
            aria-modal="true"
            className="requirement-modal project-modal"
            role="dialog"
          >
            <div className="modal-heading">
              <div className="section-heading">
                <p className="studio-label">{t.setup.workspaceEyebrow}</p>
                <h2 id="project-modal-heading">{t.workbench.newProject}</h2>
                <p>{t.setup.workspaceHeading}</p>
              </div>
              <button
                aria-label={`${t.workbench.close} ${t.workbench.newProject}`}
                className="button-secondary modal-close"
                onClick={() => setActiveWorkbenchAction(null)}
                type="button"
              >
                {t.workbench.close}
              </button>
            </div>
            {projectForm}
            {!isIdleStatus(projectStatus) ? (
              <StatusMascotMessage
                className="live-note"
                status={projectStatus}
                t={t}
              />
            ) : null}
          </MotionModalPanel>
        </MotionModalBackdrop>
      ) : null}

      {activeWorkbenchAction === "requirement" ? (
        <MotionModalBackdrop
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveWorkbenchAction(null);
            }
          }}
        >
          <MotionModalPanel
            aria-labelledby="requirement-modal-heading"
            aria-modal="true"
            className="requirement-modal"
            role="dialog"
          >
            <div className="modal-heading">
              <div className="section-heading">
                <p className="studio-label">{t.hero.eyebrow}</p>
                <h2 id="requirement-modal-heading">
                  {t.workbench.newRequirement}
                </h2>
                <p>{t.hero.heading}</p>
              </div>
              <button
                aria-label={t.workbench.closeRequirement}
                className="button-secondary modal-close"
                onClick={() => setActiveWorkbenchAction(null)}
                type="button"
              >
                {t.workbench.close}
              </button>
            </div>
            {requirementForm}
            {!isIdleStatus(requirementStatus) ? (
              <StatusMascotMessage
                className="live-note"
                status={requirementStatus}
                t={t}
              />
            ) : null}
          </MotionModalPanel>
        </MotionModalBackdrop>
      ) : null}

      {activeWorkflowTemplateDialog ? (
        <MotionModalBackdrop
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseWorkflowTemplateDialog();
            }
          }}
        >
          <MotionModalPanel
            aria-labelledby="workflow-template-modal-heading"
            aria-modal="true"
            className="requirement-modal workflow-template-modal"
            role="dialog"
          >
            <div className="modal-heading">
              <div className="section-heading">
                <p className="studio-label">{t.templatePage.eyebrow}</p>
                <h2 id="workflow-template-modal-heading">
                  {workflowTemplateDialogTitle}
                </h2>
                <p>
                  {isNewWorkflowDialog
                    ? t.templatePage.createDescription
                    : t.templatePage.importDescription}
                </p>
              </div>
              <button
                aria-label={`${t.workbench.close} ${workflowTemplateDialogTitle}`}
                className="button-secondary modal-close"
                onClick={handleCloseWorkflowTemplateDialog}
                type="button"
              >
                {t.workbench.close}
              </button>
            </div>
            {isNewWorkflowDialog ? workflowBuilderForm : workflowImportForm}
            {!isIdleStatus(workflowImportStatus) ? (
              <StatusMascotMessage
                className="live-note"
                status={workflowImportStatus}
                t={t}
              />
            ) : null}
          </MotionModalPanel>
        </MotionModalBackdrop>
      ) : null}

      {selectedWorkflowPreview ? (
        <MotionModalBackdrop
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedPreviewWorkflowId("");
            }
          }}
        >
          <MotionModalPanel
            aria-labelledby="workflow-preview-modal-heading"
            aria-modal="true"
            className="requirement-modal workflow-preview-modal"
            role="dialog"
          >
            <div className="modal-heading">
              <div className="section-heading">
                <p className="studio-label">{t.templatePage.previewEyebrow}</p>
                <h2 id="workflow-preview-modal-heading">
                  {selectedBuiltinTemplate?.workflow.name ??
                    (selectedWorkflowFile
                      ? getWorkflowTemplateDisplayName(t, selectedWorkflowFile)
                      : selectedWorkflowPreview.name)}
                </h2>
                <p>{t.templatePage.previewDescription}</p>
              </div>
              <button
                aria-label={`${t.workbench.close} ${t.templatePage.previewTitle}`}
                className="button-secondary modal-close"
                onClick={() => setSelectedPreviewWorkflowId("")}
                type="button"
              >
                {t.workbench.close}
              </button>
            </div>
            {renderWorkflowPreviewGraph(
              selectedWorkflowPreview,
              selectedWorkflowFile
            )}
          </MotionModalPanel>
        </MotionModalBackdrop>
      ) : null}
      </AnimatePresence>

      {activePage === "control-room" && showControlRoomPanels ? (
        <>
      <section
        className={`progress-ribbon ${
          latestStatusMessage ? "progress-ribbon-with-status" : ""
        }`.trim()}
        aria-label={t.progress.ariaLabel}
      >
        {progressSteps.map(([label, value]) => (
          <div className="progress-item" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        {latestStatusMessage ? (
          <StatusMascotMessage status={latestStatusMessage} t={t} />
        ) : null}
      </section>

      <div className="studio-workspace">
        <section className="workspace-main" aria-label={t.workspace.generatedWorkLabel}>
          <section className="work-section" aria-labelledby="requirements-heading">
            <div className="section-heading section-heading-with-action">
              <div>
                <p className="studio-label">{t.workspace.requirementsEyebrow}</p>
                <h2 id="requirements-heading">
                  {t.workspace.requirementsHeading}
                </h2>
              </div>
              <button
                className="button-secondary"
                onClick={() => handleNavigatePage("requirements")}
                type="button"
              >
                {t.workspace.viewAllRequirements}
              </button>
            </div>
            <div
              className="compact-list"
              aria-label={t.workspace.requirementsLabel}
            >
              {projectRequirements.length === 0 ? (
                <MascotLaneEmpty variant="guide">
                  {t.workspace.noRequirements}
                </MascotLaneEmpty>
              ) : (
                projectRequirements.map((requirement) => {
                  const decompositionResult =
                    decompositionResultByRequirementId.get(requirement.id);
                  const linkedTasks = projectTasks.filter(
                    (task) => task.requirementId === requirement.id
                  );
                  const hasTasks = linkedTasks.length > 0;
                  const clarificationPrompt =
                    getRequirementClarificationPrompt(requirement);

                  return (
                    <article className="compact-record" key={requirement.id}>
                      <div className="compact-record-main">
                        <h3>{requirement.title}</h3>
                        <div className="compact-record-detail-row">
                          <div className="compact-record-meta-grid">
                            <div className="compact-record-meta-item compact-record-meta-status">
                              <span className="compact-record-meta-label">
                                {t.workspace.requirementStatusLabel}
                              </span>
                              <span className="compact-record-meta-value">
                                <span className="requirement-current-status">
                                  <StatusBadge tone={getNodeRunTone(requirement.status)}>
                                    {getRequirementStatusLabel(t, requirement.status)}
                                  </StatusBadge>
                                </span>
                              </span>
                            </div>
                            <div className="compact-record-meta-item">
                              <span className="compact-record-meta-label">
                                {t.workspace.linkedTasksLabel}
                              </span>
                              <span className="compact-record-meta-value">
                                {t.workspace.tasksCount(linkedTasks.length)}
                              </span>
                            </div>
                            <div className="compact-record-meta-item">
                              <span className="compact-record-meta-label">
                                {t.workspace.requirementUpdatedLabel}
                              </span>
                              <span className="compact-record-meta-value">
                                {formatManagementTimestamp(requirement.updatedAt)}
                              </span>
                            </div>
                            <div className="compact-record-meta-item">
                              <span className="compact-record-meta-label">
                                {t.workspace.nextActionLabel}
                              </span>
                              <span className="compact-record-meta-value">
                                {getRequirementNextActionLabel(
                                  requirement,
                                  linkedTasks,
                                  decompositionResult
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="compact-record-actions">
                            {clarificationPrompt ? (
                              <button
                                className="button-secondary"
                                aria-label={t.workspace.answerClarificationAriaLabel(
                                  requirement.title
                                )}
                                onClick={() => openClarificationDialog(requirement)}
                                type="button"
                              >
                                {t.workspace.answerClarification}
                              </button>
                            ) : canPlanRequirementStatus(requirement.status) &&
                              !hasTasks ? (
                              <button
                                className="button-secondary"
                                onClick={() => openDecompositionDialog(requirement)}
                                type="button"
                              >
                                {t.workspace.planRequirement}
                              </button>
                            ) : null}
                            {requirement.status === "decomposing" && !hasTasks ? (
                              <button
                                className="button-secondary"
                                onClick={() => openDecompositionDialog(requirement)}
                                type="button"
                              >
                                {t.workspace.continueDecomposition}
                              </button>
                            ) : null}
                            {requirement.status === "ready_to_generate_tasks" &&
                            decompositionResult &&
                            !hasTasks ? (
                              <button
                                className="button-secondary"
                                onClick={() =>
                                  handleGenerateTasksFromDecompositionResult(
                                    decompositionResult.id
                                  )
                                }
                                type="button"
                              >
                                {t.workspace.generateTasks}
                              </button>
                            ) : null}
                            <button
                              className="button-secondary"
                              aria-label={`${t.workspace.editRequirement} ${requirement.title}`}
                              onClick={() => {
                                setEditedRequirementTitles((currentTitles) => ({
                                  ...currentTitles,
                                  [requirement.id]: requirement.title
                                }));
                                setEditedRequirementBodies((currentBodies) => ({
                                  ...currentBodies,
                                  [requirement.id]: requirement.body
                                }));
                                setEditingRequirementId(requirement.id);
                              }}
                              type="button"
                            >
                              {t.workspace.editRequirement}
                            </button>
                            {renderRequirementActionsMenu(requirement)}
                          </div>
                        </div>
                        {requirement.errorMessage ? (
                          <p>{requirement.errorMessage}</p>
                        ) : null}
                        {requirement.status === "ready_to_generate_tasks" &&
                        decompositionResult &&
                        !hasTasks
                          ? renderDecompositionResultEditor(decompositionResult)
                          : null}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="work-section" aria-label={t.workspace.taskBoardLabel}>
            <div className="section-heading section-heading-with-action">
              <div>
                <p className="studio-label">{t.workspace.taskBoardEyebrow}</p>
                <p>{t.workspace.taskBoardBody}</p>
              </div>
              <div className="task-board-toolbar">
                <div
                  className="task-board-filter"
                  aria-label={t.workspace.taskBoardRequirementFilterLabel}
                >
                  <button
                    aria-pressed={activeTaskBoardRequirementId === ""}
                    className="button-secondary"
                    onClick={() => setSelectedTaskBoardRequirementId("")}
                    type="button"
                  >
                    {t.workspace.taskBoardFilterAll}
                  </button>
                  <label>
                    {t.workspace.taskBoardRequirementFilterLabel}
                    <select
                      aria-label={t.workspace.taskBoardRequirementFilterLabel}
                      disabled={projectRequirements.length === 0}
                      onChange={(event) =>
                        setSelectedTaskBoardRequirementId(event.target.value)
                      }
                      value={activeTaskBoardRequirementId}
                    >
                      <option value="">{t.workspace.taskBoardFilterAll}</option>
                      {projectRequirements.map((requirement) => (
                        <option key={requirement.id} value={requirement.id}>
                          {requirement.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  className="button-secondary"
                  disabled={
                    isRunningAllTaskWorkflows ||
                    taskWorkflowFiles.length === 0 ||
                    runAllTaskCandidates.length === 0
                  }
                  onClick={() => {
                    void handleRunAllTaskWorkflows();
                  }}
                  type="button"
                >
                  {t.workspace.runAllTaskWorkflows}
                </button>
              </div>
            </div>
            <StatusMascotMessage
              className="live-note"
              status={taskBoardStatus}
              t={t}
            />
            <div className="task-board" aria-label={t.workspace.taskBoardLabel}>
              {taskStatuses.map((status) => {
                const columnTasks = visibleTaskBoardTasks.filter(
                  (task) => task.status === status
                );

                return (
                  <section className="task-column" key={status}>
                    <div className="task-column-header">
                      <h3>{t.taskStatus[status]}</h3>
                      <span>{columnTasks.length}</span>
                    </div>
                    <div className="task-list">
                      {columnTasks.length === 0 ? (
                        <MascotLaneEmpty quiet variant="guide">
                          {t.workspace.noTasks}
                        </MascotLaneEmpty>
                      ) : (
                        columnTasks.map((task) => {
                          const sourceRequirement = projectRequirements.find(
                            (requirement) => requirement.id === task.requirementId
                          );
                          const runs = workflowRunsByTaskId[task.id] ?? [];
                          const dependencyLabels = getTaskDependencyLabels(
                            task,
                            projectTasks
                          );
                          const dependenciesSatisfied =
                            areTaskDependenciesSatisfied(
                              task,
                              workflowRunsByTaskId
                            );
                          const canStartTaskWorkflow = task.status !== "running";
                          const selectedTaskWorkflowId =
                            getSelectedTaskWorkflowId(task.id);

                          return (
                            <article className="task-card" key={task.id}>
                              <div className="task-card-header">
                                <div>
                                  <h3>{task.title}</h3>
                                  <p>
                                    {t.workspace.sourceLabel}{" "}
                                    {sourceRequirement?.title ??
                                      task.requirementId}
                                  </p>
                                  <p>
                                    {t.workspace.executorLabel}{" "}
                                    {task.executorLabel}
                                  </p>
                                  {dependencyLabels.length > 0 ? (
                                    <p>
                                      {t.workspace.taskDependenciesLabel}{" "}
                                      {dependencyLabels.join(", ")}
                                    </p>
                                  ) : null}
                                </div>
                                <StatusBadge tone={getTaskStatusTone(task.status)}>
                                  {t.taskStatus[task.status]}
                                </StatusBadge>
                              </div>
                              {canStartTaskWorkflow ? (
                                <div className="task-run-controls">
                                  <label>
                                    {t.workspace.runWorkflowTemplateLabel}
                                    <select
                                      data-testid="task-workflow-select"
                                      disabled={taskWorkflowFiles.length === 0}
                                      onChange={(event) =>
                                        handleSelectTaskWorkflow(
                                          task.id,
                                          event.target.value
                                        )
                                      }
                                      value={selectedTaskWorkflowId}
                                    >
                                      {taskWorkflowFiles.length === 0 ? (
                                        <option value="">
                                          {t.workspace.importTaskWorkflowTemplateFirst}
                                        </option>
                                      ) : null}
                                      {taskWorkflowFiles.map((workflowFile) => (
                                        <option
                                          key={workflowFile.id}
                                          value={workflowFile.id}
                                        >
                                          {getWorkflowTemplateDisplayName(
                                            t,
                                            workflowFile
                                          )}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <button
                                    disabled={
                                      taskWorkflowFiles.length === 0 ||
                                      !dependenciesSatisfied
                                    }
                                    onClick={() =>
                                      handleOpenWorkflowRunExecutorDialog(task.id)
                                    }
                                    type="button"
                                  >
                                    {runs.length > 0
                                      ? t.workspace.rerunWorkflow
                                      : t.workspace.startRun}
                                  </button>
                                  {!dependenciesSatisfied ? (
                                    <p className="task-dependency-note">
                                      {t.workspace.taskDependenciesBlocked}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                              <div className="run-history">
                                {runs.length === 0 ? (
                                  <MascotLaneEmpty variant="thinking">
                                    {t.workspace.noRunsForTask}
                                  </MascotLaneEmpty>
                                ) : (
                                  runs.map((run) => (
                                    <div
                                      className="run-group"
                                      key={run.workflowRun.id}
                                    >
                                      <div className="run-group-header">
                                        <div className="run-group-summary">
                                          <span
                                            aria-hidden="true"
                                            className={`status-dot status-${getNodeRunTone(
                                              run.workflowRun.status
                                            )}`}
                                          />
                                          <div className="run-group-title">
                                            <span>{t.workspace.workflowRun}</span>
                                            <strong>{run.workflowRun.status}</strong>
                                          </div>
                                        </div>
                                        <div className="run-group-meta">
                                          <span className="run-group-timestamp">
                                            {t.workspace.workflowRunUpdatedAtLabel}{" "}
                                            {formatManagementTimestamp(
                                              run.workflowRun.updatedAt
                                            )}
                                          </span>
                                          <button
                                            className="button-secondary run-detail-button"
                                            onClick={() =>
                                              setWorkflowRunDetailDialog({
                                                taskId: task.id,
                                                workflowRunId: run.workflowRun.id
                                              })
                                            }
                                            type="button"
                                          >
                                            {t.workspace.viewWorkflowRunDetails}
                                          </button>
                                        </div>
                                      </div>
                                      <div className="node-run-list">
                                        {run.nodeRuns.map((nodeRun) => {
                                          const tone = getNodeRunTone(
                                            nodeRun.status
                                          );

                                          return (
                                            <div
                                              className="node-run-row"
                                              key={nodeRun.id}
                                            >
                                              <span
                                                className={`status-dot status-${tone}`}
                                              />
                                              <span
                                                className="node-run-id"
                                                title={nodeRun.nodeId}
                                              >
                                                {nodeRun.nodeId}
                                              </span>
                                              <strong className="node-run-status">
                                                {nodeRun.status}
                                              </strong>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>

        </section>
      </div>
        </>
      ) : null}
      {isCliDownloadHelpOpen ? (
        <MotionModalBackdrop
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsCliDownloadHelpOpen(false);
            }
          }}
        >
          <MotionModalPanel
            aria-labelledby="cli-download-help-heading"
            aria-modal="true"
            className="modal-panel cli-download-help-modal"
            role="dialog"
          >
            <div className="modal-heading-row">
              <div className="section-heading">
                <p className="studio-label">{t.settings.agentProxySetupTitle}</p>
                <h2 id="cli-download-help-heading">
                  {t.settings.cliDownloadTitle}
                </h2>
                <p>{t.settings.cliDownloadIntro}</p>
              </div>
              <button
                aria-label={t.settings.closeCliDownloadHelp}
                className="button-secondary modal-close"
                onClick={() => setIsCliDownloadHelpOpen(false)}
                type="button"
              >
                {t.workbench.close}
              </button>
            </div>
            <ol className="cli-download-help-list">
              <li>
                <span>{t.settings.cliDownloadRelease}</span>
                <a
                  className="cli-download-link"
                  download
                  href={forgeCliDownloadUrl}
                >
                  {forgeCliDownloadUrl}
                </a>
              </li>
              <li>
                <span>{t.settings.cliDownloadLocalBuild}</span>
                <code>pnpm release</code>
                <code>pnpm build:forgecli</code>
              </li>
            </ol>
            <p className="cli-download-help-next">
              {t.settings.cliDownloadNextStep}
            </p>
            <code className="cli-download-help-command">
              apps/forgecli/dist/index.js bridge bind --server
              {" <Forge Server URL>"}
            </code>
          </MotionModalPanel>
        </MotionModalBackdrop>
      ) : null}
      <footer className="studio-footer">
        <div>
          <strong>{t.footer.brand}</strong>
          <span>{t.footer.description}</span>
        </div>
        <span className="studio-footer-copyright">{t.footer.copyright}</span>
      </footer>
    </MotionShell>
  );
}
