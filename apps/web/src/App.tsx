import {
  approveTaskDraft,
  createProject,
  createRequirement,
  deleteTaskDraft,
  getServerHealth,
  importWorkflowFile,
  listRequirements,
  listProjects,
  listTaskDrafts,
  listTaskWorkflowRuns,
  listTasks,
  listWorkflowFiles,
  reorderTaskDrafts,
  startTaskWorkflowRun,
  type ArtifactStorageMode,
  type DbStrategy,
  type Project,
  type Requirement,
  type ServerHealth,
  type Task,
  type TaskDraft,
  type WorkflowRunWithNodes,
  type WorkflowFileMetadata,
  type WorkflowFile,
  updateTaskDraft
} from "@forge/sdk";
import { StatusBadge } from "@forge/ui";
import { type FormEvent, useEffect, useState } from "react";
import "./styles.css";

type ConnectionState =
  | { status: "checking"; message: string }
  | { status: "connected"; message: string; health: ServerHealth }
  | { status: "unavailable"; message: string };

type StatusTone = "neutral" | "success" | "info" | "warning" | "danger";

const taskStatusLabels = {
  done: "Done",
  in_progress: "In progress",
  todo: "To do"
} as const;

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

export function App() {
  const [connection, setConnection] = useState<ConnectionState>({
    status: "checking",
    message: "Checking server connection"
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState("");
  const [artifactStorageMode, setArtifactStorageMode] =
    useState<ArtifactStorageMode>("local-only");
  const [dbStrategy, setDbStrategy] = useState<DbStrategy>("sqlite");
  const [projectStatus, setProjectStatus] = useState(
    "No project created yet"
  );
  const [workflowSource, setWorkflowSource] = useState(defaultWorkflowSource);
  const [workflowPreview, setWorkflowPreview] = useState<WorkflowFile | null>(
    null
  );
  const [workflowFiles, setWorkflowFiles] = useState<WorkflowFileMetadata[]>([]);
  const [workflowImportStatus, setWorkflowImportStatus] = useState(
    "No workflow imported yet"
  );
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [taskDrafts, setTaskDrafts] = useState<TaskDraft[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workflowRunsByTaskId, setWorkflowRunsByTaskId] = useState<
    Record<string, WorkflowRunWithNodes[]>
  >({});
  const [requirementTitle, setRequirementTitle] = useState("");
  const [requirementBody, setRequirementBody] = useState("");
  const [selectedRequirementWorkflowId, setSelectedRequirementWorkflowId] =
    useState("");
  const [selectedTaskWorkflowId, setSelectedTaskWorkflowId] = useState("");
  const [requirementStatus, setRequirementStatus] = useState(
    "No requirement created yet"
  );
  const [taskBoardStatus, setTaskBoardStatus] = useState(
    "No Task approved yet"
  );

  useEffect(() => {
    let cancelled = false;

    getServerHealth()
      .then((health) => {
        if (!cancelled) {
          setConnection({
            status: "connected",
            message: "Server connected",
            health
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnection({
            status: "unavailable",
            message: "Server unavailable"
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      listWorkflowFiles(),
      listRequirements(),
      listTaskDrafts(),
      listTasks()
    ])
      .then(([nextWorkflowFiles, nextRequirements, nextTaskDrafts, nextTasks]) => {
        if (!cancelled) {
          setWorkflowFiles(nextWorkflowFiles);
          setRequirements(nextRequirements);
          setTaskDrafts(nextTaskDrafts);
          setTasks(nextTasks);
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
            await listTaskWorkflowRuns(task.id)
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
          setRequirementStatus("Requirement resources unavailable");
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
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjectStatus("Project list unavailable");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProjectStatus("Creating project");

    try {
      const project = await createProject({
        artifactStorageMode,
        dbStrategy,
        name: projectName
      });

      setProjects((currentProjects) => [...currentProjects, project]);
      setProjectName("");
      setProjectStatus(`Created ${project.name}`);
    } catch {
      setProjectStatus("Project creation failed");
    }
  }

  async function handleImportWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkflowImportStatus("Importing workflow file");

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
      setWorkflowImportStatus(`Imported ${result.workflowFile.name}`);
    } catch (error) {
      setWorkflowPreview(null);
      setWorkflowImportStatus(
        error instanceof Error ? error.message : "Workflow import failed"
      );
    }
  }

  async function handleCreateRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequirementStatus("Running requirement workflow");

    try {
      const result = await createRequirement({
        body: requirementBody,
        title: requirementTitle,
        workflowFileId: selectedRequirementWorkflowId
      });

      setRequirements((currentRequirements) => [
        ...currentRequirements,
        result.requirement
      ]);
      setTaskDrafts((currentTaskDrafts) => [
        ...currentTaskDrafts,
        ...result.taskDrafts
      ]);
      setRequirementTitle("");
      setRequirementBody("");
      setRequirementStatus(`Generated ${result.taskDrafts.length} task draft`);
    } catch (error) {
      setRequirementStatus(
        error instanceof Error ? error.message : "Requirement creation failed"
      );
    }
  }

  async function handleUpdateTaskDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const id = String(new FormData(form).get("id") ?? "");
    const title = String(new FormData(form).get("title") ?? "");
    const body = String(new FormData(form).get("body") ?? "");

    setTaskBoardStatus("Updating Task Draft");

    try {
      const updated = await updateTaskDraft(id, { body, title });

      setTaskDrafts((currentTaskDrafts) =>
        currentTaskDrafts.map((taskDraft) =>
          taskDraft.id === updated.id ? updated : taskDraft
        )
      );
      setTaskBoardStatus(`Updated ${updated.title}`);
    } catch (error) {
      setTaskBoardStatus(
        error instanceof Error ? error.message : "Task Draft update failed"
      );
    }
  }

  async function handleDeleteTaskDraft(id: string) {
    setTaskBoardStatus("Deleting Task Draft");

    try {
      await deleteTaskDraft(id);
      setTaskDrafts((currentTaskDrafts) =>
        currentTaskDrafts.filter((taskDraft) => taskDraft.id !== id)
      );
      setTaskBoardStatus("Deleted Task Draft");
    } catch (error) {
      setTaskBoardStatus(
        error instanceof Error ? error.message : "Task Draft deletion failed"
      );
    }
  }

  async function handleMoveTaskDraft(id: string, direction: -1 | 1) {
    const sortedDrafts = [...taskDrafts].sort(
      (left, right) => left.sortOrder - right.sortOrder
    );
    const currentIndex = sortedDrafts.findIndex((taskDraft) => taskDraft.id === id);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sortedDrafts.length) {
      return;
    }

    const nextDrafts = [...sortedDrafts];
    const [movedDraft] = nextDrafts.splice(currentIndex, 1);

    nextDrafts.splice(targetIndex, 0, movedDraft);
    setTaskBoardStatus("Reordering Task Drafts");

    try {
      const reorderedDrafts = await reorderTaskDrafts(
        nextDrafts.map((taskDraft, index) => ({
          id: taskDraft.id,
          sortOrder: index
        }))
      );

      setTaskDrafts(reorderedDrafts);
      setTaskBoardStatus("Reordered Task Drafts");
    } catch (error) {
      setTaskBoardStatus(
        error instanceof Error ? error.message : "Task Draft reorder failed"
      );
    }
  }

  async function handleApproveTaskDraft(id: string) {
    setTaskBoardStatus("Approving Task Draft");

    try {
      const task = await approveTaskDraft(id);

      setTaskDrafts((currentTaskDrafts) =>
        currentTaskDrafts.filter((taskDraft) => taskDraft.id !== id)
      );
      setTasks((currentTasks) => [...currentTasks, task]);
      setWorkflowRunsByTaskId((currentWorkflowRuns) => ({
        ...currentWorkflowRuns,
        [task.id]: []
      }));
      setTaskBoardStatus(`Approved ${task.title}`);
    } catch (error) {
      setTaskBoardStatus(
        error instanceof Error ? error.message : "Task Draft approval failed"
      );
    }
  }

  const requirementWorkflowFiles = workflowFiles.filter(
    (workflowFile) => workflowFile.scope === "requirement"
  );
  const taskWorkflowFiles = workflowFiles.filter(
    (workflowFile) => workflowFile.scope === "task"
  );
  const taskStatuses = ["todo", "in_progress", "done"] as const;

  async function handleStartTaskWorkflowRun(taskId: string) {
    if (!selectedTaskWorkflowId) {
      setTaskBoardStatus("Import a task .wf first");
      return;
    }

    setTaskBoardStatus("Starting Workflow Run");

    try {
      const workflowRun = await startTaskWorkflowRun(
        taskId,
        selectedTaskWorkflowId
      );

      setWorkflowRunsByTaskId((currentWorkflowRuns) => ({
        ...currentWorkflowRuns,
        [taskId]: [...(currentWorkflowRuns[taskId] ?? []), workflowRun]
      }));
      setTaskBoardStatus(`Workflow Run ${workflowRun.workflowRun.status}`);
    } catch (error) {
      setTaskBoardStatus(
        error instanceof Error ? error.message : "Workflow Run failed"
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
      projectStatus
    ].find((message) => !message.startsWith("No ")) ?? "Ready";
  const summaryMetrics = [
    ["Projects", projects.length],
    ["Workflow Files", workflowFiles.length],
    ["Requirements", requirements.length],
    ["Task Drafts", taskDrafts.length],
    ["Tasks", tasks.length],
    ["Workflow Runs", workflowRunCount]
  ] as const;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img
            alt="Forge forging cat brand mark"
            className="brand-logo"
            height="64"
            src="/brand/forge-cat-logo-256.png"
            width="64"
          />
          <div>
            <p className="eyebrow">Forge local development</p>
            <h1>Forge Control Room</h1>
            <p className="topbar-copy">
              AI work orchestration control plane for Requirements, Workflow
              Files, Tasks and Workflow Runs.
            </p>
          </div>
        </div>
        <div className="topbar-status" aria-live="polite">
          <StatusBadge
            tone={connection.status === "connected" ? "success" : "neutral"}
          >
            {connection.message}
          </StatusBadge>
          {connection.status === "connected" ? (
            <span className="health-detail">
              {connection.health.service} is {connection.health.status}
            </span>
          ) : null}
          <span className="action-status">{latestStatusMessage}</span>
        </div>
      </header>

      <section className="metric-strip" aria-label="Control Room summary">
        {summaryMetrics.map(([label, value]) => (
          <div className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <div className="workspace-grid">
        <aside className="setup-rail" aria-label="Project and workflow setup">
          <section className="rail-card" aria-labelledby="project-heading">
            <div className="section-kicker">01</div>
            <div className="rail-card-header">
              <p className="eyebrow">Project setup</p>
              <h2 id="project-heading">Create a Project</h2>
              <p className="panel-copy">
                Choose the Artifact Storage Mode and database strategy for this
                Forge Project.
              </p>
            </div>
            <form className="stack-form" onSubmit={handleCreateProject}>
              <label>
                Project name
                <input
                  data-testid="project-name-input"
                  minLength={1}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Forge workspace"
                  required
                  value={projectName}
                />
              </label>
              <label>
                Artifact storage
                <select
                  data-testid="artifact-storage-select"
                  onChange={(event) =>
                    setArtifactStorageMode(
                      event.target.value as ArtifactStorageMode
                    )
                  }
                  value={artifactStorageMode}
                >
                  <option value="local-only">Local-only</option>
                  <option value="cloud">Cloud</option>
                </select>
              </label>
              <label>
                Database strategy
                <select
                  data-testid="db-strategy-select"
                  onChange={(event) =>
                    setDbStrategy(event.target.value as DbStrategy)
                  }
                  value={dbStrategy}
                >
                  <option value="sqlite">SQLite</option>
                  <option value="postgres">Postgres</option>
                  <option value="mysql">MySQL</option>
                </select>
              </label>
              <button type="submit">Create Project</button>
            </form>
            <p className="project-status" aria-live="polite">
              {projectStatus}
            </p>
            <div className="compact-list" aria-label="Projects">
              {projects.length === 0 ? (
                <p className="empty-state">
                  Projects will appear here after creation.
                </p>
              ) : (
                projects.map((project) => (
                  <article className="compact-record" key={project.id}>
                    <h3>{project.name}</h3>
                    <p>
                      {project.artifactStorageMode} / {project.dbStrategy}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rail-card" aria-labelledby="workflow-heading">
            <div className="section-kicker">02</div>
            <div className="rail-card-header">
              <p className="eyebrow">Workflow File</p>
              <h2 id="workflow-heading">Import .wf</h2>
              <p className="panel-copy">
                Validate DAG dependencies, Workflow Node exits and retry limits
                before creating runnable templates.
              </p>
            </div>
            <form className="stack-form" onSubmit={handleImportWorkflow}>
              <label>
                .wf source
                <textarea
                  className="code-editor"
                  data-testid="workflow-source-textarea"
                  onChange={(event) => setWorkflowSource(event.target.value)}
                  spellCheck={false}
                  value={workflowSource}
                />
              </label>
              <button type="submit">Import Workflow File</button>
            </form>
            <p className="project-status" aria-live="polite">
              {workflowImportStatus}
            </p>
          </section>

          <section className="rail-card" aria-labelledby="requirement-heading">
            <div className="section-kicker">03</div>
            <div className="rail-card-header">
              <p className="eyebrow">Requirement intake</p>
              <h2 id="requirement-heading">Generate Task Drafts</h2>
              <p className="panel-copy">
                Run a Requirement Workflow Template and review the generated
                Task Drafts before board approval.
              </p>
            </div>
            <form className="stack-form" onSubmit={handleCreateRequirement}>
              <label>
                Requirement title
                <input
                  data-testid="requirement-title-input"
                  minLength={1}
                  onChange={(event) => setRequirementTitle(event.target.value)}
                  placeholder="Plan Forge dogfooding"
                  required
                  value={requirementTitle}
                />
              </label>
              <label>
                Requirement body
                <textarea
                  className="large-input"
                  data-testid="requirement-body-textarea"
                  onChange={(event) => setRequirementBody(event.target.value)}
                  placeholder="Describe the desired outcome"
                  required
                  value={requirementBody}
                />
              </label>
              <label>
                Requirement workflow
                <select
                  data-testid="requirement-workflow-select"
                  disabled={requirementWorkflowFiles.length === 0}
                  onChange={(event) =>
                    setSelectedRequirementWorkflowId(event.target.value)
                  }
                  required
                  value={selectedRequirementWorkflowId}
                >
                  {requirementWorkflowFiles.length === 0 ? (
                    <option value="">Import a requirement .wf first</option>
                  ) : null}
                  {requirementWorkflowFiles.map((workflowFile) => (
                    <option key={workflowFile.id} value={workflowFile.id}>
                      {workflowFile.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={requirementWorkflowFiles.length === 0}
                type="submit"
              >
                Run Requirement Workflow
              </button>
            </form>
            <p className="project-status" aria-live="polite">
              {requirementStatus}
            </p>
          </section>
        </aside>

        <section className="control-room" aria-labelledby="control-room-heading">
          <div className="control-room-header">
            <div>
              <p className="eyebrow">Control Room</p>
              <h2 id="control-room-heading">Workflow execution surface</h2>
            </div>
            <StatusBadge tone={workflowRunCount > 0 ? "info" : "neutral"}>
              {workflowRunCount > 0
                ? `${workflowRunCount} Workflow Run`
                : "No Workflow Runs"}
            </StatusBadge>
          </div>

          <section className="panel" aria-label="Workflow File preview">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Workflow File preview</p>
                <h2>Template structure</h2>
              </div>
              {workflowPreview ? (
                <StatusBadge tone="info">
                  {workflowPreview.nodes.length} Workflow Nodes
                </StatusBadge>
              ) : (
                <StatusBadge>Awaiting import</StatusBadge>
              )}
            </div>
            <div className="panel-body">
              {workflowPreview ? (
                <div className="workflow-preview">
                  <div className="workflow-summary">
                    <div>
                      <h3>{workflowPreview.name}</h3>
                      <p>
                        Scope {workflowPreview.scope} / Nodes{" "}
                        {workflowPreview.nodes.length}
                      </p>
                    </div>
                  </div>
                  <div className="workflow-node-list">
                    {workflowPreview.nodes.map((node, index) => (
                      <article className="workflow-node" key={node.id}>
                        <div className="node-index">{index + 1}</div>
                        <div className="node-main">
                          <h3>{node.id}</h3>
                          <p>{node.type}</p>
                        </div>
                        <div className="node-meta">
                          <span>{node.executor}</span>
                          <span>Retries {node.exit.maxRetries}</span>
                          <span>
                            Depends{" "}
                            {node.dependsOn.length > 0
                              ? node.dependsOn.join(", ")
                              : "none"}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="empty-state">
                  Import a Workflow File from the left rail to inspect nodes,
                  executors, dependencies and Exit Criteria.
                </p>
              )}
            </div>
          </section>

          <section className="panel" aria-label="Requirement records">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Requirements</p>
                <h2>Accepted intake</h2>
              </div>
              <StatusBadge tone={requirements.length > 0 ? "info" : "neutral"}>
                {requirements.length} total
              </StatusBadge>
            </div>
            <div className="panel-body">
              <div className="record-grid">
                {requirements.length === 0 ? (
                  <p className="empty-state">
                    Requirements will appear after a Requirement Workflow
                    generates Task Drafts.
                  </p>
                ) : (
                  requirements.map((requirement) => (
                    <article className="record-card" key={requirement.id}>
                      <div>
                        <h3>{requirement.title}</h3>
                        <p>
                          {requirement.errorMessage
                            ? requirement.errorMessage
                            : "No error reported"}
                        </p>
                      </div>
                      <StatusBadge tone={getNodeRunTone(requirement.status)}>
                        {requirement.status}
                      </StatusBadge>
                    </article>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="panel" aria-label="Task Draft review queue">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Task Draft Review Queue</p>
                <h2>Approve executable work</h2>
              </div>
              <StatusBadge tone={taskDrafts.length > 0 ? "warning" : "neutral"}>
                {taskDrafts.length} waiting
              </StatusBadge>
            </div>
            <div className="panel-body">
              <div className="draft-list">
                {taskDrafts.length === 0 ? (
                  <p className="empty-state">
                    Run a Requirement Workflow to generate editable Task Drafts
                    for review.
                  </p>
                ) : (
                  taskDrafts
                    .slice()
                    .sort((left, right) => left.sortOrder - right.sortOrder)
                    .map((taskDraft) => (
                      <article className="draft-card" key={taskDraft.id}>
                        <form
                          className="draft-form"
                          onSubmit={handleUpdateTaskDraft}
                        >
                          <input name="id" type="hidden" value={taskDraft.id} />
                          <label>
                            Draft title
                            <input
                              defaultValue={taskDraft.title}
                              data-testid="draft-title-input"
                              name="title"
                              required
                            />
                          </label>
                          <label>
                            Draft body
                            <textarea
                              className="large-input"
                              defaultValue={taskDraft.body}
                              data-testid="draft-body-textarea"
                              name="body"
                              required
                            />
                          </label>
                          <div className="draft-actions">
                            <button className="button-secondary" type="submit">
                              Save
                            </button>
                            <button
                              className="button-secondary"
                              onClick={() =>
                                handleMoveTaskDraft(taskDraft.id, -1)
                              }
                              type="button"
                            >
                              Up
                            </button>
                            <button
                              className="button-secondary"
                              onClick={() =>
                                handleMoveTaskDraft(taskDraft.id, 1)
                              }
                              type="button"
                            >
                              Down
                            </button>
                            <button
                              className="button-danger"
                              onClick={() =>
                                handleDeleteTaskDraft(taskDraft.id)
                              }
                              type="button"
                            >
                              Delete
                            </button>
                            <button
                              className="button-primary"
                              onClick={() =>
                                handleApproveTaskDraft(taskDraft.id)
                              }
                              type="button"
                            >
                              Approve
                            </button>
                          </div>
                        </form>
                      </article>
                    ))
                )}
              </div>
            </div>
          </section>

          <section className="panel" aria-labelledby="task-board-heading">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Task Board</p>
                <h2 id="task-board-heading">Approved Tasks</h2>
                <p className="panel-copy">
                  Approved Task Drafts become executable Tasks while preserving
                  their source Requirement.
                </p>
              </div>
              <StatusBadge tone={tasks.length > 0 ? "info" : "neutral"}>
                {tasks.length} Tasks
              </StatusBadge>
            </div>
            <p className="project-status" aria-live="polite">
              {taskBoardStatus}
            </p>
            <div className="task-board" aria-label="Task Board">
              {taskStatuses.map((status) => {
                const columnTasks = tasks.filter(
                  (task) => task.status === status
                );

                return (
                  <section className="task-column" key={status}>
                    <div className="task-column-header">
                      <h3>{taskStatusLabels[status]}</h3>
                      <span>{columnTasks.length}</span>
                    </div>
                    <div className="task-list">
                      {columnTasks.length === 0 ? (
                        <p className="empty-state">No Tasks in this lane.</p>
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
                                    Source{" "}
                                    {sourceRequirement?.title ??
                                      task.requirementId}
                                  </p>
                                </div>
                                <StatusBadge tone={getTaskStatusTone(task.status)}>
                                  {taskStatusLabels[task.status]}
                                </StatusBadge>
                              </div>
                              <div className="task-run-controls">
                                <label>
                                  Task Workflow
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
                                        Import a task .wf first
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
                                  Start Workflow Run
                                </button>
                              </div>
                              <div className="run-history">
                                {runs.length === 0 ? (
                                  <p className="empty-state">
                                    No Workflow Runs started for this Task.
                                  </p>
                                ) : (
                                  runs.map((run) => (
                                    <div
                                      className="run-group"
                                      key={run.workflowRun.id}
                                    >
                                      <div className="run-group-header">
                                        <span>Workflow Run</span>
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
      </div>
    </main>
  );
}
