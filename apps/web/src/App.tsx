import {
  createProject,
  getServerHealth,
  importWorkflowFile,
  listProjects,
  type ArtifactStorageMode,
  type DbStrategy,
  type Project,
  type ServerHealth,
  type WorkflowFile
} from "@forge/sdk";
import { StatusBadge } from "@forge/ui";
import { type FormEvent, useEffect, useState } from "react";
import "./styles.css";

type ConnectionState =
  | { status: "checking"; message: string }
  | { status: "connected"; message: string; health: ServerHealth }
  | { status: "unavailable"; message: string };

const defaultWorkflowSource = `name: Coding workflow
scope: task
nodes:
  - id: analyze
    type: requirement-analysis
    executor: skill:requirements
    outputs:
      - analysis.md
    exit:
      maxRetries: 2
  - id: implement
    type: coding
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
  const [workflowImportStatus, setWorkflowImportStatus] = useState(
    "No workflow imported yet"
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
      setWorkflowImportStatus(`Imported ${result.workflowFile.name}`);
    } catch (error) {
      setWorkflowPreview(null);
      setWorkflowImportStatus(
        error instanceof Error ? error.message : "Workflow import failed"
      );
    }
  }

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
    </main>
  );
}
