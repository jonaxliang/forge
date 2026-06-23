import { parseWorkflowFile } from "@forge/core";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import {
  applyRealtimeTaskEvent,
  applyRealtimeWorkflowRunEvent,
  createWorkflowSourceFromBuilder,
  getTaskRunOrder,
  getPathForPage,
  getVisibleTaskBoardTasks,
  readStoredTaskWorkflowSelections,
  resolvePageFromPath
} from "./App";
import { defaultWorkflowTemplates } from "./default-workflow-templates";
import { getModelSettingsForProviderChange } from "./model-settings";
import { shouldShowModelConfigurationStatus } from "./status";

describe("App workbench layout", () => {
  it("marks the app shell as a motion scope", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('data-motion-scope="app-shell"');
    expect(markup).toContain('class="studio-shell"');
  });

  it("marks modal panels as motion scopes", () => {
    const markup = renderToStaticMarkup(
      <App initialWorkbenchAction="project" />
    );

    expect(markup).toContain('data-motion-scope="modal-backdrop"');
    expect(markup).toContain('data-motion-scope="modal-panel"');
    expect(markup).toContain('role="dialog"');
  });

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
            definition: JSON.stringify({
              name: "Project QA workflow",
              nodes: [
                {
                  dependsOn: [],
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
            templateType: "custom",
            createdAt: timestamp
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

  it("does not duplicate the idle Project status in the creation modal", () => {
    const markup = renderToStaticMarkup(
      <App initialWorkbenchAction="project" />
    );

    expect(markup).toContain('id="project-modal-heading"');
    expect(markup.match(/No project created yet/g)).toHaveLength(1);
  });

  it("does not show the idle Requirement status in the creation modal", () => {
    const markup = renderToStaticMarkup(
      <App initialWorkbenchAction="requirement" />
    );

    expect(markup).toContain('id="requirement-modal-heading"');
    expect(markup).not.toContain("No requirement created yet");
  });

  it("does not show the idle Workflow status in template modals", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialWorkflowTemplateDialog="new"
      />
    );

    expect(markup).toContain('id="workflow-template-modal-heading"');
    expect(markup).not.toContain("No workflow imported yet");
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

  it("shows a Skill library in settings", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="settings"
        initialSettingsSection="skills"
        initialSkills={[
          {
            body: "# Code Review",
            createdAt: "2026-06-14T00:00:00.000Z",
            description: "Reviews code changes.",
            files: [{ content: "# Code Review", path: "SKILL.md" }],
            id: "skl_code_review",
            name: "Code Review",
            projectId: "proj_test",
            ref: "skill:code-review",
            sourceUrl: "https://github.com/acme/forge-skills/tree/main/code-review",
            storagePath: "/tmp/forge-skills/proj_test/code-review",
            updatedAt: "2026-06-14T00:00:00.000Z"
          }
        ]}
      />
    );

    expect(markup).toContain("Skill library");
    expect(markup).toContain("Upload zip");
    expect(markup).toContain("Import from link");
    expect(markup).toContain("View Skill");
    expect(markup).toContain("Update from source");
    expect(markup).toContain("Linked source");
    expect(markup).toContain("Delete Skill");
    expect(markup).toContain("Code Review");
    expect(markup).toContain("skill:code-review");
    expect(markup).not.toContain("Skill body");
  });

  it("shows a zip-only Skill upload modal from the upload zip action", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="settings"
        initialSettingsSection="skills"
        initialSkillUploadDialogOpen
      />
    );

    expect(markup).toContain("Skill zip");
    expect(markup).toContain("Choose zip");
    expect(markup).not.toContain("Skill source URL");
    expect(markup).not.toContain("GitHub tree, GitHub archive, raw SKILL.md, or zip URL");
    expect(markup).toContain("Confirm upload");
    expect(markup).not.toContain("Skill name");
    expect(markup).not.toContain("Skill ref");
    expect(markup).not.toContain("Skill body");
  });

  it("shows a link-only Skill import modal from the import link action", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="settings"
        initialSettingsSection="skills"
        initialSkillUploadDialogOpen
        initialSkillUploadMode="url"
      />
    );

    expect(markup).toContain("Skill source URL");
    expect(markup).toContain("GitHub tree, GitHub archive, raw SKILL.md, or zip URL");
    expect(markup).toContain("Import from link");
    expect(markup).not.toContain("Skill zip");
    expect(markup).not.toContain("Choose zip");
    expect(markup).not.toContain("Skill body");
  });

  it("shows a Skill file directory without inline preview content", () => {
    const markup = renderToStaticMarkup(
      <App
        initialSkillContentDialogOpen
        initialPage="settings"
        initialSelectedSkillId="skl_code_review"
        initialSettingsSection="skills"
        initialSkills={[
          {
            body: "# Code Review\n\nReview changes for behavioral regressions.",
            createdAt: "2026-06-14T00:00:00.000Z",
            description: "Reviews code changes.",
            files: [
              {
                content: "# Code Review\n\nReview changes for behavioral regressions.",
                path: "SKILL.md"
              },
              {
                content: "Use the repository review checklist.",
                path: "references/checklist.md"
              }
            ],
            id: "skl_code_review",
            name: "Code Review",
            projectId: "proj_test",
            ref: "skill:code-review",
            sourceUrl: null,
            storagePath: "/tmp/forge-skills/proj_test/code-review",
            updatedAt: "2026-06-14T00:00:00.000Z"
          }
        ]}
      />
    );

    expect(markup).toContain("File tree");
    expect(markup).toContain("SKILL.md");
    expect(markup).toContain("references/checklist.md");
    expect(markup).not.toContain("Review changes for behavioral regressions.");
    expect(markup).not.toContain("Use the repository review checklist.");
  });

  it("generates Workflow File Skill declarations from selected builder tools", () => {
    const source = createWorkflowSourceFromBuilder(
      "Code workflow",
      [
        {
          id: "review",
          maxRetries: 1,
          output: "review.md",
          skillRef: "skill:code-review",
          type: "code-review"
        }
      ],
      [
        {
          body: "# Code Review",
          createdAt: "2026-06-14T00:00:00.000Z",
          description: "Reviews code changes.",
          files: [{ content: "# Code Review", path: "SKILL.md" }],
          id: "skl_code_review",
          name: "Code Review",
          projectId: "proj_test",
          ref: "skill:code-review",
          sourceUrl: null,
          storagePath: "/tmp/forge-skills/proj_test/code-review",
          updatedAt: "2026-06-14T00:00:00.000Z"
        }
      ]
    );

    expect(source).toContain("skills:\n  - id: \"code-review\"\n    ref: \"skill:code-review\"");
    expect(source).toContain("uses:\n      - \"skill:code-review\"");
    expect(source).not.toContain("executor:");
    expect(source).not.toContain("agent:worker");
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
    expect(pageMarkup).not.toContain(
      '<button class="button-secondary" type="button">Home</button>'
    );
    expect(pageMarkup).not.toContain('aria-label="Rename Requirements page"');
    expect(pageMarkup).not.toContain("Save name");
    expect(pageMarkup).not.toContain("No requirement created yet");
  });

  it("shows management parameters for each Requirement", () => {
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
        body: "Implement real Requirement management.",
        createdAt: timestamp,
        deletedAt: null,
        errorMessage: null,
        id: "req_manage",
        projectId: "proj_test",
        status: "tasks_generated" as const,
        title: "Requirement management",
        updatedAt: "2026-06-15T08:30:00.000Z",
        workflowFileId: "wf_requirement"
      }
    ];

    const markup = renderToStaticMarkup(
      <App
        initialDecompositionResults={[
          {
            createdAt: timestamp,
            id: "dec_manage",
            items: [
              {
                body: "Update the Requirement list.",
                dependsOn: [],
                executorAgentBindingId: null,
                executorLabel: "Model API",
                executorType: "model-api",
                id: "item_list",
                sortOrder: 0,
                title: "Requirement list"
              },
              {
                body: "Update the Requirement editor.",
                dependsOn: [],
                executorAgentBindingId: null,
                executorLabel: "Model API",
                executorType: "model-api",
                id: "item_editor",
                sortOrder: 1,
                title: "Requirement editor"
              }
            ],
            projectId: "proj_test",
            requirementId: "req_manage",
            summary: "Two manageable Task entries.",
            updatedAt: timestamp
          }
        ]}
        initialPage="requirements"
        initialProjects={projects}
        initialRequirements={requirements}
        initialTasks={[
          {
            body: "Update the Requirement list.",
            createdAt: timestamp,
            deletedAt: null,
            dependsOn: [],
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            id: "task_list",
            projectId: "proj_test",
            requirementId: "req_manage",
            sourceItemId: "item_list",
            status: "running",
            title: "Requirement list",
            updatedAt: timestamp
          },
          {
            body: "Update the Requirement editor.",
            createdAt: timestamp,
            deletedAt: null,
            dependsOn: [],
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            id: "task_editor",
            projectId: "proj_test",
            requirementId: "req_manage",
            sourceItemId: "item_editor",
            status: "completed",
            title: "Requirement editor",
            updatedAt: timestamp
          }
        ]}
        initialWorkflowFiles={[
          {
            createdAt: timestamp,
            definition: JSON.stringify({ name: "Requirement workflow", nodes: [] }),
            id: "wf_requirement",
            name: "Requirement workflow",
            nodeCount: 2,
            templateType: "custom"
          }
        ]}
      />
    );

    expect(markup).toContain('class="requirement-management-summary"');
    expect(markup).toContain('class="requirement-management-metrics"');
    expect(markup).not.toContain("Requirement ID");
    expect(markup).not.toContain("req_manage");
    expect(markup).toContain("Project");
    expect(markup).not.toContain("Workflow File");
    expect(markup).not.toContain("Requirement workflow");
    expect(markup).toContain("Created");
    expect(markup).toContain("2026-06-14 00:00");
    expect(markup).toContain("Updated");
    expect(markup).toContain("2026-06-15 08:30");
    expect(markup).toContain("Decomposition items");
    expect(markup).toContain("2 items");
    expect(markup).toContain("Linked Tasks");
    expect(markup).toContain("2 Tasks");
    expect(markup).toContain("Next action");
    expect(markup).toContain("Track generated Tasks");
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
                dependsOn: [],
                executorAgentBindingId: null,
                executorLabel: "Model API",
                executorType: "model-api",
                id: "item_first",
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
    expect(markup).toContain('class="compact-record-main"');
    expect(markup).toContain('class="compact-record-meta-grid"');
    expect(markup).toContain('class="compact-record-meta-item"');
    expect(markup).toContain('class="compact-record-meta-label"');
    expect(markup).toContain('class="compact-record-meta-value"');
    expect(markup.indexOf('class="requirement-current-status"')).toBeLessThan(
      markup.indexOf('class="compact-record-actions"')
    );
  });

  it("opens a dialog to edit the current Requirement details from the home page", () => {
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
        body: "Keep the visible Requirement name current.",
        createdAt: timestamp,
        deletedAt: null,
        errorMessage: null,
        id: "req_current",
        projectId: "proj_test",
        status: "init" as const,
        title: "Current editable requirement",
        updatedAt: timestamp,
        workflowFileId: "wf_1"
      }
    ];

    const readOnlyMarkup = renderToStaticMarkup(
      <App initialProjects={projects} initialRequirements={requirements} />
    );
    const editingMarkup = renderToStaticMarkup(
      <App
        initialEditingRequirementId="req_current"
        initialProjects={projects}
        initialRequirements={requirements}
      />
    );

    expect(readOnlyMarkup).toContain(
      'aria-label="Edit Current editable requirement"'
    );
    expect(readOnlyMarkup).not.toContain("Rename");
    expect(editingMarkup).toContain('role="dialog"');
    expect(editingMarkup).toContain('class="modal-panel requirement-name-dialog"');
    expect(editingMarkup).not.toContain('class="compact-record-rename-form"');
    expect(editingMarkup).toContain("Requirement name");
    expect(editingMarkup).toContain('value="Current editable requirement"');
    expect(editingMarkup).toContain("Requirement description");
    expect(editingMarkup).toContain("Keep the visible Requirement name current.");
    expect(editingMarkup).toContain("Save Requirement");
    expect(editingMarkup).toContain("Cancel");
  });

  it("opens a clarification answer dialog for Requirements that need more input", () => {
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
        body: "Write an LLM Wiki material.",
        createdAt: timestamp,
        deletedAt: null,
        errorMessage:
          "Need target reader details.\n- Who is the target reader?\n- Which output format is expected?",
        id: "req_clarify",
        projectId: "proj_test",
        status: "decomposition_failed" as const,
        title: "LLM Wiki material",
        updatedAt: timestamp,
        workflowFileId: "wf_1"
      }
    ];

    const readOnlyMarkup = renderToStaticMarkup(
      <App initialProjects={projects} initialRequirements={requirements} />
    );
    const dialogMarkup = renderToStaticMarkup(
      <App
        initialClarificationRequirementId="req_clarify"
        initialProjects={projects}
        initialRequirements={requirements}
      />
    );

    expect(readOnlyMarkup).toContain("Answer questions");
    expect(readOnlyMarkup).not.toContain(">Decompose Requirement</button>");
    expect(readOnlyMarkup).toContain("Answer clarification for LLM Wiki material");
    expect(readOnlyMarkup).toContain("Need target reader details.");
    expect(dialogMarkup).toContain('class="modal-panel clarification-dialog"');
    expect(dialogMarkup).toContain("Who is the target reader?");
    expect(dialogMarkup).toContain("Which output format is expected?");
    expect(dialogMarkup).toContain("Your answers");
    expect(dialogMarkup).toContain("Submit answers and decompose");
    expect(dialogMarkup).not.toContain("Save answers");
  });

  it("shows legacy Requirement statuses instead of empty badges", () => {
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
            body: "Legacy requirement status from an existing database.",
            createdAt: timestamp,
            deletedAt: null,
            errorMessage: null,
            id: "req_legacy",
            projectId: "proj_test",
            status: "open" as never,
            title: "Legacy requirement",
            updatedAt: timestamp,
            workflowFileId: "wf_1"
          }
        ]}
      />
    );

    expect(markup).toContain('class="requirement-current-status"');
    expect(markup).toContain("Open");
    expect(markup).toContain("Decompose Requirement");
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
          defaultExecutorAgentBindingId: null,
          defaultExecutorType: "model-api",
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

  it("puts destructive Requirement actions behind a menu and confirmation copy", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const requirements = [
      {
        body: "Reset or remove this requirement.",
        createdAt: timestamp,
        deletedAt: null,
        errorMessage: null,
        id: "req_actions",
        projectId: "proj_test",
        status: "tasks_generated" as const,
        title: "Requirement actions",
        updatedAt: timestamp,
        workflowFileId: "wf_requirement"
      }
    ];

    const markup = renderToStaticMarkup(
      <App initialPage="requirements" initialRequirements={requirements} />
    );

    expect(markup).toContain('aria-label="More Requirement actions"');
    expect(markup).toContain("Reset Requirement");
    expect(markup).toContain("Delete Requirement");
    expect(markup).toContain("Reset this Requirement?");
    expect(markup).toContain("Delete this Requirement?");
  });

  it("resolves the Requirements page route", () => {
    expect(resolvePageFromPath("/requirements")).toBe("requirements");
    expect(getPathForPage("requirements")).toBe("/requirements");
  });

  it("orders Tasks for run-all by dependency before dependent work", () => {
    expect(
      getTaskRunOrder([
        { dependsOn: ["task_a"], id: "task_b" },
        { dependsOn: [], id: "task_a" },
        { dependsOn: ["task_b"], id: "task_c" }
      ])
    ).toEqual(["task_a", "task_b", "task_c"]);
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
            dependsOn: [],
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            id: "tsk_a",
            projectId: "proj_a",
            requirementId: "req_a",
            sourceItemId: "item_a",
            status: "init",
            title: "Project A task",
            updatedAt: timestamp
          },
          {
            body: "B task body",
            createdAt: timestamp,
            deletedAt: null,
            dependsOn: [],
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            id: "tsk_b",
            projectId: "proj_b",
            requirementId: "req_b",
            sourceItemId: "item_b",
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

  it("filters Task Board tasks by Requirement", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const tasks = [
      {
        body: "First body",
        createdAt: timestamp,
        deletedAt: null,
        dependsOn: [],
        executorAgentBindingId: null,
        executorLabel: "Model API",
        executorType: "model-api" as const,
        id: "tsk_first",
        projectId: "proj_test",
        requirementId: "req_first",
        sourceItemId: "item_first",
        status: "init" as const,
        title: "First task",
        updatedAt: timestamp
      },
      {
        body: "Second body",
        createdAt: timestamp,
        deletedAt: null,
        dependsOn: [],
        executorAgentBindingId: null,
        executorLabel: "Model API",
        executorType: "model-api" as const,
        id: "tsk_second",
        projectId: "proj_test",
        requirementId: "req_second",
        sourceItemId: "item_second",
        status: "failed" as const,
        title: "Second task",
        updatedAt: timestamp
      }
    ];

    expect(getVisibleTaskBoardTasks(tasks, "")).toEqual(tasks);
    expect(getVisibleTaskBoardTasks(tasks, "req_first")).toEqual([tasks[0]]);
    expect(getVisibleTaskBoardTasks(tasks, "req_missing")).toEqual([]);
  });

  it("applies realtime Task updates to the Task Board state", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const task = {
      body: "First body",
      createdAt: timestamp,
      deletedAt: null,
      dependsOn: [],
      executorAgentBindingId: null,
      executorLabel: "Model API",
      executorType: "model-api" as const,
      id: "tsk_first",
      projectId: "proj_test",
      requirementId: "req_first",
      sourceItemId: "item_first",
      status: "init" as const,
      title: "First task",
      updatedAt: timestamp
    };

    expect(
      applyRealtimeTaskEvent([task], {
        task: {
          ...task,
          status: "running",
          updatedAt: "2026-06-14T00:01:00.000Z"
        },
        type: "task.updated"
      })
    ).toEqual([
      {
        ...task,
        status: "running",
        updatedAt: "2026-06-14T00:01:00.000Z"
      }
    ]);
  });

  it("applies realtime Workflow Run and Node Run updates to the Task Board state", () => {
    const timestamp = "2026-06-14T00:00:00.000Z";
    const workflowRun = {
      createdAt: timestamp,
      executorAssignments: {},
      id: "wfr_first",
      status: "running" as const,
      taskId: "tsk_first",
      updatedAt: timestamp,
      workflowFileId: "wf_task"
    };
    const nodeRun = {
      createdAt: timestamp,
      dependsOn: [],
      errorMessage: null,
      id: "ndr_plan",
      nodeId: "plan",
      output: null,
      sortOrder: 0,
      status: "queued" as const,
      updatedAt: timestamp,
      workflowRunId: workflowRun.id
    };
    const currentRuns = {
      tsk_first: [
        {
          nodeRuns: [nodeRun],
          workflowRun
        }
      ]
    };

    const afterWorkflowRun = applyRealtimeWorkflowRunEvent(currentRuns, {
      type: "workflowRun.updated",
      workflowRun: {
        ...workflowRun,
        status: "succeeded",
        updatedAt: "2026-06-14T00:01:00.000Z"
      }
    });

    expect(afterWorkflowRun.tsk_first[0]?.workflowRun.status).toBe("succeeded");

    const afterNodeRun = applyRealtimeWorkflowRunEvent(afterWorkflowRun, {
      nodeRun: {
        ...nodeRun,
        status: "succeeded",
        updatedAt: "2026-06-14T00:02:00.000Z"
      },
      type: "nodeRun.updated",
      workflowRun: afterWorkflowRun.tsk_first[0]!.workflowRun
    });

    expect(afterNodeRun.tsk_first[0]?.nodeRuns).toEqual([
      {
        ...nodeRun,
        status: "succeeded",
        updatedAt: "2026-06-14T00:02:00.000Z"
      }
    ]);
  });

  it("renders Task Board Requirement filters", () => {
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
            body: "First body",
            createdAt: timestamp,
            deletedAt: null,
            errorMessage: null,
            id: "req_first",
            projectId: "proj_test",
            status: "init",
            title: "First Requirement",
            updatedAt: timestamp,
            workflowFileId: "wf_1"
          },
          {
            body: "Second body",
            createdAt: timestamp,
            deletedAt: null,
            errorMessage: null,
            id: "req_second",
            projectId: "proj_test",
            status: "init",
            title: "Second Requirement",
            updatedAt: timestamp,
            workflowFileId: "wf_1"
          }
        ]}
      />
    );

    expect(markup).toContain('class="task-board-toolbar"');
    expect(markup).toContain("All");
    expect(markup).toContain("Requirement");
    expect(markup).toContain("First Requirement");
    expect(markup).toContain("Second Requirement");
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
            dependsOn: [],
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            id: "tsk_a",
            projectId: "proj_a",
            requirementId: "req_a",
            sourceItemId: "item_a",
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
                  errorMessage: null,
                  id: "ndr_a",
                  nodeId: "write_travel_guide",
                  output: null,
                  sortOrder: 0,
                  status: "succeeded",
                  updatedAt: timestamp,
                  workflowRunId: "wfr_a"
                }
              ],
              workflowRun: {
                createdAt: timestamp,
                executorAssignments: {},
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

  it("labels the action as rerunning the Workflow when a Task already has runs", () => {
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
            status: "tasks_generated",
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
            dependsOn: [],
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            id: "tsk_a",
            projectId: "proj_a",
            requirementId: "req_a",
            sourceItemId: "item_a",
            status: "pending_acceptance",
            title: "Task",
            updatedAt: timestamp
          }
        ]}
        initialWorkflowFiles={[
          {
            createdAt: timestamp,
            definition: JSON.stringify({
              name: "Task workflow",
              nodes: [
                {
                  dependsOn: [],
                  exit: { maxRetries: 1 },
                  id: "write",
                  outputs: ["artifact.md"],
                  type: "writing"
                }
              ]
            }),
            id: "wf_2",
            name: "Task workflow",
            nodeCount: 1,
            templateType: "custom"
          }
        ]}
        initialWorkflowRunsByTaskId={{
          tsk_a: [
            {
              nodeRuns: [
                {
                  createdAt: timestamp,
                  dependsOn: [],
                  errorMessage: null,
                  id: "ndr_a",
                  nodeId: "write",
                  output: "done",
                  sortOrder: 0,
                  status: "succeeded",
                  updatedAt: timestamp,
                  workflowRunId: "wfr_a"
                }
              ],
              workflowRun: {
                createdAt: timestamp,
                executorAssignments: {},
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

    expect(markup).toContain(">Rerun Workflow</button>");
    expect(markup).not.toContain(">Start Run</button>");
  });

  it("shows a run-all action for generated Tasks", () => {
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
            status: "tasks_generated",
            title: "Requirement",
            updatedAt: timestamp,
            workflowFileId: "wf_1"
          }
        ]}
        initialTasks={[
          {
            body: "First task",
            createdAt: timestamp,
            deletedAt: null,
            dependsOn: [],
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            id: "tsk_a",
            projectId: "proj_a",
            requirementId: "req_a",
            sourceItemId: "item_a",
            status: "init",
            title: "First task",
            updatedAt: timestamp
          }
        ]}
        initialWorkflowFiles={[
          {
            createdAt: timestamp,
            definition: JSON.stringify({
              name: "Task workflow",
              nodes: [
                {
                  dependsOn: [],
                  exit: { maxRetries: 1 },
                  id: "write",
                  outputs: ["artifact.md"],
                  type: "writing"
                }
              ]
            }),
            id: "wf_2",
            name: "Task workflow",
            nodeCount: 1,
            templateType: "custom"
          }
        ]}
      />
    );

    expect(markup).toContain(">Run all</button>");
  });

  it("does not show Workflow template controls for a running Task", () => {
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
            status: "tasks_generated",
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
            dependsOn: [],
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            id: "tsk_a",
            projectId: "proj_a",
            requirementId: "req_a",
            sourceItemId: "item_a",
            status: "running",
            title: "Task",
            updatedAt: timestamp
          }
        ]}
        initialWorkflowFiles={[
          {
            createdAt: timestamp,
            definition: JSON.stringify({
              name: "Task workflow",
              nodes: [
                {
                  dependsOn: [],
                  exit: { maxRetries: 1 },
                  id: "write",
                  outputs: ["artifact.md"],
                  type: "writing"
                }
              ]
            }),
            id: "wf_2",
            name: "Task workflow",
            nodeCount: 1,
            templateType: "custom"
          }
        ]}
        initialWorkflowRunsByTaskId={{
          tsk_a: [
            {
              nodeRuns: [],
              workflowRun: {
                createdAt: timestamp,
                executorAssignments: {},
                id: "wfr_a",
                status: "running",
                taskId: "tsk_a",
                updatedAt: timestamp,
                workflowFileId: "wf_2"
              }
            }
          ]
        }}
      />
    );

    expect(markup).not.toContain("Task Workflow Template");
    expect(markup).not.toContain(">Rerun Workflow</button>");
    expect(markup).not.toContain(">Start Run</button>");
  });

  it("opens Workflow Run details instead of summarizing the current Workflow Node on Task cards", () => {
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
            status: "tasks_generated",
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
            dependsOn: [],
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            id: "tsk_a",
            projectId: "proj_a",
            requirementId: "req_a",
            sourceItemId: "item_a",
            status: "running",
            title: "Task",
            updatedAt: timestamp
          }
        ]}
        initialWorkflowFiles={[
          {
            definition: JSON.stringify({
              name: "Travel Guide",
              version: "1",
              inputs: [{ id: "task", description: "Approved travel guide task" }],
              skills: [
                {
                  id: "destination-research",
                  ref: "skill:destination-research"
                }
              ],
              artifacts: [
                {
                  id: "trip-brief",
                  type: "doc",
                  description: "Trip brief"
                }
              ],
              nodes: [
                {
                  id: "clarify-trip",
                  type: "analysis",
                  dependsOn: [],
                  uses: ["skill:destination-research"],
                  inputs: ["task"],
                  instruction: {
                    text: "Extract destination, dates, budget, travelers, and constraints."
                  },
                  outputs: [{ artifact: "trip-brief" }],
                  exit: {
                    maxRetries: 1,
                    criteria: ["Trip constraints are explicit."]
                  }
                },
                {
                  id: "design-itinerary",
                  type: "generation",
                  dependsOn: ["clarify-trip"],
                  uses: ["skill:destination-research"],
                  inputs: ["trip-brief"],
                  instruction: {
                    text: "Create the day-by-day itinerary."
                  },
                  outputs: [{ artifact: "draft-itinerary" }],
                  exit: {
                    maxRetries: 1,
                    criteria: ["Itinerary covers each travel day."]
                  }
                }
              ]
            }),
            id: "wf_2",
            name: "Travel Guide",
            nodeCount: 2,
            templateType: "custom",
            createdAt: timestamp
          }
        ]}
        initialWorkflowRunsByTaskId={{
          tsk_a: [
            {
              nodeRuns: [
                {
                  createdAt: timestamp,
                  dependsOn: [],
                  errorMessage: null,
                  id: "ndr_a",
                  nodeId: "clarify-trip",
                  output: null,
                  sortOrder: 0,
                  status: "running",
                  updatedAt: timestamp,
                  workflowRunId: "wfr_a"
                },
                {
                  createdAt: timestamp,
                  dependsOn: ["clarify-trip"],
                  errorMessage: null,
                  id: "ndr_b",
                  nodeId: "design-itinerary",
                  output: null,
                  sortOrder: 1,
                  status: "queued",
                  updatedAt: timestamp,
                  workflowRunId: "wfr_a"
                }
              ],
              workflowRun: {
                createdAt: timestamp,
                executorAssignments: {},
                id: "wfr_a",
                status: "running",
                taskId: "tsk_a",
                updatedAt: timestamp,
                workflowFileId: "wf_2"
              }
            }
          ]
        }}
        initialWorkflowRunDetailDialog={{
          taskId: "tsk_a",
          workflowRunId: "wfr_a"
        }}
      />
    );

    expect(markup).not.toContain('class="task-current-node"');
    expect(markup).toContain("View details");
    expect(markup).toContain("run-group-summary");
    expect(markup).toContain("run-group-timestamp");
    expect(markup).toContain("Workflow Run details");
    expect(markup).toContain("Current node 1 / 2");
    expect(markup).toContain("clarify-trip");
    expect(markup).toContain("design-itinerary");
    expect(markup).toContain("Inputs");
    expect(markup).toContain("Outputs");
    expect(markup).toContain("Depends on");
    expect(markup).toContain("Execution trace");
    expect(markup).toContain("Process details have not been captured yet.");
  });

  it("shows a retry action for failed Workflow Nodes in the detail dialog", () => {
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
            status: "tasks_generated",
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
            dependsOn: [],
            executorAgentBindingId: null,
            executorLabel: "Model API",
            executorType: "model-api",
            id: "tsk_a",
            projectId: "proj_a",
            requirementId: "req_a",
            sourceItemId: "item_a",
            status: "failed",
            title: "Task",
            updatedAt: timestamp
          }
        ]}
        initialWorkflowFiles={[
          {
            createdAt: timestamp,
            definition: JSON.stringify({
              name: "Travel Guide",
              version: "1",
              nodes: [
                {
                  dependsOn: [],
                  exit: { maxRetries: 1, criteria: ["Research is complete."] },
                  id: "clarify-trip",
                  inputs: [],
                  outputs: [],
                  type: "analysis"
                },
                {
                  dependsOn: ["clarify-trip"],
                  exit: { maxRetries: 1, criteria: ["Itinerary is complete."] },
                  id: "design-itinerary",
                  inputs: [],
                  outputs: [],
                  type: "generation"
                },
                {
                  dependsOn: ["design-itinerary"],
                  exit: { maxRetries: 1, criteria: ["Guide is localized."] },
                  id: "localize-guide",
                  inputs: [],
                  outputs: [],
                  type: "writing"
                }
              ]
            }),
            id: "wf_2",
            name: "Travel Guide",
            nodeCount: 3,
            templateType: "custom"
          }
        ]}
        initialWorkflowRunsByTaskId={{
          tsk_a: [
            {
              nodeRuns: [
                {
                  createdAt: timestamp,
                  dependsOn: [],
                  errorMessage: null,
                  id: "ndr_a",
                  nodeId: "clarify-trip",
                  output: "done",
                  sortOrder: 0,
                  status: "succeeded",
                  updatedAt: timestamp,
                  workflowRunId: "wfr_a"
                },
                {
                  createdAt: timestamp,
                  dependsOn: ["clarify-trip"],
                  errorMessage: "analysis failed",
                  id: "ndr_b",
                  nodeId: "design-itinerary",
                  output: null,
                  sortOrder: 1,
                  status: "failed",
                  updatedAt: timestamp,
                  workflowRunId: "wfr_a"
                },
                {
                  createdAt: timestamp,
                  dependsOn: ["design-itinerary"],
                  errorMessage: null,
                  id: "ndr_c",
                  nodeId: "localize-guide",
                  output: null,
                  sortOrder: 2,
                  status: "queued",
                  updatedAt: timestamp,
                  workflowRunId: "wfr_a"
                }
              ],
              workflowRun: {
                createdAt: timestamp,
                executorAssignments: {},
                id: "wfr_a",
                status: "failed",
                taskId: "tsk_a",
                updatedAt: timestamp,
                workflowFileId: "wf_2"
              }
            }
          ]
        }}
        initialWorkflowRunDetailDialog={{
          taskId: "tsk_a",
          workflowRunId: "wfr_a"
        }}
      />
    );

    expect(markup).toContain("Retry node");
    expect(markup).toContain("workflow-run-detail-retry-panel");
    expect(markup).toContain("workflow-run-detail-header");
    expect(markup).toContain("workflow-run-detail-body");
    expect(markup).toContain("Current node 2 / 3");
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

  it("reads stored Task Workflow template selections from local storage", () => {
    const storage = {
      getItem: (key: string) =>
        key === "forge:task-workflow-selections"
          ? JSON.stringify({ tsk_a: "wf_research" })
          : null,
      removeItem: () => undefined,
      setItem: () => undefined
    };

    expect(readStoredTaskWorkflowSelections(storage)).toEqual({
      tsk_a: "wf_research"
    });
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

  it("shows stored system Task Workflow templates that task runs can select", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="workflow-templates"
        initialWorkflowFiles={[
          {
            createdAt: "2026-06-14T00:00:00.000Z",
            definition: JSON.stringify({
              name: "旅行攻略模板",
              nodes: [
                {
                  dependsOn: [],
                  exit: { maxRetries: 1 },
                  id: "write_travel_guide",
                  outputs: ["travel-guide.md"],
                  type: "coding"
                }
              ]
            }),
            id: "wf_travel",
            name: "旅行攻略模板",
            nodeCount: 1,
            templateType: "builtin"
          }
        ]}
      />
    );

    expect(markup).toContain("4");
    expect(markup).toContain("<h3>旅行攻略模板</h3>");
    expect(markup).toContain("System template");
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
              exit: { maxRetries: 1 },
              id: "analyze",
              outputs: ["analysis.md"],
              type: "requirement-analysis"
            },
            {
              dependsOn: ["analyze"],
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
              exit: { maxRetries: 1 },
              id: "scope",
              outputs: ["scope.md"],
              type: "research-scope"
            },
            {
              dependsOn: ["scope"],
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
              exit: { maxRetries: 1 },
              id: "plan",
              outputs: ["plan.md"],
              type: "implementation-plan"
            },
            {
              dependsOn: ["plan"],
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
              exit: { maxRetries: 1 },
              id: "draft",
              outputs: ["draft.md"],
              type: "writing-draft"
            },
            {
              dependsOn: ["draft"],
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
              exit: { maxRetries: 1 },
              id: "review",
              outputs: ["review.md"],
              type: "human-review"
            },
            {
              dependsOn: ["review"],
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
                  exit: { maxRetries: 1 },
                  id: "intake",
                  outputs: ["requirement-brief.md"],
                  type: "requirement-intake"
                },
                {
                  dependsOn: ["intake"],
                  exit: { maxRetries: 1 },
                  id: "decompose",
                  outputs: ["decomposition-result.json"],
                  type: "requirement-decomposition"
                },
                {
                  dependsOn: ["decompose"],
                  exit: { maxRetries: 1 },
                  id: "risk-review",
                  outputs: ["risk-check.md"],
                  type: "risk-review"
                },
                {
                  dependsOn: ["risk-review"],
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
    expect(resolvePageFromPath("/main")).toBe("control-room");
    expect(resolvePageFromPath("/control-room")).toBe("control-room");
    expect(resolvePageFromPath("/")).toBe("control-room");
    expect(getPathForPage("control-room")).toBe("/main");
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
    expect(markup).toContain("Human-readable name shown in the Workflow template library.");
    expect(markup).toContain("Workflow Nodes");
    expect(markup).toContain("Node ID");
    expect(markup).toContain("template-builder-helper");
    expect(markup).toContain("Stable identifier used by dependencies and run history.");
    expect(markup).toContain("Semantic label for what this Workflow Node does.");
    expect(markup).toContain("Optional reusable tool instructions for this Workflow Node.");
    expect(markup).toContain("Artifact file this Workflow Node should produce.");
    expect(markup).toContain("How many times Forge may retry this Workflow Node.");
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
    expect(markup).toContain("workflow-node-kv-label");
    expect(markup).toContain("Review");
    expect(markup).toContain("model");
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
          exit: { maxRetries: 1 },
          id: "plan",
          outputs: ["plan.md"],
          type: "implementation-plan"
        },
        {
          dependsOn: ["plan"],
          exit: { maxRetries: 2 },
          id: "code",
          outputs: ["diff.patch"],
          type: "code-change"
        },
        {
          dependsOn: ["plan"],
          exit: { maxRetries: 1 },
          id: "verify",
          outputs: ["verification.md"],
          type: "verification"
        },
        {
          dependsOn: ["code", "verify"],
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
    expect(markup).toContain("workflow-node-type-pill");
    expect(markup).toContain("workflow-node-kv-grid");
    expect(markup).toContain("workflow-node-kv-label");
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
    expect(markup).not.toContain("agent:coder");
  });

  it("does not preview requirement-scoped workflow file definitions", () => {
    const requirementWorkflow = {
      name: "Requirement Planning",
      scope: "requirement",
      nodes: [
        {
          dependsOn: [],
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
          defaultExecutorAgentBindingId: null,
          defaultExecutorType: "model-api",
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

  it("lets the settings page fill the available shell width", () => {
    const styles = readFileSync(
      new URL("./styles.css", import.meta.url),
      "utf8"
    );
    const settingsPageRule = styles.match(/\.settings-page\s*\{[^}]+\}/)?.[0];

    expect(settingsPageRule).toContain("width: 100%");
    expect(settingsPageRule).not.toContain("max-width");
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
    expect(markup).toContain("Default executor");
    expect(markup).toContain("Executor source");
    expect(markup).toContain("No Agent Bindings");
    expect(markup.indexOf("Default executor")).toBeLessThan(
      markup.indexOf('aria-label="Model settings sections"')
    );
    expect(markup).not.toContain("settings-agent-proxy-panel");
    expect(markup).not.toContain("forgecli bridge bind --server");
    expect(markup).not.toContain("CLI setup is not available in this build");
    expect(markup).not.toContain("Language");
  });

  it("renders editable decomposition result executor controls before Tasks are generated", () => {
    const timestamp = "2026-06-15T08:30:00.000Z";
    const markup = renderToStaticMarkup(
      <App
        initialDecompositionResults={[
          {
            createdAt: timestamp,
            id: "dcr_exec",
            items: [
              {
                body: "Implement executor assignment.",
                dependsOn: [],
                executorAgentBindingId: null,
                executorLabel: "Model API",
                executorType: "model-api",
                id: "item_executor_assignment",
                sortOrder: 0,
                title: "Executor assignment"
              }
            ],
            projectId: "proj_test",
            requirementId: "req_exec",
            summary: "Review the executor assignment before generating Tasks.",
            updatedAt: timestamp
          }
        ]}
        initialPage="requirements"
        initialProjects={[
          {
            artifactStorageMode: "local-only",
            createdAt: timestamp,
            dbStrategy: "sqlite",
            id: "proj_test",
            name: "Forge Ops",
            updatedAt: timestamp
          }
        ]}
        initialRequirements={[
          {
            body: "Make generated Tasks editable.",
            createdAt: timestamp,
            deletedAt: null,
            errorMessage: null,
            id: "req_exec",
            projectId: "proj_test",
            status: "ready_to_generate_tasks",
            title: "Editable executors",
            updatedAt: timestamp,
            workflowFileId: "wf_requirement"
          }
        ]}
      />
    );

    expect(markup).toContain("Decomposition result");
    expect(markup).toContain("Save decomposition");
    expect(markup).toContain("Executor assignment");
    expect(markup).toContain("Executor");
    expect(markup).toContain("Model API");
  });

  it("renders a progress action for an async Requirement decomposition", () => {
    const timestamp = "2026-06-15T08:30:00.000Z";
    const markup = renderToStaticMarkup(
      <App
        initialPage="requirements"
        initialProjects={[
          {
            artifactStorageMode: "local-only",
            createdAt: timestamp,
            dbStrategy: "sqlite",
            id: "proj_test",
            name: "Forge Ops",
            updatedAt: timestamp
          }
        ]}
        initialRequirements={[
          {
            body: "Decompose through a selected agent.",
            createdAt: timestamp,
            deletedAt: null,
            errorMessage: null,
            id: "req_async",
            projectId: "proj_test",
            status: "decomposing",
            title: "Async decomposition",
            updatedAt: timestamp,
            workflowFileId: "wf_requirement"
          }
        ]}
      />
    );

    expect(markup).toContain("Decomposing");
    expect(markup).toContain("View progress");
    expect(markup).toContain("View decomposition progress");
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

  it("offers CLI download help from the local bridge setup path", () => {
    const markup = renderToStaticMarkup(
      <App
        initialPage="settings"
        initialSettingsSection="model"
        initialModelSettingsSection="local-bridge"
      />
    );

    expect(markup).toContain('aria-label="How to get forgecli"');
    expect(markup).toContain('class="settings-help-button"');
    expect(markup).not.toContain("Download forgecli");
  });

  it("shows CLI download options in a help dialog", () => {
    const markup = renderToStaticMarkup(
      <App
        initialCliDownloadHelpOpen
        initialPage="settings"
        initialSettingsSection="model"
        initialModelSettingsSection="local-bridge"
      />
    );

    expect(markup).toContain('id="cli-download-help-heading"');
    expect(markup).toContain("Download forgecli");
    expect(markup).toContain('href="/release/forgecli"');
    expect(markup).toContain("/release/forgecli");
    expect(markup).toContain("pnpm build:forgecli");
    expect(markup).toContain("pnpm release");
    expect(markup).toContain("apps/forgecli/dist/index.js bridge bind --server");
  });

  it("shows the local bridge agent naming step and registered Agent Bindings", () => {
    const markup = renderToStaticMarkup(
      <App
        initialAgentBindings={[
          {
            capabilities: ["cli"],
            command: "codex exec",
            connector: "cli",
            errorMessage: null,
            id: "agb_codex",
            lastSeenAt: "2026-06-15T08:30:00.000Z",
            name: "codex",
            status: "online",
            updatedAt: "2026-06-15T08:30:00.000Z"
          }
        ]}
        initialPage="settings"
        initialSettingsSection="model"
        initialModelSettingsSection="local-bridge"
      />
    );

    expect(markup).toContain("forgecli agent add &lt;name&gt;");
    expect(markup).toContain("Registered Agent Bindings");
    expect(markup).toContain("codex");
    expect(markup).toContain("cli");
    expect(markup).toContain("codex exec");
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
          defaultExecutorAgentBindingId: null,
          defaultExecutorType: "model-api",
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
