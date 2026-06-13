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
  listTasks,
  listWorkflowFiles,
  reorderTaskDrafts,
  type ArtifactStorageMode,
  type DbStrategy,
  type Project,
  type Requirement,
  type ServerHealth,
  type Task,
  type TaskDraft,
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
  const [requirementTitle, setRequirementTitle] = useState("");
  const [requirementBody, setRequirementBody] = useState("");
  const [selectedRequirementWorkflowId, setSelectedRequirementWorkflowId] =
    useState("");
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
  const taskStatuses = ["todo", "in_progress", "done"] as const;

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Forge local development</p>
        <h1>Forge</h1>
        <p className="lede">
          A TypeScript workspace for orchestrating local agent workflows.
        </p>
        <div className="status-row" aria-live="polite">
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
        </div>
      </section>
      <section className="project-panel" aria-labelledby="project-heading">
        <div>
          <p className="eyebrow">Project setup</p>
          <h2 id="project-heading">Create a Forge project</h2>
          <p className="panel-copy">
            Choose where artifacts live and which database strategy the project
            should target.
          </p>
        </div>
        <form className="project-form" onSubmit={handleCreateProject}>
          <label>
            Project name
            <input
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
              onChange={(event) =>
                setArtifactStorageMode(event.target.value as ArtifactStorageMode)
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
              onChange={(event) => setDbStrategy(event.target.value as DbStrategy)}
              value={dbStrategy}
            >
              <option value="sqlite">SQLite</option>
              <option value="postgres">Postgres</option>
              <option value="mysql">MySQL</option>
            </select>
          </label>
          <button type="submit">Create project</button>
        </form>
        <p className="project-status" aria-live="polite">
          {projectStatus}
        </p>
        <div className="project-list" aria-label="Projects">
          {projects.length === 0 ? (
            <p className="empty-state">Projects will appear here after creation.</p>
          ) : (
            projects.map((project) => (
              <article className="project-card" key={project.id}>
                <h3>{project.name}</h3>
                <p>
                  Artifacts: {project.artifactStorageMode} / DB:{" "}
                  {project.dbStrategy}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
      <section className="workflow-panel" aria-labelledby="workflow-heading">
        <div>
          <p className="eyebrow">Workflow file</p>
          <h2 id="workflow-heading">Import .wf and preview nodes</h2>
          <p className="panel-copy">
            Paste a workflow file to validate DAG dependencies, node exits and
            retry limits before creating runnable templates.
          </p>
        </div>
        <form className="workflow-form" onSubmit={handleImportWorkflow}>
          <label>
            .wf source
            <textarea
              onChange={(event) => setWorkflowSource(event.target.value)}
              spellCheck={false}
              value={workflowSource}
            />
          </label>
          <button type="submit">Import workflow</button>
        </form>
        <p className="project-status" aria-live="polite">
          {workflowImportStatus}
        </p>
        {workflowPreview ? (
          <div className="workflow-preview" aria-label="Workflow node preview">
            <div className="workflow-summary">
              <h3>{workflowPreview.name}</h3>
              <p>
                Scope: {workflowPreview.scope} / Nodes:{" "}
                {workflowPreview.nodes.length}
              </p>
            </div>
            <div className="project-list">
              {workflowPreview.nodes.map((node) => (
                <article className="project-card" key={node.id}>
                  <h3>{node.id}</h3>
                  <p>
                    {node.type} / executor: {node.executor} / max retries:{" "}
                    {node.exit.maxRetries}
                  </p>
                  <p>
                    Depends on:{" "}
                    {node.dependsOn.length > 0
                      ? node.dependsOn.join(", ")
                      : "none"}
                  </p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      <section className="workflow-panel" aria-labelledby="requirement-heading">
        <div>
          <p className="eyebrow">Requirements</p>
          <h2 id="requirement-heading">Create Requirement and draft tasks</h2>
          <p className="panel-copy">
            Select a requirement workflow and run the mock executor to generate
            editable Task Drafts.
          </p>
        </div>
        <form className="workflow-form" onSubmit={handleCreateRequirement}>
          <label>
            Requirement title
            <input
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
              onChange={(event) => setRequirementBody(event.target.value)}
              placeholder="Describe the desired outcome"
              required
              value={requirementBody}
            />
          </label>
          <label>
            Requirement workflow
            <select
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
            Run requirement workflow
          </button>
        </form>
        <p className="project-status" aria-live="polite">
          {requirementStatus}
        </p>
        <div className="workflow-preview" aria-label="Requirement results">
          <div className="workflow-summary">
            <h3>Requirements</h3>
            <p>{requirements.length} total</p>
          </div>
          <div className="project-list">
            {requirements.length === 0 ? (
              <p className="empty-state">Requirements will appear here.</p>
            ) : (
              requirements.map((requirement) => (
                <article className="project-card" key={requirement.id}>
                  <h3>{requirement.title}</h3>
                  <p>
                    Status: {requirement.status}
                    {requirement.errorMessage
                      ? ` / ${requirement.errorMessage}`
                      : ""}
                  </p>
                </article>
              ))
            )}
          </div>
          <div className="workflow-summary">
            <h3>Task Drafts</h3>
            <p>{taskDrafts.length} total</p>
          </div>
          <div className="project-list">
            {taskDrafts.length === 0 ? (
              <p className="empty-state">Task Drafts will appear here.</p>
            ) : (
              taskDrafts.map((taskDraft) => (
                <article className="project-card" key={taskDraft.id}>
                  <form
                    className="draft-form"
                    onSubmit={handleUpdateTaskDraft}
                  >
                    <input name="id" type="hidden" value={taskDraft.id} />
                    <label>
                      Draft title
                      <input
                        defaultValue={taskDraft.title}
                        name="title"
                        required
                      />
                    </label>
                    <label>
                      Draft body
                      <textarea
                        defaultValue={taskDraft.body}
                        name="body"
                        required
                      />
                    </label>
                    <div className="draft-actions">
                      <button type="submit">Save</button>
                      <button
                        onClick={() => handleMoveTaskDraft(taskDraft.id, -1)}
                        type="button"
                      >
                        Move up
                      </button>
                      <button
                        onClick={() => handleMoveTaskDraft(taskDraft.id, 1)}
                        type="button"
                      >
                        Move down
                      </button>
                      <button
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
        </div>
      </section>
      <section className="workflow-panel" aria-labelledby="task-board-heading">
        <div>
          <p className="eyebrow">Task Board</p>
          <h2 id="task-board-heading">Approved Tasks</h2>
          <p className="panel-copy">
            Approved Task Drafts become issue-like Tasks while preserving their
            source Requirement.
          </p>
        </div>
        <p className="project-status" aria-live="polite">
          {taskBoardStatus}
        </p>
        <div className="task-board" aria-label="Task Board">
          {taskStatuses.map((status) => (
            <section className="task-column" key={status}>
              <h3>{status}</h3>
              <div className="project-list">
                {tasks.filter((task) => task.status === status).length === 0 ? (
                  <p className="empty-state">No tasks</p>
                ) : (
                  tasks
                    .filter((task) => task.status === status)
                    .map((task) => {
                      const sourceRequirement = requirements.find(
                        (requirement) => requirement.id === task.requirementId
                      );

                      return (
                        <article className="project-card" key={task.id}>
                          <h3>{task.title}</h3>
                          <p>Status: {task.status}</p>
                          <p>
                            Source:{" "}
                            {sourceRequirement?.title ?? task.requirementId}
                          </p>
                        </article>
                      );
                    })
                )}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
