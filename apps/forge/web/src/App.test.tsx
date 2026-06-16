import { parseWorkflowFile } from "@forge/core";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { getPathForPage, resolvePageFromPath } from "./App";
import { defaultWorkflowTemplates } from "./default-workflow-templates";
import { getModelSettingsForProviderChange } from "./model-settings";
import { shouldShowModelConfigurationStatus } from "./status";

describe("App workbench layout", () => {
  it("guides first-time users to create a Project before showing work forms", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Create your first Project");
    expect(markup).toContain("Project name");
    expect(markup).not.toContain("What should Forge help with?");
    expect(markup).not.toContain("Workflow template source");
    expect(markup).not.toContain("Import a Workflow File");
  });

  it("does not show downstream control room panels before a Project exists", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).not.toContain("Review queue");
    expect(markup).not.toContain("Task Board");
    expect(markup).not.toContain("Recipe map");
  });

  it("counts available Workflow templates on the home progress ribbon", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const markup = renderToStaticMarkup(
      <App
        initialProjects={[
          {
            artifactStorageMode: "local-only",
            createdAt: timestamp,
            dbStrategy: "sqlite",
            id: "proj_test",
            name: "Project",
            updatedAt: timestamp
          }
        ]}
        initialRequirements={[
          {
            body: "Check the template count.",
            createdAt: timestamp,
            deletedAt: null,
            errorMessage: null,
            id: "req_test",
            projectId: "proj_test",
            status: "init" as const,
            title: "Template count",
            updatedAt: timestamp,
            workflowFileId: "wf_requirement"
          }
        ]}
        initialWorkflowFiles={[
          {
            createdAt: timestamp,
            definition: JSON.stringify({
              name: "Project QA workflow",
              nodes: [
                {
                  dependsOn: [],
                  executor: "agent:qa",
                  exit: { maxRetries: 1 },
                  id: "qa",
                  outputs: ["qa.md"],
                  type: "quality-review"
                }
              ]
            }),
            id: "wf_project_qa",
            name: "Project QA workflow",
            nodeCount: 1,
            templateType: "custom"
          }
        ]}
      />
    );

    expect(markup).toContain("<span>Workflow templates</span>");
    expect(markup).toContain("<strong>4</strong>");
    expect(markup).not.toContain("<span>Recipes</span>");
  });

  it("puts Project switching in the top navigation instead of quick actions", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Current Project");
    expect(markup).toContain("No Project");
    expect(markup).not.toContain("Create another Project with its own storage defaults.");
  });

  it("combines new Project creation with the current Project picker", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("project-switcher-control");
    expect(markup).toContain(
      'aria-label="New Project" class="project-create-button"'
    );
    expect(markup).toContain('class="project-create-icon"');
    expect(markup).not.toContain(">New Project</button>");
  });

  it("does not repeat the active Project summary inside the workbench", () => {
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
      />
    );

    expect(markup).not.toContain("current-project-card");
    expect(markup).toContain("project-switcher");
  });

  it("keeps operational pages available in the top navigation", () => {
    const workflowTemplatesMarkup = renderToStaticMarkup(
      <App initialPage="workflow-templates" />
    );
    const requirementsMarkup = renderToStaticMarkup(
      <App initialPage="requirements" />
    );
    const settingsMarkup = renderToStaticMarkup(<App initialPage="settings" />);

    expect(workflowTemplatesMarkup).toContain("Home");
    expect(workflowTemplatesMarkup).not.toContain(">Run console</button>");
    expect(workflowTemplatesMarkup).toContain("Requirements");
    expect(workflowTemplatesMarkup).toContain(
      'aria-current="page" class="button-secondary nav-button" type="button">Workflow templates'
    );
    expect(workflowTemplatesMarkup).toContain("Settings");
    expect(settingsMarkup).toContain("Home");
    expect(settingsMarkup).toContain("Requirements");
    expect(settingsMarkup).toContain("Workflow templates");
    expect(requirementsMarkup).toContain(
      'aria-current="page" class="button-secondary nav-button" type="button">Requirements'
    );
  });

  it("presents Settings as a top-right gear control", () => {
    const homeMarkup = renderToStaticMarkup(<App />);
    const settingsMarkup = renderToStaticMarkup(<App initialPage="settings" />);

    expect(homeMarkup).toContain('aria-label="Settings"');
    expect(homeMarkup).toContain('class="button-secondary settings-icon-button"');
    expect(homeMarkup).toContain('class="settings-gear-icon"');
    expect(homeMarkup).not.toContain(">Settings</button>");
    expect(settingsMarkup).toContain(
      'aria-current="page" aria-label="Settings" class="button-secondary settings-icon-button"'
    );
  });

  it("leads the home shell with Forge Studio and keeps the value line secondary", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("<h1>Forge Studio</h1>");
    expect(markup).toContain(
      '<p class="brand-tagline">Turn an idea into shipped AI work.</p>'
    );
    expect(markup).not.toContain("<h1>Turn an idea into shipped AI work.</h1>");
  });

  it("links the top-left brand lockup to the home page", () => {
    const markup = renderToStaticMarkup(<App initialPage="settings" />);

    expect(markup).toContain(
      '<a class="brand-lockup" aria-label="Home" href="/">'
    );
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

  it("shows the active Project name editor in basic settings", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="settings"
        initialProjects={[
          {
            artifactStorageMode: "local-only",
            createdAt: "2026-06-14T00:00:00.000Z",
            dbStrategy: "sqlite",
            id: "proj_test",
            name: "Forge Ops",
            updatedAt: "2026-06-14T00:00:00.000Z"
          }
        ]}
      />
    );

    expect(markup).toContain("Project name");
    expect(markup).toContain('value="Forge Ops"');
    expect(markup).toContain("Save Project name");
  });

  it("does not repeat the settings page eyebrow inside the active settings panel", () => {
    const markup = renderToStaticMarkup(<App initialPage="settings" />);

    expect(markup.match(/Workspace preferences/g) ?? []).toHaveLength(1);
  });

  it("keeps workflow template summaries out of the home workspace", () => {
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
            projectId: "proj_test",
            status: "init",
            title: "Requirement",
            updatedAt: "2026-06-14T00:00:00.000Z",
            workflowFileId: "wf_1"
          }
        ]}
        initialWorkflowFiles={[
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "Requirement split",
              scope: "requirement",
              nodes: [
                {
                  dependsOn: [],
                  executor: "skill:requirements",
                  exit: { maxRetries: 1 },
                  id: "split",
                  outputs: ["tasks.md"],
                  type: "task-drafting"
                }
              ],
            }),
            id: "wf_1",
            name: "Requirement split",
            nodeCount: 2,
          },
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "Task run",
              nodes: [
                {
                  dependsOn: [],
                  executor: "agent:coder",
                  exit: { maxRetries: 1 },
                  id: "code",
                  outputs: ["diff.patch"],
                  type: "code-change"
                }
              ],
            }),
            id: "wf_2",
            name: "Task run",
            nodeCount: 3,
          },
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "Review",
              nodes: [
                {
                  dependsOn: [],
                  executor: "agent:reviewer",
                  exit: { maxRetries: 1 },
                  id: "review",
                  outputs: ["review.md"],
                  type: "human-review"
                }
              ],
            }),
            id: "wf_3",
            name: "Review",
            nodeCount: 1,
          },
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "Deploy",
              nodes: [
                {
                  dependsOn: [],
                  executor: "agent:deployer",
                  exit: { maxRetries: 1 },
                  id: "deploy",
                  outputs: ["release.md"],
                  type: "deployment"
                }
              ],
            }),
            id: "wf_4",
            name: "Deploy",
            nodeCount: 4,
          },
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "Hidden fourth",
              nodes: [
                {
                  dependsOn: [],
                  executor: "agent:writer",
                  exit: { maxRetries: 1 },
                  id: "draft",
                  outputs: ["draft.md"],
                  type: "writing-draft"
                }
              ],
            }),
            id: "wf_5",
            name: "Hidden fourth",
            nodeCount: 5,
          }
        ]}
      />
    );

    expect(markup).not.toContain("Template list");
    expect(markup).not.toContain("workspace-template-section");
    expect(markup).not.toContain("需求拆解模板");
    expect(markup).not.toContain("Deploy");
    expect(markup).not.toContain("Hidden fourth");
    expect(markup).toContain("studio-footer");
    expect(markup).toContain("AI work orchestration control plane");
    expect(markup).toContain("@2026 Forge");
    expect(markup).not.toContain(">requirement<");
  });

  it("does not replace the removed home template list with an empty state", () => {
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
            projectId: "proj_test",
            status: "init",
            title: "Requirement",
            updatedAt: "2026-06-14T00:00:00.000Z",
            workflowFileId: "wf_requirement"
          }
        ]}
        initialWorkflowFiles={[
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "Requirement split",
              nodes: [
                {
                  dependsOn: [],
                  executor: "skill:requirements",
                  exit: { maxRetries: 1 },
                  id: "split",
                  outputs: ["tasks.md"],
                  type: "task-drafting"
                }
              ],
            }),
            id: "wf_requirement",
            name: "Requirement split",
            nodeCount: 2,
          },
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "Research Analysis",
              nodes: [
                {
                  dependsOn: [],
                  executor: "skill:research",
                  exit: { maxRetries: 1 },
                  id: "analyze",
                  outputs: ["analysis.md"],
                  type: "research-analysis"
                }
              ],
            }),
            id: "wf_research",
            name: "Research Analysis",
            nodeCount: 3,
          },
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "自主测试任务完成",
              nodes: [
                {
                  dependsOn: [],
                  executor: "agent:autonomous-test-agent",
                  exit: { maxRetries: 1 },
                  id: "write_travel_guide",
                  outputs: ["travel-guide.md"],
                  type: "coding"
                }
              ],
            }),
            id: "wf_travel",
            name: "自主测试任务完成",
            nodeCount: 1,
          }
        ]}
      />
    );

    expect(markup).not.toContain("Template list");
    expect(markup).not.toContain("workspace-template-section");
    expect(markup).not.toContain("需求拆解模板");
    expect(markup).not.toContain("调研分析模板");
    expect(markup).not.toContain("旅行指南编写测试模板");
    expect(markup).not.toContain("No recipe preview");
    expect(markup).toContain("studio-footer");
  });

  it("places the general footer below the Task Board", () => {
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
            projectId: "proj_test",
            status: "init",
            title: "Requirement",
            updatedAt: "2026-06-14T00:00:00.000Z",
            workflowFileId: "wf_1"
          }
        ]}
        initialWorkflowFiles={[
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: "name: Task run",
            id: "wf_1",
            name: "Task run",
            nodeCount: 3,
          }
        ]}
      />
    );

    expect(markup).not.toContain("workspace-aside");
    expect(markup).not.toContain("workspace-template-section");
    expect(markup).toContain("studio-footer");
    expect(markup.indexOf('class="task-board"')).toBeLessThan(
      markup.indexOf("studio-footer")
    );
  });

  it("keeps empty task board lanes quiet without repeating mascot artwork", () => {
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
            projectId: "proj_test",
            status: "init",
            title: "Requirement",
            updatedAt: "2026-06-14T00:00:00.000Z",
            workflowFileId: "wf_1"
          }
        ]}
      />
    );

    expect(markup).toContain("lane-empty-quiet");
    expect(markup).not.toContain("mascot-cue-lane");
  });

  it("shows Requirements as read-only records until editing starts", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const projects = [
      {
        artifactStorageMode: "local-only" as const,
        createdAt: timestamp,
        dbStrategy: "sqlite" as const,
        id: "proj_test",
        name: "Project",
        updatedAt: timestamp
      }
    ];
    const requirements = [
      {
        body: "Build the requirements page.",
        createdAt: timestamp,
        deletedAt: null,
        errorMessage: null,
        id: "req_test",
        projectId: "proj_test",
        status: "init" as const,
        title: "Requirements page",
        updatedAt: timestamp,
        workflowFileId: "wf_1"
      }
    ];
    const homeMarkup = renderToStaticMarkup(
      <App initialProjects={projects} initialRequirements={requirements} />
    );
    const pageMarkup = renderToStaticMarkup(
      <App
        initialPage="requirements"
        initialProjects={projects}
        initialRequirements={requirements}
      />
    );

    expect(homeMarkup).toContain("View all Requirements");
    expect(pageMarkup).toContain("All Requirements");
    expect(pageMarkup).toContain("<h3>Requirements page</h3>");
    expect(pageMarkup).toContain("Build the requirements page.");
    expect(pageMarkup).toContain("Edit");
    expect(pageMarkup).toContain("Delete");
    expect(pageMarkup).not.toContain('aria-label="Rename Requirements page"');
    expect(pageMarkup).not.toContain("Save name");
    expect(pageMarkup).not.toContain("No requirement created yet");
  });

  it("shows current Requirement status and task generation from the home page", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const projects = [
      {
        artifactStorageMode: "local-only" as const,
        createdAt: timestamp,
        dbStrategy: "sqlite" as const,
        id: "proj_test",
        name: "Project",
        updatedAt: timestamp
      }
    ];
    const requirements = [
      {
        body: "Turn the approved requirement into executable Tasks.",
        createdAt: timestamp,
        deletedAt: null,
        errorMessage: null,
        id: "req_ready",
        projectId: "proj_test",
        status: "ready_to_generate_tasks" as const,
        title: "Approved requirement",
        updatedAt: timestamp,
        workflowFileId: "wf_1"
      }
    ];

    const markup = renderToStaticMarkup(
      <App
        initialDecompositionResults={[
          {
            createdAt: timestamp,
            id: "dec_ready",
            items: [
              {
                body: "Create the first executable Task.",
                sortOrder: 0,
                title: "First generated Task"
              }
            ],
            projectId: "proj_test",
            requirementId: "req_ready",
            summary: "Ready to generate Tasks.",
            updatedAt: timestamp
          }
        ]}
        initialProjects={projects}
        initialRequirements={requirements}
      />
    );

    expect(markup).toContain("Current Requirement");
    expect(markup).toContain("Approved requirement");
    expect(markup).toContain('class="requirement-current-status"');
    expect(markup).toContain("Ready to generate Tasks");
    expect(markup).toContain("Generate Tasks");
    expect(markup.indexOf('class="requirement-current-status"')).toBeLessThan(
      markup.indexOf('class="compact-record-actions"')
    );
  });

  it("shows a planning action for open Requirements without generated Tasks", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const projects = [
      {
        artifactStorageMode: "local-only" as const,
        createdAt: timestamp,
        dbStrategy: "sqlite" as const,
        id: "proj_test",
        name: "Project",
        updatedAt: timestamp
      }
    ];
    const requirements = [
      {
        body: "Write a research report about LLM Wiki.",
        createdAt: timestamp,
        deletedAt: null,
        errorMessage: null,
        id: "req_test",
        projectId: "proj_test",
        status: "init" as const,
        title: "LLM Wiki research report",
        updatedAt: timestamp,
        workflowFileId: "wf_1"
      }
    ];

    const markup = renderToStaticMarkup(
      <App
        initialExecutionSettings={{
          agentProxyConfigured: false,
          agentProxyUrl: "",
          modelBaseUrl: "https://api.openai.com/v1",
          modelConfigured: true,
          modelName: "gpt-5",
          modelProvider: "openai",
          updatedAt: timestamp
        }}
        initialPage="requirements"
        initialProjects={projects}
        initialRequirements={requirements}
      />
    );

    expect(markup).toContain("Decompose Requirement");
    expect(markup).toContain("LLM Wiki research report");
  });

  it("resolves the Requirements page route", () => {
    expect(resolvePageFromPath("/requirements")).toBe("requirements");
    expect(getPathForPage("requirements")).toBe("/requirements");
  });

  it("scopes generated work to the selected Project", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const markup = renderToStaticMarkup(
      <App
        initialProjects={[
          {
            artifactStorageMode: "local-only",
            createdAt: timestamp,
            dbStrategy: "sqlite",
            id: "proj_a",
            name: "Project A",
            updatedAt: timestamp
          },
          {
            artifactStorageMode: "local-only",
            createdAt: timestamp,
            dbStrategy: "sqlite",
            id: "proj_b",
            name: "Project B",
            updatedAt: timestamp
          }
        ]}
        initialRequirements={[
          {
            body: "A body",
            createdAt: timestamp,
            deletedAt: null,
            errorMessage: null,
            id: "req_a",
            projectId: "proj_a",
            status: "init",
            title: "Project A requirement",
            updatedAt: timestamp,
            workflowFileId: "wf_1"
          },
          {
            body: "B body",
            createdAt: timestamp,
            deletedAt: null,
            errorMessage: null,
            id: "req_b",
            projectId: "proj_b",
            status: "init",
            title: "Project B requirement",
            updatedAt: timestamp,
            workflowFileId: "wf_1"
          }
        ]}
        initialTasks={[
          {
            body: "A task body",
            createdAt: timestamp,
            deletedAt: null,
            id: "tsk_a",
            projectId: "proj_a",
            requirementId: "req_a",
            status: "init",
            title: "Project A task",
            updatedAt: timestamp
          },
          {
            body: "B task body",
            createdAt: timestamp,
            deletedAt: null,
            id: "tsk_b",
            projectId: "proj_b",
            requirementId: "req_b",
            status: "init",
            title: "Project B task",
            updatedAt: timestamp
          }
        ]}
      />
    );

    expect(markup).toContain("Project A requirement");
    expect(markup).toContain("Project A task");
    expect(markup).not.toContain("Project B requirement");
    expect(markup).not.toContain("Project B task");
  });

  it("renders Node Run id and status in separate layout targets", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const markup = renderToStaticMarkup(
      <App
        initialProjects={[
          {
            artifactStorageMode: "local-only",
            createdAt: timestamp,
            dbStrategy: "sqlite",
            id: "proj_a",
            name: "Project A",
            updatedAt: timestamp
          }
        ]}
        initialRequirements={[
          {
            body: "Body",
            createdAt: timestamp,
            deletedAt: null,
            errorMessage: null,
            id: "req_a",
            projectId: "proj_a",
            status: "init",
            title: "Requirement",
            updatedAt: timestamp,
            workflowFileId: "wf_1"
          }
        ]}
        initialTasks={[
          {
            body: "Task body",
            createdAt: timestamp,
            deletedAt: null,
            id: "tsk_a",
            projectId: "proj_a",
            requirementId: "req_a",
            status: "init",
            title: "Task",
            updatedAt: timestamp
          }
        ]}
        initialWorkflowRunsByTaskId={{
          tsk_a: [
            {
              nodeRuns: [
                {
                  createdAt: timestamp,
                  dependsOn: [],
                  id: "ndr_a",
                  nodeId: "write_travel_guide",
                  sortOrder: 0,
                  status: "succeeded",
                  updatedAt: timestamp,
                  workflowRunId: "wfr_a"
                }
              ],
              workflowRun: {
                createdAt: timestamp,
                id: "wfr_a",
                status: "succeeded",
                taskId: "tsk_a",
                updatedAt: timestamp,
                workflowFileId: "wf_2"
              }
            }
          ]
        }}
      />
    );

    expect(markup).toContain('class="node-run-id"');
    expect(markup).toContain('class="node-run-status"');
  });

  it("restores the selected Project from local storage after reload", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const originalWindow = globalThis.window;
    const storage = {
      getItem: (key: string) =>
        key === "forge:selected-project-id" ? "proj_b" : null,
      removeItem: () => undefined,
      setItem: () => undefined
    };

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: storage
      }
    });

    try {
      const markup = renderToStaticMarkup(
        <App
          initialProjects={[
            {
              artifactStorageMode: "local-only",
              createdAt: timestamp,
              dbStrategy: "sqlite",
              id: "proj_a",
              name: "Project A",
              updatedAt: timestamp
            },
            {
              artifactStorageMode: "local-only",
              createdAt: timestamp,
              dbStrategy: "sqlite",
              id: "proj_b",
              name: "Project B",
              updatedAt: timestamp
            }
          ]}
          initialRequirements={[
            {
              body: "A body",
              createdAt: timestamp,
              deletedAt: null,
              errorMessage: null,
              id: "req_a",
              projectId: "proj_a",
              status: "init",
              title: "Project A requirement",
              updatedAt: timestamp,
              workflowFileId: "wf_1"
            },
            {
              body: "B body",
              createdAt: timestamp,
              deletedAt: null,
              errorMessage: null,
              id: "req_b",
              projectId: "proj_b",
              status: "init",
              title: "Project B requirement",
              updatedAt: timestamp,
              workflowFileId: "wf_1"
            }
          ]}
        />
      );

      expect(markup).toContain("Project B requirement");
      expect(markup).not.toContain("Project A requirement");
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow
      });
    }
  });

  it("offers default Workflow templates in the template manager", () => {
    const markup = renderToStaticMarkup(
      <App initialPage="workflow-templates" />
    );

    expect(markup).toContain("New Workflow");
    expect(markup).toContain("Import Workflow");
    expect(markup).toContain("Available templates");
    expect(markup).toContain("System template");
    expect(markup).toContain("代码编写模板");
    expect(markup).toContain("调研写作模板");
    expect(markup).toContain("创意写作模板");
    expect(markup).toContain("Preview");
    expect(markup).not.toContain("Use built-in template");
    expect(markup).not.toContain("Built-in templates");
    expect(markup).not.toContain("workflow-preview-graph");
    expect(markup).not.toContain("intake");
  });

  it("lists system templates together with Project-created templates", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialWorkflowFiles={[
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "Project QA workflow",
              nodes: [
                {
                  dependsOn: [],
                  executor: "agent:qa",
                  exit: { maxRetries: 1 },
                  id: "qa",
                  outputs: ["qa.md"],
                  type: "quality-review"
                }
              ]
            }),
            id: "wf_project_qa",
            name: "Project QA workflow",
            nodeCount: 1,
            templateType: "custom"
          }
        ]}
      />
    );

    expect(markup).toContain("4");
    expect(markup).toContain("<h3>代码编写模板</h3>");
    expect(markup).toContain("<h3>调研写作模板</h3>");
    expect(markup).toContain("<h3>创意写作模板</h3>");
    expect(markup).toContain("<h3>Project QA workflow</h3>");
    expect(markup).toContain("System template");
    expect(markup).toContain("Project template");
  });

  it("does not expose default Requirement decomposition templates as selectable Workflow templates", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialWorkflowTemplateDialog="new"
      />
    );

    expect(markup).not.toContain("需求拆解模板");
    expect(markup).not.toContain("调研写作拆解模板");
    expect(markup).not.toContain("创意写作拆解模板");
    expect(markup).toContain("代码编写模板");
    expect(markup).toContain("调研写作模板");
    expect(markup).toContain("创意写作模板");
  });

  it("shows stored workflow names without exposing inferred categories", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const workflowFiles = [
      {
        createdAt: timestamp,
        definition: JSON.stringify({
          name: "Requirement split",
          nodes: [
            {
              dependsOn: [],
              executor: "skill:requirements",
              exit: { maxRetries: 1 },
              id: "analyze",
              outputs: ["analysis.md"],
              type: "requirement-analysis"
            },
            {
              dependsOn: ["analyze"],
              executor: "skill:requirements",
              exit: { maxRetries: 1 },
              id: "implement",
              outputs: ["tasks.md"],
              type: "task-drafting"
            }
          ],
        }),
        id: "wf_requirement_split",
        name: "Requirement split",
        nodeCount: 2,
      },
      {
        createdAt: timestamp,
        definition: JSON.stringify({
          name: "Autonomous research plan",
          nodes: [
            {
              dependsOn: [],
              executor: "skill:research",
              exit: { maxRetries: 1 },
              id: "scope",
              outputs: ["scope.md"],
              type: "research-scope"
            },
            {
              dependsOn: ["scope"],
              executor: "agent:researcher",
              exit: { maxRetries: 1 },
              id: "compare",
              outputs: ["options.md"],
              type: "option-comparison"
            }
          ],
        }),
        id: "wf_research",
        name: "Autonomous research plan",
        nodeCount: 2,
      },
      {
        createdAt: timestamp,
        definition: JSON.stringify({
          name: "Code Implementation",
          nodes: [
            {
              dependsOn: [],
              executor: "agent:planner",
              exit: { maxRetries: 1 },
              id: "plan",
              outputs: ["plan.md"],
              type: "implementation-plan"
            },
            {
              dependsOn: ["plan"],
              executor: "agent:coder",
              exit: { maxRetries: 1 },
              id: "code",
              outputs: ["diff.patch"],
              type: "code-change"
            }
          ],
        }),
        id: "wf_code",
        name: "Code Implementation",
        nodeCount: 2,
      },
      {
        createdAt: timestamp,
        definition: JSON.stringify({
          name: "Writing Review",
          nodes: [
            {
              dependsOn: [],
              executor: "agent:writer",
              exit: { maxRetries: 1 },
              id: "draft",
              outputs: ["draft.md"],
              type: "writing-draft"
            },
            {
              dependsOn: ["draft"],
              executor: "agent:editor",
              exit: { maxRetries: 1 },
              id: "edit",
              outputs: ["edited.md"],
              type: "editorial-review"
            }
          ],
        }),
        id: "wf_writing",
        name: "Writing Review",
        nodeCount: 2,
      },
      {
        createdAt: timestamp,
        definition: JSON.stringify({
          name: "Human Approval",
          nodes: [
            {
              dependsOn: [],
              executor: "agent:reviewer",
              exit: { maxRetries: 1 },
              id: "review",
              outputs: ["review.md"],
              type: "human-review"
            },
            {
              dependsOn: ["review"],
              executor: "human:approver",
              exit: { maxRetries: 1 },
              id: "approve",
              outputs: ["approval.md"],
              type: "approval-gate"
            }
          ],
        }),
        id: "wf_approval",
        name: "Human Approval",
        nodeCount: 2,
      }
    ];

    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialWorkflowFiles={workflowFiles}
      />
    );

    expect(markup).toContain("8");
    expect(markup).not.toContain("Scope:");
    expect(markup).not.toContain("作用域");
    expect(markup).not.toContain("Business function:");
    expect(markup).toContain("<h3>Requirement split</h3>");
    expect(markup).toContain("<h3>Autonomous research plan</h3>");
    expect(markup).toContain("<h3>Code Implementation</h3>");
    expect(markup).toContain("<h3>Writing Review</h3>");
    expect(markup).toContain("<h3>Human Approval</h3>");
    expect(markup).not.toContain("<h3>Requirement planning template</h3>");
    expect(markup).not.toContain("<h3>Research analysis template</h3>");
    expect(markup).not.toContain("<h3>Code implementation template</h3>");
    expect(markup).not.toContain("<h3>Writing and editing template</h3>");
    expect(markup).not.toContain("<h3>Review and approval template</h3>");
  });

  it("filters requirement-scoped workflow files out of template management", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialWorkflowFiles={[
          {
            createdAt: timestamp,
            definition: JSON.stringify({
              name: "Requirement split",
              scope: "requirement",
              nodes: [
                {
                  dependsOn: [],
                  executor: "skill:requirements",
                  exit: { maxRetries: 1 },
                  id: "split",
                  outputs: ["tasks.md"],
                  type: "task-drafting"
                }
              ],
            }),
            id: "wf_requirement_split",
            name: "Requirement split",
            nodeCount: 2,
          },
          {
            createdAt: timestamp,
            definition: JSON.stringify({
              name: "Software Change Requirement",
              scope: "requirement",
              nodes: [
                {
                  dependsOn: [],
                  executor: "agent:analyst",
                  exit: { maxRetries: 1 },
                  id: "intake",
                  outputs: ["requirement-brief.md"],
                  type: "requirement-intake"
                },
                {
                  dependsOn: ["intake"],
                  executor: "agent:planner",
                  exit: { maxRetries: 1 },
                  id: "decompose",
                  outputs: ["decomposition-result.json"],
                  type: "requirement-decomposition"
                },
                {
                  dependsOn: ["decompose"],
                  executor: "agent:reviewer",
                  exit: { maxRetries: 1 },
                  id: "risk-review",
                  outputs: ["risk-check.md"],
                  type: "risk-review"
                },
                {
                  dependsOn: ["risk-review"],
                  executor: "agent:planner",
                  exit: { maxRetries: 1 },
                  id: "package",
                  outputs: ["approval-notes.md"],
                  type: "requirement-package"
                }
              ],
            }),
            id: "wf_software_requirement",
            name: "Software Change Requirement",
            nodeCount: 4,
          },
          {
            createdAt: timestamp,
            definition: JSON.stringify({
              name: "Software Change Requirement 2",
              scope: "requirement",
              nodes: [
                {
                  dependsOn: [],
                  executor: "agent:planner",
                  exit: { maxRetries: 1 },
                  id: "split",
                  outputs: ["tasks.md"],
                  type: "task-drafting"
                }
              ],
            }),
            id: "wf_software_requirement_2",
            name: "Software Change Requirement 2",
            nodeCount: 1,
          },
          {
            createdAt: timestamp,
            definition: JSON.stringify({
              name: "Research Analysis",
              nodes: [
                {
                  dependsOn: [],
                  executor: "skill:research",
                  exit: { maxRetries: 1 },
                  id: "analyze",
                  outputs: ["analysis.md"],
                  type: "research-analysis"
                }
              ],
            }),
            id: "wf_research",
            name: "Research Analysis",
            nodeCount: 1,
          }
        ]}
      />
    );

    expect(markup).toContain("<h3>Research Analysis</h3>");
    expect(markup).toContain("1 nodes");
    expect(markup).not.toContain("Scope:");
    expect(markup).not.toContain("Scope: requirement");
    expect(markup).not.toContain("<h3>需求拆解模板</h3>");
    expect(markup).not.toContain("<h3>Requirement split</h3>");
    expect(markup).not.toContain("<h3>Software Change Requirement</h3>");
    expect(markup).not.toContain("<h3>Software Change Requirement 2</h3>");
  });

  it("keeps autonomous test Workflow template names unchanged", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialWorkflowFiles={[
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "自主测试任务完成",
              nodes: [
                {
                  dependsOn: [],
                  executor: "agent:autonomous-test-agent",
                  exit: { maxRetries: 1 },
                  id: "write_travel_guide",
                  outputs: ["travel-guide.md"],
                  type: "coding"
                }
              ],
            }),
            id: "wf_autonomous_test",
            name: "自主测试任务完成",
            nodeCount: 1,
          }
        ]}
      />
    );

    expect(markup).toContain("<h3>自主测试任务完成</h3>");
    expect(markup).not.toContain("Scope:");
    expect(markup).not.toContain("Business function:");
    expect(markup).not.toContain("<h3>旅行指南编写测试模板</h3>");
  });

  it("keeps workflow template rows compact until editing or previewing", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialWorkflowFiles={[
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "Research Analysis",
              nodes: [
                {
                  dependsOn: [],
                  executor: "skill:research",
                  exit: { maxRetries: 1 },
                  id: "analyze",
                  outputs: ["analysis.md"],
                  type: "research-analysis"
                }
              ],
            }),
            id: "wf_research",
            name: "Research Analysis",
            nodeCount: 1,
          }
        ]}
      />
    );

    expect(markup).toContain("Research Analysis");
    expect(markup).not.toContain("Scope:");
    expect(markup).not.toContain("Business function:");
    expect(markup).toContain("1 nodes");
    expect(markup).toContain('aria-label="Edit Workflow Research Analysis"');
    expect(markup).toContain('aria-label="Preview Workflow Research Analysis"');
    expect(markup).not.toContain("Workflow name");
    expect(markup).not.toContain("workflow-preview-graph");
    expect(markup).not.toContain('role="dialog"');
  });

  it("shows rename controls for workflow templates only while editing", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialEditingWorkflowId="wf_research"
        initialWorkflowFiles={[
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "Research Analysis",
              nodes: [
                {
                  dependsOn: [],
                  executor: "skill:research",
                  exit: { maxRetries: 1 },
                  id: "analyze",
                  outputs: ["analysis.md"],
                  type: "research-analysis"
                }
              ],
            }),
            id: "wf_research",
            name: "Research Analysis",
            nodeCount: 1,
          }
        ]}
      />
    );

    expect(markup).toContain("Workflow name");
    expect(markup).toContain('aria-label="Rename Workflow Research Analysis"');
    expect(markup).toContain("Save Workflow name");
    expect(markup).toContain("Cancel");
  });

  it("maps Workflow template management to its own route path", () => {
    expect(resolvePageFromPath("/workflow-templates")).toBe("workflow-templates");
    expect(resolvePageFromPath("/settings")).toBe("settings");
    expect(resolvePageFromPath("/control-room")).toBe("control-room");
    expect(getPathForPage("workflow-templates")).toBe("/workflow-templates");
  });

  it("keeps workflow creation and import forms behind modal actions", () => {
    const markup = renderToStaticMarkup(
      <App initialPage="workflow-templates" />
    );

    expect(markup).toContain("New Workflow");
    expect(markup).toContain("Import Workflow");
    expect(markup).not.toContain("Workflow template source");
    expect(markup).not.toContain("Import Recipe");
  });

  it("opens a visual Workflow builder as the new template modal", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialWorkflowTemplateDialog="new"
      />
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('id="workflow-template-modal-heading"');
    expect(markup).toContain("New Workflow");
    expect(markup).toContain("Template name");
    expect(markup).toContain("Workflow Nodes");
    expect(markup).toContain("Node ID");
    expect(markup).toContain("Executor");
    expect(markup).toContain("Add Workflow Node");
    expect(markup).toContain("Create Workflow");
    expect(markup).not.toContain("Workflow template source");
    expect(markup).not.toContain("Built-in templates");
    expect(markup).not.toContain("调研写作拆解模板");
    expect(markup).not.toContain("创意写作拆解模板");
    expect(markup).not.toContain("default-template-card");
    expect(markup).not.toContain("Import Recipe");
  });

  it("derives default template previews from parsed workflow source", () => {
    expect(defaultWorkflowTemplates).toHaveLength(3);

    for (const template of defaultWorkflowTemplates) {
      const parsedWorkflow = parseWorkflowFile(template.source);

      expect(template.workflow).toEqual(parsedWorkflow);
      expect(parsedWorkflow.version).toBe("1.1");
      expect(parsedWorkflow.inputs.length).toBeGreaterThan(0);
      expect(parsedWorkflow.skills.length).toBeGreaterThan(0);
      expect(parsedWorkflow.agents.length).toBeGreaterThan(0);
      expect(parsedWorkflow.artifacts.length).toBeGreaterThan(0);
      expect(parsedWorkflow.nodes.length).toBeGreaterThanOrEqual(4);
      expect(
        parsedWorkflow.nodes.every((node) => node.exit.criteria.length > 0)
      ).toBe(true);
    }
  });

  it("keeps default workflow source as the single template definition", () => {
    const moduleSource = readFileSync(
      new URL("./default-workflow-templates.ts", import.meta.url),
      "utf8"
    );

    expect(moduleSource).toContain("createDefaultWorkflowTemplate");
    expect(moduleSource).not.toContain(": WorkflowFile = {");
  });

  it("previews rich Workflow template contracts", () => {
    const markup = renderToStaticMarkup(
      <App initialPage="workflow-templates" initialPreviewWorkflowId="builtin:software-change-task" />
    );

    expect(markup).toContain("Inputs");
    expect(markup).toContain("Skills");
    expect(markup).toContain("Agent Roles");
    expect(markup).toContain("Artifact Types");
    expect(markup).toContain("Exit Criteria");
    expect(markup).toContain("Review: model");
  });

  it("opens the source import Workflow form as a modal without default templates", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialWorkflowTemplateDialog="import"
      />
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('id="workflow-template-modal-heading"');
    expect(markup).toContain("Import Workflow");
    expect(markup).toContain("Workflow template source");
    expect(markup).toContain("Upload .wf");
    expect(markup).not.toContain("Built-in templates");
  });

  it("previews the selected workflow template as a node graph", () => {
    const taskWorkflow = {
      name: "Code Implementation",
      nodes: [
        {
          dependsOn: [],
          executor: "agent:planner",
          exit: { maxRetries: 1 },
          id: "plan",
          outputs: ["plan.md"],
          type: "implementation-plan"
        },
        {
          dependsOn: ["plan"],
          executor: "agent:coder",
          exit: { maxRetries: 2 },
          id: "code",
          outputs: ["diff.patch"],
          type: "code-change"
        },
        {
          dependsOn: ["plan"],
          executor: "agent:qa",
          exit: { maxRetries: 1 },
          id: "verify",
          outputs: ["verification.md"],
          type: "verification"
        },
        {
          dependsOn: ["code", "verify"],
          executor: "agent:reviewer",
          exit: { maxRetries: 1 },
          id: "handoff",
          outputs: ["summary.md"],
          type: "handoff"
        }
      ]
    };
    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialPreviewWorkflowId="wf_code"
        initialWorkflowFiles={[
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify(taskWorkflow),
            id: "wf_code",
            name: "Code Implementation",
            nodeCount: 4,
          }
        ]}
      />
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('id="workflow-preview-modal-heading"');
    expect(markup).toContain("workflow-preview-graph");
    expect(markup).toContain("workflow-dag-map");
    expect(markup).toContain("Code Implementation");
    expect(markup).toContain("Start");
    expect(markup).toContain("End");
    expect(markup).toContain("Start node");
    expect(markup).toContain("End node");
    expect(markup).toContain("plan");
    expect(markup).toContain("code");
    expect(markup).toContain("verify");
    expect(markup).toContain("handoff");
    expect(markup).toContain("plan.md");
    expect(markup).toContain("verification.md");
    expect(markup).toContain("Depends on plan");
    expect(markup).toContain("Depends on code, verify");
    expect(markup).toContain('aria-label="Start to plan"');
    expect(markup).toContain('aria-label="code to handoff"');
    expect(markup).toContain('aria-label="verify to handoff"');
    expect(markup).toContain("agent:coder");
  });

  it("does not preview requirement-scoped workflow file definitions", () => {
    const requirementWorkflow = {
      name: "Requirement Planning",
      scope: "requirement",
      nodes: [
        {
          dependsOn: [],
          executor: "agent:planner",
          exit: { maxRetries: 1 },
          id: "split",
          outputs: ["tasks.md"],
          type: "task-drafting"
        }
      ]
    };
    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialPreviewWorkflowId="wf_requirement"
        initialWorkflowFiles={[
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify(requirementWorkflow),
            id: "wf_requirement",
            name: "Requirement Planning",
            nodeCount: 1,
          }
        ]}
      />
    );

    expect(markup).not.toContain('id="workflow-preview-modal-heading"');
    expect(markup).not.toContain("workflow-preview-graph");
    expect(markup).not.toContain("Requirement Planning");
    expect(markup).not.toContain("split");
    expect(markup).not.toContain("tasks.md");
    expect(markup).not.toContain("intake");
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
    expect(markup).not.toContain("Local bridge URL");
  });

  it("renders model settings behind a secondary navigation in model settings", () => {
    const markup = renderToStaticMarkup(
      <App initialPage="settings" initialSettingsSection="model" />
    );

    expect(markup).toContain('aria-label="Model settings sections"');
    expect(markup).toContain("Local bridge");
    expect(markup).toContain("Model API");
    expect(markup).toContain("Planning plane");
    expect(markup).toContain("Requirement to Task planning");
    expect(markup).toContain("settings-model-api-panel");
    expect(markup).toContain("Model base URL");
    expect(markup).toContain("API key");
    expect(markup).not.toContain("settings-agent-proxy-panel");
    expect(markup).not.toContain("forgecli bridge bind --server");
    expect(markup).not.toContain("CLI setup is not available in this build");
    expect(markup).not.toContain("Language");
  });

  it("renders local bridge as its own secondary page in model settings", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="settings"
        initialSettingsSection="model"
        initialModelSettingsSection="local-bridge"
      />
    );

    expect(markup).toContain('aria-label="Model settings sections"');
    expect(markup).toContain("Model settings");
    expect(markup).toContain("Local bridge");
    expect(markup).toContain("Local bridge");
    expect(markup).toContain("Execution bridge");
    expect(markup).toContain("Task Workflow dispatch");
    expect(markup).toContain("settings-agent-proxy-panel");
    expect(markup).toContain("forgecli bridge bind --server");
    expect(markup).toContain("CLI setup is not available in this build");
    expect(markup).not.toContain("settings-model-api-panel");
    expect(markup).not.toContain("Model base URL");
    expect(markup).not.toContain("Language");
  });

  it("renders independent model API and local bridge actions", () => {
    const modelMarkup = renderToStaticMarkup(
      <App initialPage="settings" initialSettingsSection="model" />
    );
    const localBridgeMarkup = renderToStaticMarkup(
      <App
        initialPage="settings"
        initialSettingsSection="model"
        initialModelSettingsSection="local-bridge"
      />
    );

    expect(modelMarkup).toContain("Save model API");
    expect(modelMarkup).toContain("Test API key");
    expect(modelMarkup).not.toContain("Save local bridge");
    expect(localBridgeMarkup).toContain("Save local bridge");
    expect(localBridgeMarkup).not.toContain("Save model API");
    expect(modelMarkup).not.toContain("Save execution settings");
    expect(localBridgeMarkup).not.toContain("Save execution settings");
  });

  it("shows a masked API key value and keeps key help beside the model title", () => {
    const markup = renderToStaticMarkup(
      <App
        initialExecutionSettings={{
          agentProxyConfigured: false,
          agentProxyUrl: "",
          modelBaseUrl: "https://api.deepseek.com",
          modelConfigured: true,
          modelName: "deepseek-chat",
          modelProvider: "deepseek",
          updatedAt: "2026-06-15T00:00:00.000Z"
        }}
        initialPage="settings"
        initialSettingsSection="model"
      />
    );

    expect(markup).toContain('value="••••••••••••"');
    expect(markup).toContain('class="settings-title-helper"');
    expect(markup).not.toContain('class="form-helper">API keys are stored');
  });

  it("renders selectable mainstream model providers in model settings", () => {
    const markup = renderToStaticMarkup(
      <App initialPage="settings" initialSettingsSection="model" />
    );

    expect(markup).toContain("OpenAI");
    expect(markup).toContain("Anthropic");
    expect(markup).toContain("Google Gemini");
    expect(markup).toContain("DeepSeek");
    expect(markup).not.toContain("<select value=\"openai-compatible\" disabled");
  });

  it("updates model defaults when the selected provider changes", () => {
    expect(getModelSettingsForProviderChange("anthropic")).toEqual({
      modelBaseUrl: "https://api.anthropic.com/v1",
      modelName: "claude-sonnet-4-20250514",
      modelProvider: "anthropic"
    });
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
