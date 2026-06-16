import {
  createProject,
  createRequirement,
  createRequirementDecompositionResult,
  deleteRequirement,
  generateTasksFromDecompositionResult,
  getExecutionSettings,
  importWorkflowFile,
  listDecompositionResults,
  listRequirements,
  listProjects,
  listTaskWorkflowRuns,
  listTasks,
  listWorkflowFiles,
  startTaskWorkflowRun,
  testModelApi,
  updateExecutionSettings,
  updateWorkflowFile,
  updateProject,
  updateRequirement,
  type ArtifactStorageMode,
  type DecompositionResult,
  type DbStrategy,
  type ExecutionSettings,
  type ModelProviderKind,
  type Project,
  type Requirement,
  type Task,
  type WorkflowRunWithNodes,
  type WorkflowFileMetadata,
  type WorkflowFile,
  type WorkflowNodeOutput,
} from "@forge/sdk";
import { readLegacyWorkflowScope } from "@forge/core";
import { StatusBadge } from "@forge/ui";
import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
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
type WorkflowTemplateDialog = "new" | "import" | null;
type WorkflowImportMode = "source" | "file";
type TemplateBuilderNode = {
  executor: string;
  id: string;
  maxRetries: number;
  output: string;
  type: string;
};
type SettingsSection = "basic" | "model";
type ModelSettingsSection = "model" | "local-bridge";
type Messages = ReturnType<typeof getMessages>;
type AppProps = {
  initialExecutionSettings?: ExecutionSettings | null;
  initialDecompositionResults?: DecompositionResult[];
  initialModelSettingsSection?: ModelSettingsSection;
  initialPage?: ActivePage;
  initialProjects?: Project[];
  initialRequirements?: Requirement[];
  initialSettingsSection?: SettingsSection;
  initialTasks?: Task[];
  initialWorkbenchAction?: ActiveWorkbenchAction;
  initialWorkflowTemplateDialog?: WorkflowTemplateDialog;
  initialEditingWorkflowId?: string;
  initialPreviewWorkflowId?: string;
  initialWorkflowRunsByTaskId?: Record<string, WorkflowRunWithNodes[]>;
  initialWorkflowFiles?: WorkflowFileMetadata[];
};
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
const configuredModelApiKeyMask = "••••••••••••";
const pagePathByPage: Record<ActivePage, string> = {
  "control-room": "/control-room",
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
    case "savingRequirement":
    case "savingWorkflow":
    case "savingAgentProxySettings":
    case "savingModelSettings":
    case "savingSettings":
    case "startingWorkflowRun":
    case "testingModelApi":
      return "thinking";
    case "agentProxySettingsSaved":
    case "deletedRequirement":
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

const workflowDagCardWidth = 230;
const workflowDagCardHeight = 320;
const workflowDagColumnGap = 56;
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

function quoteWorkflowValue(value: string) {
  return JSON.stringify(value.trim());
}

function createWorkflowSourceFromBuilder(
  name: string,
  nodes: TemplateBuilderNode[]
) {
  const safeName = name.trim() || "Untitled Workflow template";
  const safeNodes =
    nodes.length > 0
      ? nodes
      : [
          {
            executor: "agent:worker",
            id: "work",
            maxRetries: 1,
            output: "work.md",
            type: "task-work"
          }
        ];

  return `name: ${quoteWorkflowValue(safeName)}
version: "1.1"
inputs:
  - id: task
    type: task
    required: true
nodes:
${safeNodes
  .map((node, index) => {
    const safeNodeId = node.id.trim() || `node-${index + 1}`;
    const previousNodeId =
      safeNodes[index - 1]?.id.trim() || `node-${index}`;
    const dependsOn =
      index === 0
        ? ""
        : `    dependsOn: ${quoteWorkflowValue(previousNodeId)}\n`;

    return `  - id: ${quoteWorkflowValue(safeNodeId)}
    type: ${quoteWorkflowValue(node.type.trim() || "task-work")}
${dependsOn}    executor: ${quoteWorkflowValue(node.executor.trim() || "agent:worker")}
    outputs:
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
  initialExecutionSettings = null,
  initialDecompositionResults = [],
  initialModelSettingsSection = "model",
  initialPage,
  initialProjects = [],
  initialRequirements = [],
  initialSettingsSection = "basic",
  initialTasks = [],
  initialWorkbenchAction = null,
  initialWorkflowTemplateDialog = null,
  initialEditingWorkflowId = "",
  initialPreviewWorkflowId = "",
  initialWorkflowRunsByTaskId = {},
  initialWorkflowFiles = []
}: AppProps = {}) {
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

    return initialProjects.some((project) => project.id === storedProjectId)
      ? storedProjectId
      : initialProjects[0]?.id ?? storedProjectId;
  });
  const [locale, setLocale] = useState<Locale>(() =>
    readStoredLocale(typeof window === "undefined" ? undefined : window.localStorage)
  );
  const t = getMessages(locale);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [projectName, setProjectName] = useState("");
  const [editedProjectName, setEditedProjectName] = useState(() => {
    const storedProjectId = readStoredProjectId(getBrowserStorage());
    const selectedInitialProjectId = initialProjects.some(
      (project) => project.id === storedProjectId
    )
      ? storedProjectId
      : initialProjects[0]?.id ?? storedProjectId;

    return (
      initialProjects.find((project) => project.id === selectedInitialProjectId)
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
      executor: "agent:worker",
      id: "work",
      maxRetries: 1,
      output: "work.md",
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
  const [editingRequirementId, setEditingRequirementId] = useState("");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [workflowRunsByTaskId, setWorkflowRunsByTaskId] = useState<
    Record<string, WorkflowRunWithNodes[]>
  >(initialWorkflowRunsByTaskId);
  const [requirementTitle, setRequirementTitle] = useState("");
  const [requirementBody, setRequirementBody] = useState("");
  const [selectedRequirementWorkflowId, setSelectedRequirementWorkflowId] =
    useState("");
  const [selectedTaskWorkflowId, setSelectedTaskWorkflowId] = useState("");
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
  const [isReplacingModelApiKey, setIsReplacingModelApiKey] = useState(false);
  const [agentProxyUrl, setAgentProxyUrl] = useState(
    initialExecutionSettings?.agentProxyUrl ?? ""
  );
  const [settingsStatus, setSettingsStatus] = useState<StatusMessage>({
    kind: "status",
    key: "settingsIdle"
  });

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listWorkflowFiles(),
      listRequirements(),
      listDecompositionResults(),
      listTasks(),
      getExecutionSettings()
    ])
      .then(([
        nextWorkflowFiles,
        nextRequirements,
        nextDecompositionResults,
        nextTasks,
        nextExecutionSettings
      ]) => {
        if (!cancelled) {
          setWorkflowFiles(nextWorkflowFiles);
          setRequirements(nextRequirements);
          setDecompositionResults(nextDecompositionResults);
          setEditedRequirementTitles(
            Object.fromEntries(
              nextRequirements.map((requirement) => [
                requirement.id,
                requirement.title
              ])
            )
          );
          setTasks(nextTasks);
          setExecutionSettings(nextExecutionSettings);
          setModelProvider(nextExecutionSettings.modelProvider);
          setModelBaseUrl(nextExecutionSettings.modelBaseUrl);
          setModelName(nextExecutionSettings.modelName);
          setAgentProxyUrl(nextExecutionSettings.agentProxyUrl);
          setSelectedRequirementWorkflowId(nextWorkflowFiles[0]?.id ?? "");
          setSelectedTaskWorkflowId(
            nextWorkflowFiles.find(isTaskWorkflowTemplate)?.id ?? ""
          );
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

  useEffect(() => {
    setEditedProjectName(
      projects.find((project) => project.id === selectedProjectId)?.name ?? ""
    );
  }, [projects, selectedProjectId]);

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
      setSelectedTaskWorkflowId(result.workflowFile.id);
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
      builderNodes
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
      setSelectedTaskWorkflowId(result.workflowFile.id);
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
      setRequirementStatus({ kind: "status", key: "deletedRequirement" });
    } catch (error) {
      setRequirementStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "requirementDeletionFailed" }
      );
    }
  }

  async function handleCreateDecompositionResult(requirementId: string) {
    setRequirementStatus({ kind: "status", key: "runningRequirementWorkflow" });

    try {
      const result = await createRequirementDecompositionResult(requirementId);
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
      }
      setRequirementStatus({ kind: "status", key: "decompositionReady" });
    } catch (error) {
      setRequirementStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "requirementCreationFailed" }
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

  async function handleUpdateRequirement(
    event: FormEvent<HTMLFormElement>,
    requirementId: string
  ) {
    event.preventDefault();
    setRequirementStatus({ kind: "status", key: "savingRequirement" });

    try {
      const updatedRequirement = await updateRequirement(requirementId, {
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

  async function handleStartTaskWorkflowRun(taskId: string) {
    if (!selectedTaskWorkflowId) {
      setTaskBoardStatus({ kind: "status", key: "importTaskWorkflowFirst" });
      return;
    }

    setTaskBoardStatus({ kind: "status", key: "startingWorkflowRun" });

    try {
      const workflowRun = await startTaskWorkflowRun(
        taskId,
        selectedTaskWorkflowId
      );

      setWorkflowRunsByTaskId((currentWorkflowRuns) => ({
        ...currentWorkflowRuns,
        [taskId]: [...(currentWorkflowRuns[taskId] ?? []), workflowRun]
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
  const projectWorkflowTemplates = getVisibleWorkflowTemplates(workflowFiles).filter(
    (workflowFile) => getWorkflowTemplateType(workflowFile) === "custom"
  );
  const visibleWorkflowTemplateCount =
    defaultWorkflowTemplates.length + projectWorkflowTemplates.length;
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
    projectWorkflowTemplates.reduce(
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
                      <h3>{node?.id}</h3>
                      <div className="workflow-node-badges">
                        {card.isEntry ? (
                          <span>{t.templatePage.startNodeBadge}</span>
                        ) : null}
                        {card.isTerminal ? (
                          <span>{t.templatePage.endNodeBadge}</span>
                        ) : null}
                      </div>
                    </div>
                    <p>{node?.description ?? node?.type}</p>
                    <div className="workflow-node-meta">
                      <span>{node?.executor}</span>
                      <span>{t.templatePage.retryBudget(retryBudget)}</span>
                      <span>
                        {nodeOutputs.length > 0
                          ? nodeOutputs.map(getWorkflowNodeOutputLabel).join(", ")
                          : t.templatePage.noOutputs}
                      </span>
                    </div>
                    <div className="workflow-node-contract">
                      <span>
                        {t.templatePage.usesLabel}:{" "}
                        {getWorkflowContractValues(
                          nodeSkills,
                          t.templatePage.noOutputs
                        )}
                      </span>
                      <span>
                        {t.templatePage.nodeInputsLabel}:{" "}
                        {getWorkflowContractValues(
                          nodeInputs,
                          t.templatePage.noOutputs
                        )}
                      </span>
                      <span>
                        {t.templatePage.exitCriteriaLabel}:{" "}
                        {getWorkflowContractCountLabel(
                          exitCriteriaCount,
                          "criterion",
                          "criteria"
                        )}
                      </span>
                      <span>{t.templatePage.reviewMode(reviewMode)}</span>
                      {node?.humanReview?.required ? (
                        <span>{t.templatePage.humanReviewRequired}</span>
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
        executor: "agent:worker",
        id: `node-${currentNodes.length + 1}`,
        maxRetries: 1,
        output: `node-${currentNodes.length + 1}.md`,
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
                </label>
                <label>
                  {t.templatePage.builderExecutorLabel}
                  <input
                    minLength={1}
                    onChange={(event) =>
                      updateBuilderNode(index, { executor: event.target.value })
                    }
                    required
                    value={node.executor}
                  />
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
          const canPlanRequirement =
            ["init", "decomposition_failed"].includes(requirement.status) &&
            !projectTasks.some((task) => task.requirementId === requirement.id);
          const decompositionResult = decompositionResultByRequirementId.get(
            requirement.id
          );
          const canGenerateTasks =
            requirement.status === "ready_to_generate_tasks" &&
            decompositionResult !== undefined &&
            !projectTasks.some((task) => task.requirementId === requirement.id);

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
                  <div className="requirement-row-meta">
                    <StatusBadge tone={getNodeRunTone(requirement.status)}>
                      {t.workspace.requirementStatus[requirement.status]}
                    </StatusBadge>
                    <span>{requirement.errorMessage ?? requirement.body}</span>
                  </div>
                  <p className="form-helper">{t.workspace.requirementRenameHelp}</p>
                  <div className="requirement-row-actions">
                    {canPlanRequirement ? (
                      <button
                        className="button-secondary"
                        onClick={() =>
                          handleCreateDecompositionResult(requirement.id)
                        }
                        type="button"
                      >
                        {t.workspace.planRequirement}
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
                    <button type="submit">{t.workspace.saveRequirementName}</button>
                    <button
                      className="button-secondary"
                      onClick={() => {
                        setEditedRequirementTitles((currentTitles) => ({
                          ...currentTitles,
                          [requirement.id]: requirement.title
                        }));
                        setEditingRequirementId("");
                      }}
                      type="button"
                    >
                      {t.workspace.cancelRequirementEdit}
                    </button>
                    <button
                      className="button-danger"
                      onClick={() => handleDeleteRequirement(requirement.id)}
                      title={t.workspace.requirementDeleteHelp}
                      type="button"
                    >
                      {t.workspace.deleteRequirement}
                    </button>
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
                      {t.workspace.requirementStatus[requirement.status]}
                    </StatusBadge>
                  </div>
                  <div className="requirement-row-actions">
                    {canPlanRequirement ? (
                      <button
                        className="button-secondary"
                        onClick={() =>
                          handleCreateDecompositionResult(requirement.id)
                        }
                        type="button"
                      >
                        {t.workspace.planRequirement}
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
                        setEditingRequirementId(requirement.id);
                      }}
                      type="button"
                    >
                      {t.workspace.editRequirement}
                    </button>
                    <button
                      className="button-danger"
                      onClick={() => handleDeleteRequirement(requirement.id)}
                      title={t.workspace.requirementDeleteHelp}
                      type="button"
                    >
                      {t.workspace.deleteRequirement}
                    </button>
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
    <main className="studio-shell">
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
              <button
                className="button-secondary"
                onClick={() => handleNavigatePage("control-room")}
                type="button"
              >
                {t.nav.controlRoom}
              </button>
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
                            <strong>{t.settings.agentProxySetupTitle}</strong>
                            <span>{t.settings.agentProxySetupDescription}</span>
                            <span>{t.settings.agentProxyCliUnavailable}</span>
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
                {projectWorkflowTemplates.map((workflowFile) => {
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

      {activeWorkbenchAction === "project" ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveWorkbenchAction(null);
            }
          }}
        >
          <section
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
            <StatusMascotMessage
              className="live-note"
              status={projectStatus}
              t={t}
            />
          </section>
        </div>
      ) : null}

      {activeWorkbenchAction === "requirement" ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActiveWorkbenchAction(null);
            }
          }}
        >
          <section
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
            <StatusMascotMessage
              className="live-note"
              status={requirementStatus}
              t={t}
            />
          </section>
        </div>
      ) : null}

      {activeWorkflowTemplateDialog ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleCloseWorkflowTemplateDialog();
            }
          }}
        >
          <section
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
            <StatusMascotMessage
              className="live-note"
              status={workflowImportStatus}
              t={t}
            />
          </section>
        </div>
      ) : null}

      {selectedWorkflowPreview ? (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedPreviewWorkflowId("");
            }
          }}
        >
          <section
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
          </section>
        </div>
      ) : null}

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
                projectRequirements.map((requirement) => (
                  <article className="compact-record" key={requirement.id}>
                    <div className="record-header">
                      <div className="compact-record-main">
                        <h3>{requirement.title}</h3>
                        <div className="compact-record-meta">
                          <span className="requirement-current-status">
                            <StatusBadge tone={getNodeRunTone(requirement.status)}>
                              {t.workspace.requirementStatus[requirement.status]}
                            </StatusBadge>
                          </span>
                        </div>
                        {requirement.errorMessage ? (
                          <p>{requirement.errorMessage}</p>
                        ) : null}
                      </div>
                      <div className="compact-record-actions">
                        {(() => {
                          const decompositionResult =
                            decompositionResultByRequirementId.get(requirement.id);
                          const hasTasks = projectTasks.some(
                            (task) => task.requirementId === requirement.id
                          );

                          if (
                            ["init", "decomposition_failed"].includes(
                              requirement.status
                            ) &&
                            !hasTasks
                          ) {
                            return (
                              <button
                                className="button-secondary"
                                onClick={() =>
                                  handleCreateDecompositionResult(requirement.id)
                                }
                                type="button"
                              >
                                {t.workspace.planRequirement}
                              </button>
                            );
                          }

                          if (
                            requirement.status === "ready_to_generate_tasks" &&
                            decompositionResult &&
                            !hasTasks
                          ) {
                            return (
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
                            );
                          }

                          return null;
                        })()}
                        <button
                          className="button-danger"
                          onClick={() => handleDeleteRequirement(requirement.id)}
                          title={t.workspace.requirementDeleteHelp}
                          type="button"
                        >
                          {t.workspace.deleteRequirement}
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="work-section" aria-labelledby="task-board-heading">
            <div className="section-heading">
              <p className="studio-label">{t.workspace.taskBoardEyebrow}</p>
              <h2 id="task-board-heading">{t.workspace.taskBoardHeading}</h2>
              <p>{t.workspace.taskBoardBody}</p>
            </div>
            <StatusMascotMessage
              className="live-note"
              status={taskBoardStatus}
              t={t}
            />
            <div className="task-board" aria-label={t.workspace.taskBoardLabel}>
              {taskStatuses.map((status) => {
                const columnTasks = projectTasks.filter(
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
                                </div>
                                <StatusBadge tone={getTaskStatusTone(task.status)}>
                                  {t.taskStatus[task.status]}
                                </StatusBadge>
                              </div>
                              <div className="task-run-controls">
                                <label>
                                  {t.workspace.runWorkflowTemplateLabel}
                                  <select
                                    data-testid="task-workflow-select"
                                    disabled={taskWorkflowFiles.length === 0}
                                    onChange={(event) =>
                                      setSelectedTaskWorkflowId(
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
                                  disabled={taskWorkflowFiles.length === 0}
                                  onClick={() =>
                                    handleStartTaskWorkflowRun(task.id)
                                  }
                                  type="button"
                                >
                                  {t.workspace.startRun}
                                </button>
                              </div>
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
                                        <span>{t.workspace.workflowRun}</span>
                                        <StatusBadge
                                          tone={getNodeRunTone(
                                            run.workflowRun.status
                                          )}
                                        >
                                          {run.workflowRun.status}
                                        </StatusBadge>
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
                                              <span className="node-run-id">
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
      <footer className="studio-footer">
        <div>
          <strong>{t.footer.brand}</strong>
          <span>{t.footer.description}</span>
        </div>
        <span className="studio-footer-copyright">{t.footer.copyright}</span>
      </footer>
    </main>
  );
}
