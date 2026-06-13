import {
  createProject,
  getServerHealth,
  listProjects,
  type ArtifactStorageMode,
  type DbStrategy,
  type Project,
  type ServerHealth
} from "@forge/sdk";
import { StatusBadge } from "@forge/ui";
import { type FormEvent, useEffect, useState } from "react";
import "./styles.css";

type ConnectionState =
  | { status: "checking"; message: string }
  | { status: "connected"; message: string; health: ServerHealth }
  | { status: "unavailable"; message: string };

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
    </main>
  );
}
