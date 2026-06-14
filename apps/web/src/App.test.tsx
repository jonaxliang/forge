import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { shouldShowModelConfigurationStatus } from "./status";

describe("App workbench layout", () => {
  it("guides first-time users to create a Project before showing work forms", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Create your first Project");
    expect(markup).toContain("Project name");
    expect(markup).not.toContain("What should Forge help with?");
    expect(markup).not.toContain("Workflow File source");
    expect(markup).not.toContain("Import a Workflow File");
  });

  it("does not show downstream control room panels before a Project exists", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).not.toContain("Review queue");
    expect(markup).not.toContain("Task Board");
    expect(markup).not.toContain("Recipe map");
  });

  it("puts Project switching in the top navigation instead of quick actions", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Current Project");
    expect(markup).toContain("No Project");
    expect(markup).not.toContain("Create another Project with its own storage defaults.");
  });

  it("leads the home shell with Forge Studio and keeps the value line secondary", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("<h1>Forge Studio</h1>");
    expect(markup).toContain(
      '<p class="brand-tagline">Turn an idea into shipped AI work.</p>'
    );
    expect(markup).not.toContain("<h1>Turn an idea into shipped AI work.</h1>");
  });

  it("opens New Project in a modal instead of an inline drawer", () => {
    const markup = renderToStaticMarkup(
      <App initialWorkbenchAction="project" />
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('id="project-modal-heading"');
    expect(markup).toContain("New Project");
    expect(markup).not.toContain("workbench-drawer");
  });

  it("shows a workflow template list summary with top three templates", () => {
    const markup = renderToStaticMarkup(
      <App
        initialProjects={[
          {
            artifactStorageMode: "local-only",
            createdAt: "2026-06-14T00:00:00.000Z",
            dbStrategy: "sqlite",
            id: "proj_test",
            name: "Project",
            updatedAt: "2026-06-14T00:00:00.000Z"
          }
        ]}
        initialRequirements={[
          {
            body: "Body",
            createdAt: "2026-06-14T00:00:00.000Z",
            deletedAt: null,
            errorMessage: null,
            id: "req_test",
            status: "open",
            title: "Requirement",
            updatedAt: "2026-06-14T00:00:00.000Z",
            workflowFileId: "wf_1"
          }
        ]}
        initialWorkflowFiles={[
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: "name: Requirement split",
            id: "wf_1",
            name: "Requirement split",
            nodeCount: 2,
            scope: "requirement"
          },
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: "name: Task run",
            id: "wf_2",
            name: "Task run",
            nodeCount: 3,
            scope: "task"
          },
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: "name: Review",
            id: "wf_3",
            name: "Review",
            nodeCount: 1,
            scope: "task"
          },
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: "name: Hidden fourth",
            id: "wf_4",
            name: "Hidden fourth",
            nodeCount: 4,
            scope: "requirement"
          }
        ]}
      />
    );

    expect(markup).toContain("Template list");
    expect(markup).toContain("4 templates");
    expect(markup).toContain("Requirement split");
    expect(markup).toContain("Task run");
    expect(markup).toContain("Review");
    expect(markup).not.toContain("Hidden fourth");
    expect(markup).toContain("More templates");
    expect(markup).not.toContain("Recipe map");
  });

  it("shows the model configuration warning whenever the model is missing", () => {
    const markup = renderToStaticMarkup(
      <App
        initialExecutionSettings={{
          agentProxyConfigured: false,
          agentProxyUrl: "",
          modelBaseUrl: "https://api.openai.com/v1",
          modelConfigured: false,
          modelName: "gpt-4.1-mini",
          modelProvider: "openai-compatible",
          updatedAt: "2026-06-14T00:00:00.000Z"
        }}
      />
    );

    expect(markup).toContain("persistent-status-bar-danger");
    expect(markup).toContain("Configure a model in Settings");
  });

  it("shows one settings section at a time behind a left navigation", () => {
    const markup = renderToStaticMarkup(<App initialPage="settings" />);

    expect(markup).toContain('aria-label="Settings sections"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("Basic settings");
    expect(markup).toContain("Model settings");
    expect(markup).toContain("Language");
    expect(markup).not.toContain("Model base URL");
    expect(markup).not.toContain("Local Agent proxy URL");
  });

  it("renders model API and local Agent proxy setup as two blocks in model settings", () => {
    const markup = renderToStaticMarkup(
      <App initialPage="settings" initialSettingsSection="model" />
    );

    expect(markup).toContain("Model API");
    expect(markup).toContain("Model base URL");
    expect(markup).toContain("API key");
    expect(markup).toContain("Local Agent proxy");
    expect(markup).toContain("forgecli bridge bind --server");
    expect(markup).toContain("CLI setup is not available in this build");
    expect(markup).not.toContain("Language");
  });

  it("keeps the model configuration warning visible after saved Requirements reload", () => {
    expect(
      shouldShowModelConfigurationStatus({
        modelConfigured: false,
        requirementCount: 1
      })
    ).toBe(true);
    expect(
      shouldShowModelConfigurationStatus({
        modelConfigured: true,
        requirementCount: 1
      })
    ).toBe(false);
    expect(
      shouldShowModelConfigurationStatus({
        modelConfigured: false,
        requirementCount: 0
      })
    ).toBe(true);
  });
});
