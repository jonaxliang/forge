import {
  approveTaskDraft,
  createProject,
  createRequirement,
  deleteRequirement,
  getExecutionSettings,
  importWorkflowFile,
  listRequirements,
  listProjects,
  listTaskWorkflowRuns,
  listTasks,
  listWorkflowFiles,
  startTaskWorkflowRun,
  updateExecutionSettings,
  type ArtifactStorageMode,
  type DbStrategy,
  type ExecutionSettings,
  type Project,
  type Requirement,
  type Task,
  type WorkflowRunWithNodes,
  type WorkflowFileMetadata,
  type WorkflowFile,
} from "@forge/sdk";
import { StatusBadge } from "@forge/ui";
import { type FormEvent, useEffect, useState } from "react";
import {
  getMessages,
  readStoredLocale,
  saveStoredLocale,
  supportedLocales,
  type Locale
} from "./i18n";
import { shouldShowModelConfigurationStatus } from "./status";
import "./styles.css";

type StatusTone = "neutral" | "success" | "info" | "warning" | "danger";
type ActivePage = "control-room" | "settings" | "workflow-templates";
type ActiveWorkbenchAction = "project" | "requirement" | null;
type SettingsSection = "basic" | "model";
type Messages = ReturnType<typeof getMessages>;
type AppProps = {
  initialExecutionSettings?: ExecutionSettings | null;
  initialPage?: ActivePage;
  initialProjects?: Project[];
  initialRequirements?: Requirement[];
  initialSettingsSection?: SettingsSection;
  initialTasks?: Task[];
  initialWorkbenchAction?: ActiveWorkbenchAction;
  initialWorkflowFiles?: WorkflowFileMetadata[];
};
type StatusMessage =
  | { kind: "status"; key: keyof Messages["status"] }
  | { kind: "named"; key: keyof Messages["namedStatus"]; name: string }
  | { kind: "count"; key: keyof Messages["countStatus"]; count: number }
  | { kind: "error"; message: string };

const idleStatusKeys = new Set<keyof Messages["status"]>([
  "projectIdle",
  "workflowIdle",
  "requirementIdle",
  "settingsIdle",
  "taskBoardIdle"
]);

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
  if (status === "done") {
    return "success";
  }
  if (status === "in_progress") {
    return "info";
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
      src="/brand/forge-cat-logo-64.png"
      width="24"
    />
  );
}

const defaultWorkflowSource = `name: Requirement split
scope: requirement
nodes:
  - id: analyze
    type: requirement-analysis
    executor: skill:requirements
    outputs:
      - analysis.md
    exit:
      maxRetries: 2
  - id: implement
    type: task-drafting
    after: analyze
    executor: skill:code
    outputs:
      - diff.patch
    exit:
      maxRetries: 1
`;

export function App({
  initialExecutionSettings = null,
  initialPage = "control-room",
  initialProjects = [],
  initialRequirements = [],
  initialSettingsSection = "basic",
  initialTasks = [],
  initialWorkbenchAction = null,
  initialWorkflowFiles = []
}: AppProps = {}) {
  const [activePage, setActivePage] = useState<ActivePage>(initialPage);
  const [activeSettingsSection, setActiveSettingsSection] =
    useState<SettingsSection>(initialSettingsSection);
  const [activeWorkbenchAction, setActiveWorkbenchAction] =
    useState<ActiveWorkbenchAction>(initialWorkbenchAction);
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialProjects[0]?.id ?? ""
  );
  const [locale, setLocale] = useState<Locale>(() =>
    readStoredLocale(typeof window === "undefined" ? undefined : window.localStorage)
  );
  const t = getMessages(locale);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [projectName, setProjectName] = useState("");
  const [artifactStorageMode, setArtifactStorageMode] =
    useState<ArtifactStorageMode>("local-only");
  const [dbStrategy, setDbStrategy] = useState<DbStrategy>("sqlite");
  const [projectStatus, setProjectStatus] = useState<StatusMessage>({
    kind: "status",
    key: "projectIdle"
  });
  const [workflowSource, setWorkflowSource] = useState(defaultWorkflowSource);
  const [workflowPreview, setWorkflowPreview] = useState<WorkflowFile | null>(
    null
  );
  const [workflowFiles, setWorkflowFiles] =
    useState<WorkflowFileMetadata[]>(initialWorkflowFiles);
  const [workflowImportStatus, setWorkflowImportStatus] =
    useState<StatusMessage>({
      kind: "status",
      key: "workflowIdle"
    });
  const [requirements, setRequirements] =
    useState<Requirement[]>(initialRequirements);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [workflowRunsByTaskId, setWorkflowRunsByTaskId] = useState<
    Record<string, WorkflowRunWithNodes[]>
  >({});
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
  const [modelBaseUrl, setModelBaseUrl] = useState(
    initialExecutionSettings?.modelBaseUrl ?? ""
  );
  const [modelName, setModelName] = useState(
    initialExecutionSettings?.modelName ?? ""
  );
  const [modelApiKey, setModelApiKey] = useState("");
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
      listTasks(),
      getExecutionSettings()
    ])
      .then(([nextWorkflowFiles, nextRequirements, nextTasks, nextExecutionSettings]) => {
        if (!cancelled) {
          setWorkflowFiles(nextWorkflowFiles);
          setRequirements(nextRequirements);
          setTasks(nextTasks);
          setExecutionSettings(nextExecutionSettings);
          setModelBaseUrl(nextExecutionSettings.modelBaseUrl);
          setModelName(nextExecutionSettings.modelName);
          setAgentProxyUrl(nextExecutionSettings.agentProxyUrl);
          setSelectedRequirementWorkflowId(
            nextWorkflowFiles.find((workflowFile) => workflowFile.scope === "requirement")
              ?.id ?? ""
          );
          setSelectedTaskWorkflowId(
            nextWorkflowFiles.find((workflowFile) => workflowFile.scope === "task")
              ?.id ?? ""
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
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    listProjects()
      .then((nextProjects) => {
        if (!cancelled) {
          setProjects(nextProjects);
          setSelectedProjectId((currentProjectId) =>
            currentProjectId || nextProjects[0]?.id || ""
          );
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
      setSelectedProjectId(project.id);
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
      if (result.workflowFile.scope === "requirement") {
        setSelectedRequirementWorkflowId(result.workflowFile.id);
      }
      if (result.workflowFile.scope === "task") {
        setSelectedTaskWorkflowId(result.workflowFile.id);
      }
      setActiveWorkbenchAction(null);
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

  async function handleCreateRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequirementStatus({
      kind: "status",
      key: "runningRequirementWorkflow"
    });

    try {
      let workflowFileId = selectedRequirementWorkflowId;

      if (!workflowFileId) {
        const result = await importWorkflowFile(defaultWorkflowSource);

        setWorkflowPreview(result.workflow);
        setWorkflowFiles((currentWorkflowFiles) => [
          ...currentWorkflowFiles,
          result.workflowFile
        ]);
        workflowFileId = result.workflowFile.id;
        setSelectedRequirementWorkflowId(workflowFileId);
      }

      const result = await createRequirement({
        body: requirementBody,
        title: requirementTitle,
        workflowFileId
      });
      setRequirements((currentRequirements) => [
        ...currentRequirements,
        result.requirement
      ]);

      const approvedTasks = await Promise.all(
        result.taskDrafts.map((taskDraft) => approveTaskDraft(taskDraft.id))
      );

      setTasks((currentTasks) => [...currentTasks, ...approvedTasks]);
      setWorkflowRunsByTaskId((currentWorkflowRuns) => ({
        ...currentWorkflowRuns,
        ...Object.fromEntries(approvedTasks.map((task) => [task.id, []]))
      }));
      setRequirementTitle("");
      setRequirementBody("");
      setActiveWorkbenchAction(null);
      setRequirementStatus(
        result.planning?.reason === "model_not_configured"
          ? { kind: "status", key: "modelNotConfigured" }
          : {
              kind: "count",
              key: "generatedTasks",
              count: approvedTasks.length
            }
      );
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

  const taskWorkflowFiles = workflowFiles.filter(
    (workflowFile) => workflowFile.scope === "task"
  );
  const taskStatuses = ["todo", "in_progress", "done"] as const;

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

  async function handleSaveExecutionSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsStatus({ kind: "status", key: "savingSettings" });

    try {
      const nextSettings = await updateExecutionSettings({
        agentProxyUrl,
        modelApiKey,
        modelBaseUrl,
        modelName,
        modelProvider: "openai-compatible"
      });

      setExecutionSettings(nextSettings);
      setModelBaseUrl(nextSettings.modelBaseUrl);
      setModelName(nextSettings.modelName);
      setAgentProxyUrl(nextSettings.agentProxyUrl);
      setModelApiKey("");
      setSettingsStatus({ kind: "status", key: "settingsSaved" });
    } catch (error) {
      setSettingsStatus(
        error instanceof Error
          ? { kind: "error", message: error.message }
          : { kind: "status", key: "settingsSaveFailed" }
      );
    }
  }

  const workflowRunCount = Object.values(workflowRunsByTaskId).reduce(
    (count, runs) => count + runs.length,
    0
  );
  const latestStatusMessage =
    [
      taskBoardStatus,
      requirementStatus,
      workflowImportStatus,
      settingsStatus,
      projectStatus
    ].find((status) => !isIdleStatus(status)) ?? {
      kind: "status",
      key: "ready"
    };
  const progressSteps = [
    [t.progress.recipes, workflowFiles.length],
    [t.progress.ideas, requirements.length],
    [t.progress.tasks, tasks.length],
    [t.progress.runs, workflowRunCount]
  ] as const;
  const activeProject =
    projects.find((project) => project.id === selectedProjectId) ??
    projects[0] ??
    null;
  const topWorkflowTemplates = workflowFiles.slice(0, 3);
  const hasProjects = projects.length > 0;
  const hasGeneratedWork =
    requirements.length > 0 ||
    tasks.length > 0 ||
    workflowRunCount > 0;
  const showControlRoomPanels = hasProjects && hasGeneratedWork;
  const isModelConfigured = executionSettings?.modelConfigured ?? false;
  const showModelConfigurationStatus = shouldShowModelConfigurationStatus({
    modelConfigured: executionSettings?.modelConfigured,
    requirementCount: requirements.length
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
  const workflowForm = (
    <form className="stack-form" onSubmit={handleImportWorkflow}>
      <label>
        {t.setup.workflowSourceLabel}
        <textarea
          className="recipe-editor"
          data-testid="workflow-source-textarea"
          onChange={(event) => setWorkflowSource(event.target.value)}
          spellCheck={false}
          value={workflowSource}
        />
      </label>
      <button type="submit">{t.setup.importRecipe}</button>
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
          <span>{t.hero.generateTaskDrafts}</span>
        </button>
      </div>
    </form>
  );

  return (
    <main className="studio-shell">
      <header className="studio-hero">
        <nav className="studio-nav" aria-label={t.nav.statusLabel}>
          <div className="brand-lockup">
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
          </div>
          <div className="nav-actions">
            <div className="project-switcher" aria-label={t.workbench.currentProject}>
              <label>
                <span>{t.workbench.currentProject}</span>
                <select
                  data-testid="project-switcher-select"
                  disabled={projects.length === 0}
                  onChange={(event) => setSelectedProjectId(event.target.value)}
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
              </label>
              <button
                className="button-secondary nav-button"
                onClick={() => {
                  setActivePage("control-room");
                  setActiveWorkbenchAction("project");
                }}
                type="button"
              >
                {t.workbench.newProject}
              </button>
            </div>
            <button
              className="button-secondary nav-button"
              onClick={() => setActivePage("workflow-templates")}
              type="button"
            >
              {t.nav.workflowTemplates}
            </button>
            <button
              className="button-secondary nav-button"
              onClick={() =>
                setActivePage((currentPage) =>
                  currentPage === "settings" || currentPage === "workflow-templates"
                    ? "control-room"
                    : "settings"
                )
              }
              type="button"
            >
              {activePage === "settings" || activePage === "workflow-templates"
                ? t.nav.controlRoom
                : t.nav.settings}
            </button>
          </div>
        </nav>

        {showModelConfigurationStatus ? (
          <button
            aria-live="polite"
            className="persistent-status-bar persistent-status-bar-danger"
            onClick={() => {
              setActiveWorkbenchAction(null);
              setActivePage("settings");
              setActiveSettingsSection("model");
            }}
            type="button"
          >
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
              <>
                <div className="workbench-grid">
                  <section className="current-project-card">
                    <div className="section-heading">
                      <p className="studio-label">{t.workbench.currentProject}</p>
                      <h3>{activeProject?.name ?? t.workbench.noActiveProject}</h3>
                    </div>
                    <div className="project-facts">
                      <span>
                        <strong>{projects.length}</strong>
                        {t.workbench.projectsCount}
                      </span>
                      <span>
                        <strong>{requirements.length}</strong>
                        {t.progress.ideas}
                      </span>
                      <span>
                        <strong>{tasks.length}</strong>
                        {t.progress.tasks}
                      </span>
                    </div>
                    <p className="live-note" aria-live="polite">
                      {getStatusMessage(t, latestStatusMessage)}
                    </p>
                  </section>

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
                </div>

              </>
            ) : (
              <div className="first-project-layout">
                <section className="first-project-card">
                  <div className="section-heading">
                    <p className="studio-label">{t.setup.workspaceEyebrow}</p>
                    <h3>{t.workbench.createFirstProject}</h3>
                    <p>{t.workbench.createFirstProjectBody}</p>
                  </div>
                  {projectForm}
                  <p className="live-note" aria-live="polite">
                    {getStatusMessage(t, projectStatus)}
                  </p>
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
                      <p className="studio-label">{t.settings.eyebrow}</p>
                      <h3 id="settings-basic-heading">
                        {t.settings.basicSectionTitle}
                      </h3>
                      <p>{t.settings.basicSectionDescription}</p>
                    </div>
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
                  <form
                    className="settings-form"
                    onSubmit={handleSaveExecutionSettings}
                  >
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
                      <div className="settings-block-stack">
                        <div className="settings-subsection">
                          <div className="section-heading">
                            <h4>{t.settings.modelApiBlockTitle}</h4>
                            <p>{t.settings.modelApiBlockDescription}</p>
                          </div>
                          <div className="settings-grid">
                            <label>
                              {t.settings.modelProviderLabel}
                              <select value="openai-compatible" disabled>
                                <option value="openai-compatible">
                                  OpenAI-compatible
                                </option>
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
                                placeholder={
                                  executionSettings?.modelConfigured
                                    ? t.settings.modelApiKeyConfigured
                                    : t.settings.modelApiKeyPlaceholder
                                }
                                type="password"
                                value={modelApiKey}
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
                        </div>
                        <div className="settings-subsection">
                          <div className="section-heading">
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
                        </div>
                      </div>
                    </section>
                    <div className="settings-actions">
                      <p className="form-helper">{t.settings.executionHelp}</p>
                      <button type="submit">
                        {t.settings.saveExecutionSettings}
                      </button>
                    </div>
                    <p className="live-note" aria-live="polite">
                      {getStatusMessage(t, settingsStatus)}
                    </p>
                  </form>
                ) : null}
              </div>
            </div>
          </section>
        ) : (
          <section
            className="workflow-templates-page"
            aria-labelledby="workflow-templates-heading"
          >
            <div className="section-heading">
              <p className="studio-label">{t.templatePage.eyebrow}</p>
              <h2 id="workflow-templates-heading">{t.templatePage.title}</h2>
              <p>{t.templatePage.description}</p>
            </div>
            <div className="template-overview-grid">
              <article className="template-stat">
                <span>{t.templatePage.totalTemplates}</span>
                <strong>{workflowFiles.length}</strong>
              </article>
              <article className="template-stat">
                <span>{t.templatePage.requirementTemplates}</span>
                <strong>
                  {
                    workflowFiles.filter(
                      (workflowFile) => workflowFile.scope === "requirement"
                    ).length
                  }
                </strong>
              </article>
              <article className="template-stat">
                <span>{t.templatePage.taskTemplates}</span>
                <strong>{taskWorkflowFiles.length}</strong>
              </article>
            </div>
            <div className="template-management-grid">
              <section className="template-import-panel">
                <div className="section-heading">
                  <p className="studio-label">{t.templatePage.importEyebrow}</p>
                  <h3>{t.templatePage.importTitle}</h3>
                  <p>{t.templatePage.importDescription}</p>
                </div>
                {workflowForm}
                <p className="live-note" aria-live="polite">
                  {getStatusMessage(t, workflowImportStatus)}
                </p>
              </section>
              <section className="template-library-panel">
                <div className="section-heading">
                  <p className="studio-label">{t.templatePage.libraryEyebrow}</p>
                  <h3>{t.templatePage.libraryTitle}</h3>
                  <p>{t.templatePage.libraryDescription}</p>
                </div>
                <div className="template-card-list">
                  {workflowFiles.length === 0 ? (
                    <div className="empty-state">
                      <h3>{t.templatePage.emptyTitle}</h3>
                      <p>{t.templatePage.emptyBody}</p>
                    </div>
                  ) : (
                    workflowFiles.map((workflowFile) => (
                      <article className="template-card" key={workflowFile.id}>
                        <div>
                          <h3>{workflowFile.name}</h3>
                          <p>
                            {t.templatePage.templateSummary(
                              workflowFile.scope,
                              workflowFile.nodeCount
                            )}
                          </p>
                        </div>
                        <span>{workflowFile.scope}</span>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
            <section className="template-preview-panel">
              <div className="section-heading">
                <p className="studio-label">{t.templatePage.previewEyebrow}</p>
                <h3>{t.templatePage.previewTitle}</h3>
                <p>{t.templatePage.previewDescription}</p>
              </div>
              {workflowPreview ? (
                <div className="workflow-node-list">
                  {workflowPreview.nodes.map((node) => (
                    <article className="workflow-node" key={node.id}>
                      <div className="node-main">
                        <h3>{node.id}</h3>
                        <p>{node.type}</p>
                      </div>
                      <div className="node-meta">
                        <span>{node.executor}</span>
                        <span>{node.exit.maxRetries} retries</span>
                        <span>
                          {node.dependsOn.length > 0
                            ? node.dependsOn.join(", ")
                            : t.workspace.noDependency}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h3>{t.templatePage.noPreviewTitle}</h3>
                  <p>{t.templatePage.noPreviewBody}</p>
                </div>
              )}
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
            <p className="live-note" aria-live="polite">
              {getStatusMessage(t, projectStatus)}
            </p>
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
            <p className="live-note" aria-live="polite">
              {getStatusMessage(t, requirementStatus)}
            </p>
          </section>
        </div>
      ) : null}

      {activePage === "control-room" && showControlRoomPanels ? (
        <>
      <section className="progress-ribbon" aria-label={t.progress.ariaLabel}>
        {progressSteps.map(([label, value]) => (
          <div className="progress-item" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        <p aria-live="polite">{getStatusMessage(t, latestStatusMessage)}</p>
      </section>

      <div className="studio-workspace">
        <section className="workspace-main" aria-label={t.workspace.generatedWorkLabel}>
          <section className="work-section" aria-labelledby="requirements-heading">
            <div className="section-heading">
              <p className="studio-label">{t.workspace.requirementsEyebrow}</p>
              <h2 id="requirements-heading">{t.workspace.requirementsHeading}</h2>
            </div>
            <div
              className="compact-list"
              aria-label={t.workspace.requirementsLabel}
            >
              {requirements.length === 0 ? (
                <p className="lane-empty">{t.workspace.noRequirements}</p>
              ) : (
                requirements.map((requirement) => (
                  <article className="compact-record" key={requirement.id}>
                    <div className="record-header">
                      <div>
                        <h3>{requirement.title}</h3>
                        <p>
                          {t.workspace.requirementStatus[requirement.status]}
                          {requirement.errorMessage
                            ? ` / ${requirement.errorMessage}`
                            : ""}
                        </p>
                      </div>
                      <button
                        className="button-danger"
                        onClick={() => handleDeleteRequirement(requirement.id)}
                        title={t.workspace.requirementDeleteHelp}
                        type="button"
                      >
                        {t.workspace.deleteRequirement}
                      </button>
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
            <p className="live-note" aria-live="polite">
              {getStatusMessage(t, taskBoardStatus)}
            </p>
            <div className="task-board" aria-label={t.workspace.taskBoardLabel}>
              {taskStatuses.map((status) => {
                const columnTasks = tasks.filter(
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
                        <p className="lane-empty">{t.workspace.noTasks}</p>
                      ) : (
                        columnTasks.map((task) => {
                          const sourceRequirement = requirements.find(
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
                                  {t.workspace.runRecipeLabel}
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
                                        {t.workspace.importTaskRecipeFirst}
                                      </option>
                                    ) : null}
                                    {taskWorkflowFiles.map((workflowFile) => (
                                      <option
                                        key={workflowFile.id}
                                        value={workflowFile.id}
                                      >
                                        {workflowFile.name}
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
                                  <p className="lane-empty">
                                    {t.workspace.noRunsForTask}
                                  </p>
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
                                              <span>{nodeRun.nodeId}</span>
                                              <strong>{nodeRun.status}</strong>
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

        <aside className="workspace-aside" aria-label={t.workspace.recipeAndHistoryLabel}>
          <section className="work-section">
            <div className="section-heading">
              <p className="studio-label">{t.workspace.recipeMapEyebrow}</p>
              <h2>{t.workspace.recipeMapHeading}</h2>
            </div>
            {workflowFiles.length > 0 ? (
              <div className="workspace-template-list">
                <div className="workspace-template-summary">
                  <strong>{t.workspace.templateCount(workflowFiles.length)}</strong>
                </div>
                <div className="compact-list">
                  {topWorkflowTemplates.map((workflowFile) => (
                    <article className="compact-record" key={workflowFile.id}>
                      <div className="record-header">
                        <div>
                          <h3>{workflowFile.name}</h3>
                          <p>
                            {t.workspace.recipeSummary(
                              workflowFile.scope,
                              workflowFile.nodeCount
                            )}
                          </p>
                        </div>
                        <span>{workflowFile.scope}</span>
                      </div>
                    </article>
                  ))}
                </div>
                <button
                  className="button-secondary"
                  onClick={() => setActivePage("workflow-templates")}
                  type="button"
                >
                  {t.workspace.moreTemplates}
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <h3>{t.workspace.noRecipePreviewTitle}</h3>
                <p>{t.templatePage.emptyBody}</p>
                <button
                  className="button-secondary"
                  onClick={() => setActivePage("workflow-templates")}
                  type="button"
                >
                  {t.workspace.moreTemplates}
                </button>
              </div>
            )}
          </section>
        </aside>
      </div>
        </>
      ) : null}
    </main>
  );
}
