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
  const progressSteps = [
    ["Recipes", workflowFiles.length],
    ["Ideas", requirements.length],
    ["Drafts", taskDrafts.length],
    ["Tasks", tasks.length],
    ["Runs", workflowRunCount]
  ] as const;

  return (
    <main className="studio-shell">
      <header className="studio-hero">
        <nav className="studio-nav" aria-label="Forge status">
          <div className="brand-lockup">
            <img
              alt="Forge brand mark"
              className="brand-logo"
              height="56"
              src="/brand/forge-cat-logo-256.png"
              width="56"
            />
            <div>
              <p className="studio-label">Forge Studio</p>
              <h1>Turn an idea into shipped AI work.</h1>
            </div>
          </div>
          <div className="connection-strip" aria-live="polite">
            <StatusBadge
              tone={connection.status === "connected" ? "success" : "neutral"}
            >
              {connection.message}
            </StatusBadge>
            {connection.status === "connected" ? (
              <span>{connection.health.service} is {connection.health.status}</span>
            ) : null}
          </div>
        </nav>

        <div className="hero-grid">
          <section className="prompt-panel" aria-labelledby="requirement-heading">
            <p className="studio-label">Start with the outcome</p>
            <h2 id="requirement-heading">
              Describe the document, code change, research note, or creative
              work you want finished.
            </h2>
            <form className="composer-form" onSubmit={handleCreateRequirement}>
              <label>
                Name this work
                <input
                  data-testid="requirement-title-input"
                  minLength={1}
                  onChange={(event) => setRequirementTitle(event.target.value)}
                  placeholder="Draft an onboarding guide"
                  required
                  value={requirementTitle}
                />
              </label>
              <label>
                What should Forge help with?
                <textarea
                  className="composer-textarea"
                  data-testid="requirement-body-textarea"
                  onChange={(event) => setRequirementBody(event.target.value)}
                  placeholder="Explain the goal, audience, constraints, files, tone, or acceptance criteria."
                  required
                  value={requirementBody}
                />
              </label>
              <div className="composer-actions">
                <label>
                  Recipe
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
                      <option value="">Import a recipe first</option>
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
                  Generate Task Drafts
                </button>
              </div>
            </form>
            <p className="live-note" aria-live="polite">
              {requirementStatus}
            </p>
          </section>

          <aside className="studio-side" aria-label="Studio setup">
            <section className="setup-panel" aria-labelledby="workflow-heading">
              <div className="section-heading">
                <p className="studio-label">Recipe</p>
                <h2 id="workflow-heading">Teach Forge the workflow</h2>
              </div>
              <form className="stack-form" onSubmit={handleImportWorkflow}>
                <label>
                  Workflow File source
                  <textarea
                    className="recipe-editor"
                    data-testid="workflow-source-textarea"
                    onChange={(event) => setWorkflowSource(event.target.value)}
                    spellCheck={false}
                    value={workflowSource}
                  />
                </label>
                <button className="button-secondary" type="submit">
                  Import Recipe
                </button>
              </form>
              <p className="live-note" aria-live="polite">
                {workflowImportStatus}
              </p>
            </section>

            <section className="setup-panel" aria-labelledby="project-heading">
              <div className="section-heading">
                <p className="studio-label">Workspace</p>
                <h2 id="project-heading">Save outputs where you want them</h2>
              </div>
              <form className="stack-form" onSubmit={handleCreateProject}>
                <label>
                  Project name
                  <input
                    data-testid="project-name-input"
                    minLength={1}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Writing and code desk"
                    required
                    value={projectName}
                  />
                </label>
                <div className="two-field-grid">
                  <label>
                    Artifacts
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
                    Database
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
                </div>
                <button className="button-secondary" type="submit">
                  Create Project
                </button>
              </form>
              <p className="live-note" aria-live="polite">
                {projectStatus}
              </p>
            </section>
          </aside>
        </div>
      </header>

      <section className="progress-ribbon" aria-label="Forge progress">
        {progressSteps.map(([label, value]) => (
          <div className="progress-item" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        <p aria-live="polite">{latestStatusMessage}</p>
      </section>

      <div className="studio-workspace">
        <section className="workspace-main" aria-label="Generated work">
          <section className="work-section" aria-label="Task Draft review queue">
            <div className="section-heading">
              <p className="studio-label">Review queue</p>
              <h2>Shape the generated Task Drafts before they become work.</h2>
            </div>
            <div className="draft-list">
              {taskDrafts.length === 0 ? (
                <div className="empty-state">
                  <h3>No Task Drafts yet</h3>
                  <p>
                    Import a recipe, describe an outcome, then Forge will draft
                    the work plan here.
                  </p>
                </div>
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
                            onClick={() => handleMoveTaskDraft(taskDraft.id, -1)}
                            type="button"
                          >
                            Move up
                          </button>
                          <button
                            className="button-secondary"
                            onClick={() => handleMoveTaskDraft(taskDraft.id, 1)}
                            type="button"
                          >
                            Move down
                          </button>
                          <button
                            className="button-danger"
                            onClick={() => handleDeleteTaskDraft(taskDraft.id)}
                            type="button"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => handleApproveTaskDraft(taskDraft.id)}
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
          </section>

          <section className="work-section" aria-labelledby="task-board-heading">
            <div className="section-heading">
              <p className="studio-label">Task Board</p>
              <h2 id="task-board-heading">Run the approved work.</h2>
              <p>
                Tasks can represent a doc draft, code change, research packet,
                or any Artifact-producing AI work.
              </p>
            </div>
            <p className="live-note" aria-live="polite">
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
                        <p className="lane-empty">No Tasks</p>
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
                                  Run recipe
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
                                        Import a task recipe first
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
                                  Start Run
                                </button>
                              </div>
                              <div className="run-history">
                                {runs.length === 0 ? (
                                  <p className="lane-empty">
                                    No runs started for this Task.
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

        <aside className="workspace-aside" aria-label="Recipe and history">
          <section className="work-section">
            <div className="section-heading">
              <p className="studio-label">Recipe map</p>
              <h2>What Forge will ask agents to do.</h2>
            </div>
            {workflowPreview ? (
              <div className="recipe-map">
                <div className="recipe-summary">
                  <h3>{workflowPreview.name}</h3>
                  <p>
                    {workflowPreview.scope} recipe with{" "}
                    {workflowPreview.nodes.length} Workflow Nodes
                  </p>
                </div>
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
                            : "No dependency"}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <h3>No recipe preview</h3>
                <p>Import a Workflow File to show its nodes here.</p>
              </div>
            )}
          </section>

          <section className="work-section">
            <div className="section-heading">
              <p className="studio-label">Project memory</p>
              <h2>Saved Projects and ideas.</h2>
            </div>
            <div className="compact-list" aria-label="Projects">
              {projects.length === 0 ? (
                <p className="lane-empty">No Projects created yet.</p>
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
            <div className="compact-list" aria-label="Requirements">
              {requirements.length === 0 ? (
                <p className="lane-empty">No ideas submitted yet.</p>
              ) : (
                requirements.map((requirement) => (
                  <article className="compact-record" key={requirement.id}>
                    <h3>{requirement.title}</h3>
                    <p>
                      {requirement.status}
                      {requirement.errorMessage
                        ? ` / ${requirement.errorMessage}`
                        : ""}
                    </p>
                  </article>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
