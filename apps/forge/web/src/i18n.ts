import type { DefaultWorkflowTemplateKey } from "./default-workflow-templates";

export type Locale = "en" | "zh";

type Messages = {
  nav: {
    appLabel: string;
    controlRoom: string;
    requirements: string;
    settings: string;
    workflowTemplates: string;
    statusLabel: string;
    brandAlt: string;
  };
  hero: {
    title: string;
    eyebrow: string;
    heading: string;
    nameLabel: string;
    namePlaceholder: string;
    bodyLabel: string;
    bodyPlaceholder: string;
    workflowTemplateLabel: string;
    importWorkflowTemplateFirst: string;
    createRequirement: string;
  };
  setup: {
    ariaLabel: string;
    workflowTemplateEyebrow: string;
    workflowTemplateHeading: string;
    workflowSourceLabel: string;
    importWorkflowTemplate: string;
    workspaceEyebrow: string;
    workspaceHeading: string;
    projectNameLabel: string;
    projectNamePlaceholder: string;
    artifactsLabel: string;
    databaseLabel: string;
    createProject: string;
  };
  settings: {
    title: string;
    eyebrow: string;
    description: string;
    navigationLabel: string;
    modelNavigationLabel: string;
    basicSectionTitle: string;
    basicSectionDescription: string;
    localBridgeSectionTitle: string;
    modelSectionTitle: string;
    modelSectionDescription: string;
    modelApiPlaneLabel: string;
    modelApiScopeLabel: string;
    modelApiBlockTitle: string;
    modelApiBlockDescription: string;
    agentSectionTitle: string;
    agentSectionDescription: string;
    agentProxyPlaneLabel: string;
    agentProxyScopeLabel: string;
    agentProxyBlockTitle: string;
    agentProxySetupTitle: string;
    agentProxySetupDescription: string;
    agentProxyCliUnavailable: string;
    languageLabel: string;
    projectNameLabel: string;
    projectNameHelp: string;
    noProjectNameHelp: string;
    saveProjectName: string;
    defaultArtifactsLabel: string;
    defaultDatabaseLabel: string;
    executionEyebrow: string;
    executionTitle: string;
    executionDescription: string;
    modelProviderLabel: string;
    modelBaseUrlLabel: string;
    modelNameLabel: string;
    modelApiKeyLabel: string;
    modelApiKeyConfigured: string;
    modelApiKeyPlaceholder: string;
    agentProxyUrlLabel: string;
    modelConfigured: string;
    modelMissing: string;
    saveModelApi: string;
    testModelApi: string;
    saveAgentProxy: string;
    agentProxyConfigured: string;
    agentProxyMissing: string;
    executionHelp: string;
    saveExecutionSettings: string;
  };
  templatePage: {
    eyebrow: string;
    title: string;
    description: string;
    newWorkflow: string;
    importWorkflow: string;
    createDescription: string;
    builderNameLabel: string;
    builderNodesTitle: string;
    builderNodeIdLabel: string;
    builderNodeTypeLabel: string;
    builderExecutorLabel: string;
    builderOutputLabel: string;
    builderRetriesLabel: string;
    addWorkflowNode: string;
    removeWorkflowNode: string;
    createWorkflow: string;
    totalTemplates: string;
    totalWorkflowNodes: string;
    importEyebrow: string;
    importTitle: string;
    importDescription: string;
    importModeLabel: string;
    importModeSource: string;
    importModeFile: string;
    defaultTemplateDescriptions: Record<DefaultWorkflowTemplateKey, string>;
    templateTypeLabels: {
      builtin: string;
      custom: string;
    };
    unnamedWorkflowTemplate: string;
    fileSourceLabel: string;
    fileSourceHelp: string;
    libraryEyebrow: string;
    libraryTitle: string;
    libraryDescription: string;
    emptyTitle: string;
    emptyBody: string;
    previewEyebrow: string;
    previewTitle: string;
    previewDescription: string;
    previewGraphLabel: string;
    noPreviewTitle: string;
    noPreviewBody: string;
    workflowNameLabel: string;
    editWorkflow: string;
    editWorkflowAria: string;
    renameWorkflow: string;
    previewWorkflow: string;
    cancelWorkflowEdit: string;
    saveWorkflowName: string;
    workflowRenameHelp: string;
    dependsOn: (dependencies: string) => string;
    retryBudget: (count: number) => string;
    startPointLabel: string;
    startPointDescription: (count: number) => string;
    endPointLabel: string;
    endPointDescription: (count: number) => string;
    startNodeBadge: string;
    endNodeBadge: string;
    inputsLabel: string;
    skillsLabel: string;
    agentRolesLabel: string;
    artifactTypesLabel: string;
    exitCriteriaLabel: string;
    reviewMode: (mode: string) => string;
    humanReviewRequired: string;
    usesLabel: string;
    nodeInputsLabel: string;
    noOutputs: string;
    templateSummary: (count: number) => string;
  };
  workbench: {
    eyebrow: string;
    firstProjectTitle: string;
    firstProjectBody: string;
    workflowSetupTitle: string;
    workflowSetupBody: string;
    readyTitle: string;
    readyBody: string;
    createFirstProject: string;
    createFirstProjectBody: string;
    currentProject: string;
    noActiveProject: string;
    projectsCount: string;
    nextActions: string;
    quickActionsHeading: string;
    workflowSetupHeading: string;
    newRequirement: string;
    newRequirementHelp: string;
    close: string;
    closeRequirement: string;
    importWorkflow: string;
    importWorkflowHelp: string;
    newProject: string;
    newProjectHelp: string;
    pathLabel: string;
    pathProject: string;
    pathProjectHelp: string;
    pathRequirement: string;
    pathRequirementHelp: string;
    pathReview: string;
    pathReviewHelp: string;
    defaultWorkflowHelp: string;
    modelRequiredHelp: string;
  };
  progress: {
    ariaLabel: string;
    workflowTemplates: string;
    ideas: string;
    tasks: string;
    runs: string;
  };
  footer: {
    brand: string;
    description: string;
    copyright: string;
  };
  workspace: {
    generatedWorkLabel: string;
    taskBoardEyebrow: string;
    taskBoardHeading: string;
    taskBoardBody: string;
    taskBoardLabel: string;
    noTasks: string;
    sourceLabel: string;
    runWorkflowTemplateLabel: string;
    importTaskWorkflowTemplateFirst: string;
    startRun: string;
    noRunsForTask: string;
    workflowRun: string;
    noDependency: string;
    requirementsEyebrow: string;
    requirementsHeading: string;
    requirementsLabel: string;
    allRequirementsHeading: string;
    allRequirementsBody: string;
    viewAllRequirements: string;
    noRequirements: string;
    planRequirement: string;
    generateTasks: string;
    editRequirement: string;
    requirementNameLabel: string;
    renameRequirement: string;
    cancelRequirementEdit: string;
    saveRequirementName: string;
    requirementRenameHelp: string;
    deleteRequirement: string;
    requirementDeleteHelp: string;
    requirementStatus: Record<
      | "init"
      | "decomposing"
      | "decomposition_failed"
      | "ready_to_generate_tasks"
      | "tasks_generated"
      | "completed",
      string
    >;
  };
  options: {
    localOnly: string;
    cloud: string;
    sqlite: string;
    postgres: string;
    mysql: string;
  };
  taskStatus: {
    cancelled: string;
    completed: string;
    failed: string;
    init: string;
    pending_acceptance: string;
    running: string;
  };
  status: {
    projectIdle: string;
    workflowIdle: string;
    requirementIdle: string;
    taskBoardIdle: string;
    requirementResourcesUnavailable: string;
    resourcesUnavailable: string;
    projectListUnavailable: string;
    creatingProject: string;
    projectCreationFailed: string;
    importingWorkflowFile: string;
    workflowImportFailed: string;
    runningRequirementWorkflow: string;
    requirementCreationFailed: string;
    createdRequirement: string;
    decompositionReady: string;
    generatingTasks: string;
    modelNotConfigured: string;
    savingRequirement: string;
    renamedRequirement: string;
    requirementUpdateFailed: string;
    savingWorkflow: string;
    renamedWorkflow: string;
    workflowUpdateFailed: string;
    deletingRequirement: string;
    deletedRequirement: string;
    requirementDeletionFailed: string;
    settingsIdle: string;
    testingModelApi: string;
    modelApiTestSucceeded: string;
    modelApiTestFailed: string;
    savingModelSettings: string;
    modelSettingsSaved: string;
    savingAgentProxySettings: string;
    agentProxySettingsSaved: string;
    savingSettings: string;
    settingsSaved: string;
    settingsSaveFailed: string;
    importTaskWorkflowFirst: string;
    startingWorkflowRun: string;
    workflowRunFailed: string;
    ready: string;
  };
  namedStatus: {
    createdProject: (name: string) => string;
    importedWorkflow: (name: string) => string;
    workflowRunStatus: (status: string) => string;
  };
  countStatus: {
    generatedTasks: (count: number) => string;
  };
};

export const defaultLocale: Locale = "en";

export const supportedLocales = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" }
] as const;

export type LocaleStorage = Pick<Storage, "getItem" | "setItem">;

const localeStorageKey = "forge.locale";

const messages: Record<Locale, Messages> = {
  en: {
    nav: {
      appLabel: "Forge Studio",
      controlRoom: "Home",
      requirements: "Requirements",
      settings: "Settings",
      workflowTemplates: "Workflow templates",
      statusLabel: "Forge status",
      brandAlt: "Forge brand mark"
    },
    hero: {
      title: "Turn an idea into shipped AI work.",
      eyebrow: "Start with the outcome",
      heading:
        "Describe the document, code change, research note, or creative work you want finished.",
      nameLabel: "Name this work",
      namePlaceholder: "Draft an onboarding guide",
      bodyLabel: "What should Forge help with?",
      bodyPlaceholder:
        "Explain the goal, audience, constraints, files, tone, or acceptance criteria.",
      workflowTemplateLabel: "Workflow Template",
      importWorkflowTemplateFirst: "Import a Workflow Template first",
      createRequirement: "Create Requirement"
    },
    setup: {
      ariaLabel: "Studio setup",
      workflowTemplateEyebrow: "Workflow Template",
      workflowTemplateHeading: "Teach Forge the workflow",
      workflowSourceLabel: "Workflow template source",
      importWorkflowTemplate: "Import Workflow Template",
      workspaceEyebrow: "Workspace",
      workspaceHeading: "Save outputs where you want them",
      projectNameLabel: "Project name",
      projectNamePlaceholder: "Writing and code desk",
      artifactsLabel: "Artifact",
      databaseLabel: "Database",
      createProject: "Create Project"
    },
    settings: {
      title: "Settings",
      eyebrow: "Workspace preferences",
      description:
        "Tune home defaults and connect Forge to model planning and local Agent execution.",
      navigationLabel: "Settings sections",
      modelNavigationLabel: "Model settings sections",
      basicSectionTitle: "Basic settings",
      basicSectionDescription:
        "Set the workspace language and defaults used when creating Projects.",
      localBridgeSectionTitle: "Local bridge",
      modelSectionTitle: "Model settings",
      modelSectionDescription:
        "Configure the model planner and the local Agent execution entrypoint.",
      modelApiPlaneLabel: "Planning plane",
      modelApiScopeLabel: "Requirement to Task planning",
      modelApiBlockTitle: "Model API",
      modelApiBlockDescription:
        "Used when Forge plans Requirements into Tasks.",
      agentSectionTitle: "Agent execution",
      agentSectionDescription:
        "Used when Forge starts Task Workflows through the local bridge.",
      agentProxyPlaneLabel: "Execution bridge",
      agentProxyScopeLabel: "Task Workflow dispatch",
      agentProxyBlockTitle: "Local bridge",
      agentProxySetupTitle: "CLI initialization path",
      agentProxySetupDescription:
        "Expected setup is: install forgecli, run forgecli bridge bind --server <Forge Server URL>, then run forgecli bridge start.",
      agentProxyCliUnavailable:
        "CLI setup is not available in this build. Paste an existing local bridge URL only if you already run one.",
      languageLabel: "Language",
      projectNameLabel: "Project name",
      projectNameHelp:
        "Rename the active Project shown on the Home page and Project switcher.",
      noProjectNameHelp: "Create or select a Project before editing its name.",
      saveProjectName: "Save Project name",
      defaultArtifactsLabel: "Default artifact storage",
      defaultDatabaseLabel: "Default database",
      executionEyebrow: "Execution capability",
      executionTitle: "Model and local Local bridge",
      executionDescription:
        "Requirement submission needs a configured model provider to plan Tasks. Task Workflows need a local Local bridge URL.",
      modelProviderLabel: "Model provider",
      modelBaseUrlLabel: "Model base URL",
      modelNameLabel: "Model name",
      modelApiKeyLabel: "API key",
      modelApiKeyConfigured: "Configured. Enter a new key to replace it.",
      modelApiKeyPlaceholder: "Paste API key",
      agentProxyUrlLabel: "Local bridge URL",
      modelConfigured: "Model configured",
      modelMissing: "Model not configured",
      saveModelApi: "Save model API",
      testModelApi: "Test API key",
      saveAgentProxy: "Save local bridge",
      agentProxyConfigured: "Local bridge configured",
      agentProxyMissing: "Local bridge not configured",
      executionHelp:
        "API keys are stored by the Forge server and are never returned to the browser after saving.",
      saveExecutionSettings: "Save execution settings"
    },
    templatePage: {
      eyebrow: "Workflow templates",
      title: "Workflow templates management",
      description:
        "Import, inspect, and organize .wf templates separately from workspace settings.",
      newWorkflow: "New Workflow",
      importWorkflow: "Import Workflow",
      createDescription:
        "Create a Task Workflow Template by naming nodes, executors, outputs, and retry budgets.",
      builderNameLabel: "Template name",
      builderNodesTitle: "Workflow Nodes",
      builderNodeIdLabel: "Node ID",
      builderNodeTypeLabel: "Node type",
      builderExecutorLabel: "Executor",
      builderOutputLabel: "Output file",
      builderRetriesLabel: "Retries",
      addWorkflowNode: "Add Workflow Node",
      removeWorkflowNode: "Remove node",
      createWorkflow: "Create Workflow",
      totalTemplates: "Total templates",
      totalWorkflowNodes: "Nodes",
      importEyebrow: "Import",
      importTitle: "Add a Workflow templates",
      importDescription:
        "Paste a .wf source file. Workflow templates describe task-level work.",
      importModeLabel: "Workflow import modes",
      importModeSource: "Paste source",
      importModeFile: "Upload .wf",
      defaultTemplateDescriptions: {
        "creative-writing-task":
          "Outline, draft, revise, and approve a creative writing Task.",
        "research-writing-task":
          "Research, outline, draft, and edit an evidence-backed writing Task.",
        "software-change-task":
          "Plan, implement, verify, review, and hand off a task template with 5 nodes."
      },
      templateTypeLabels: {
        builtin: "System template",
        custom: "Project template"
      },
      unnamedWorkflowTemplate: "Untitled Workflow template",
      fileSourceLabel: "Workflow templates upload",
      fileSourceHelp:
        "The uploaded file is loaded into the source editor before import.",
      libraryEyebrow: "Library",
      libraryTitle: "Available templates",
      libraryDescription:
        "Use this list to confirm node count before selecting a template.",
      emptyTitle: "No Workflow templates yet",
      emptyBody: "Import a .wf file to make it available in this Project.",
      previewEyebrow: "Preview",
      previewTitle: "Last imported template nodes",
      previewDescription:
        "Review node order, executor binding, retry budget, and dependencies.",
      previewGraphLabel: "Workflow templates node preview",
      noPreviewTitle: "No template preview",
      noPreviewBody: "Import a Workflow templates to inspect its nodes here.",
      workflowNameLabel: "Workflow name",
      editWorkflow: "Edit",
      editWorkflowAria: "Edit Workflow",
      renameWorkflow: "Rename Workflow",
      previewWorkflow: "Preview Workflow",
      cancelWorkflowEdit: "Cancel",
      saveWorkflowName: "Save Workflow name",
      workflowRenameHelp:
        "Workflow names are automatically numbered when a duplicate exists.",
      dependsOn: (dependencies) => `Depends on ${dependencies}`,
      retryBudget: (count) => `${count} retries`,
      startPointLabel: "Start",
      startPointDescription: (count) =>
        `${count} ${count === 1 ? "entry node" : "entry nodes"}`,
      endPointLabel: "End",
      endPointDescription: (count) =>
        `${count} ${count === 1 ? "terminal node" : "terminal nodes"}`,
      startNodeBadge: "Start node",
      endNodeBadge: "End node",
      inputsLabel: "Inputs",
      skillsLabel: "Skills",
      agentRolesLabel: "Agent Roles",
      artifactTypesLabel: "Artifact Types",
      exitCriteriaLabel: "Exit Criteria",
      reviewMode: (mode) => `Review: ${mode}`,
      humanReviewRequired: "Human review required",
      usesLabel: "Uses",
      nodeInputsLabel: "Node inputs",
      noOutputs: "No declared outputs",
      templateSummary: (count) => `${count} nodes`
    },
    workbench: {
      eyebrow: "Workbench",
      firstProjectTitle: "Create your first Project",
      firstProjectBody:
        "A Project keeps Requirements, Workflow templates, Tasks, and Artifact in one traceable place.",
      workflowSetupTitle: "New Requirement",
      workflowSetupBody:
        "Describe the goal first. Forge will use the default Requirement workflow unless you configure templates in Settings.",
      readyTitle: "New Requirement",
      readyBody:
        "Describe the goal first. Workflow templates can be configured separately in Settings.",
      createFirstProject: "Create your first Project",
      createFirstProjectBody:
        "Set the storage and database defaults once. You can adjust them later in Settings.",
      currentProject: "Current Project",
      noActiveProject: "No Project selected",
      projectsCount: "Projects",
      nextActions: "Next actions",
      quickActionsHeading: "Choose what to do next.",
      workflowSetupHeading: "Set up the first Workflow templates.",
      newRequirement: "New Requirement",
      newRequirementHelp: "Describe a goal and let Forge create Tasks.",
      close: "Close",
      closeRequirement: "Close Requirement dialog",
      importWorkflow: "Import Workflow templates",
      importWorkflowHelp: "Add a .wf template for Requirement or Task execution.",
      newProject: "New Project",
      newProjectHelp: "Create another Project with its own storage defaults.",
      pathLabel: "First run path",
      pathProject: "Create a Project",
      pathProjectHelp: "Define where Forge stores Artifact and project data.",
      pathRequirement: "Submit a Requirement",
      pathRequirementHelp: "Describe the outcome Forge should turn into work.",
      pathReview: "Run Tasks",
      pathReviewHelp: "Start Task Workflows for the generated Tasks.",
      defaultWorkflowHelp:
        "Uses the default Requirement workflow. Custom templates live in Workflow templates.",
      modelRequiredHelp:
        "Model planning is not configured. Forge will save this Requirement, but it will not create Tasks yet."
    },
    progress: {
      ariaLabel: "Forge progress",
      workflowTemplates: "Workflow templates",
      ideas: "Ideas",
      tasks: "Tasks",
      runs: "Runs"
    },
    footer: {
      brand: "Forge",
      description: "AI work orchestration control plane",
      copyright: "@2026 Forge"
    },
    workspace: {
      generatedWorkLabel: "Generated work",
      taskBoardEyebrow: "Task Board",
      taskBoardHeading: "Run the generated Tasks.",
      taskBoardBody:
        "Tasks can represent a document output, code change, research packet, or any Artifact-producing AI work.",
      taskBoardLabel: "Task Board",
      noTasks: "No Tasks",
      sourceLabel: "Source",
      runWorkflowTemplateLabel: "Task Workflow Template",
      importTaskWorkflowTemplateFirst: "Import a Task Workflow Template first",
      startRun: "Start Run",
      noRunsForTask: "No runs started for this Task.",
      workflowRun: "Task Workflow",
      noDependency: "No dependency",
      requirementsEyebrow: "Requirements",
      requirementsHeading: "Current Requirement",
      requirementsLabel: "Requirements",
      allRequirementsHeading: "All Requirements",
      allRequirementsBody:
        "Rename or remove active Requirements in the current Project.",
      viewAllRequirements: "View all Requirements",
      noRequirements: "No Requirements submitted yet.",
      planRequirement: "Decompose Requirement",
      generateTasks: "Generate Tasks",
      editRequirement: "Edit",
      requirementNameLabel: "Requirement name",
      renameRequirement: "Rename",
      cancelRequirementEdit: "Cancel",
      saveRequirementName: "Save name",
      requirementRenameHelp:
        "Requirement names must be unique in the current Project.",
      deleteRequirement: "Delete",
      requirementDeleteHelp: "Soft deletes this Requirement and hides linked Tasks.",
      requirementStatus: {
        completed: "Completed",
        decomposing: "Decomposing",
        decomposition_failed: "Decomposition failed",
        init: "Initialized",
        ready_to_generate_tasks: "Ready to generate Tasks",
        tasks_generated: "Tasks generated"
      }
    },
    options: {
      localOnly: "Local-only",
      cloud: "Cloud",
      sqlite: "SQLite",
      postgres: "Postgres",
      mysql: "MySQL"
    },
    taskStatus: {
      cancelled: "Cancelled",
      completed: "Completed",
      failed: "Failed",
      init: "Initialized",
      pending_acceptance: "Pending acceptance",
      running: "Running"
    },
    status: {
      projectIdle: "No project created yet",
      workflowIdle: "No workflow imported yet",
      requirementIdle: "No requirement created yet",
      taskBoardIdle: "No Task created yet",
      requirementResourcesUnavailable: "Requirement resources unavailable",
      resourcesUnavailable: "Workspace resources unavailable",
      projectListUnavailable: "Project list unavailable",
      creatingProject: "Creating project",
      projectCreationFailed: "Project creation failed",
      importingWorkflowFile: "Importing workflow file",
      workflowImportFailed: "Workflow import failed",
      runningRequirementWorkflow: "Creating Tasks",
      requirementCreationFailed: "Requirement creation failed",
      createdRequirement: "Requirement created",
      decompositionReady: "Decomposition result ready",
      generatingTasks: "Generating Tasks",
      modelNotConfigured:
        "Requirement saved. Configure a model in Settings before Forge can create Tasks.",
      savingRequirement: "Saving Requirement",
      renamedRequirement: "Renamed Requirement",
      requirementUpdateFailed: "Requirement update failed",
      savingWorkflow: "Saving Workflow",
      renamedWorkflow: "Renamed Workflow",
      workflowUpdateFailed: "Workflow update failed",
      deletingRequirement: "Deleting Requirement",
      deletedRequirement: "Deleted Requirement",
      requirementDeletionFailed: "Requirement deletion failed",
      settingsIdle: "Settings unchanged",
      testingModelApi: "Testing model API",
      modelApiTestSucceeded: "Model API test passed",
      modelApiTestFailed: "Model API test failed",
      savingModelSettings: "Saving model API",
      modelSettingsSaved: "Model API saved",
      savingAgentProxySettings: "Saving local Local bridge",
      agentProxySettingsSaved: "Local bridge saved",
      savingSettings: "Saving settings",
      settingsSaved: "Settings saved",
      settingsSaveFailed: "Settings save failed",
      importTaskWorkflowFirst: "Import a task .wf first",
      startingWorkflowRun: "Starting Task Workflow",
      workflowRunFailed: "Task Workflow failed",
      ready: "Ready"
    },
    namedStatus: {
      createdProject: (name) => `Created ${name}`,
      importedWorkflow: (name) => `Imported ${name}`,
      workflowRunStatus: (status) => `Task Workflow ${status}`
    },
    countStatus: {
      generatedTasks: (count) => `Created ${count} Tasks`
    }
  },
  zh: {
    nav: {
      appLabel: "Forge Studio",
      controlRoom: "首页",
      requirements: "需求",
      settings: "设置",
      workflowTemplates: "工作流模板",
      statusLabel: "Forge 状态",
      brandAlt: "Forge 品牌标识"
    },
    hero: {
      title: "把想法编排成可交付的 AI 工作。",
      eyebrow: "从目标开始",
      heading: "描述你想完成的文档、代码变更、研究记录或创意工作。",
      nameLabel: "工作名称",
      namePlaceholder: "起草一份入职指南",
      bodyLabel: "希望 Forge 协助什么？",
      bodyPlaceholder: "说明目标、受众、约束、文件、语气或验收标准。",
      workflowTemplateLabel: "工作流模板",
      importWorkflowTemplateFirst: "请先导入工作流模板",
      createRequirement: "创建需求"
    },
    setup: {
      ariaLabel: "工作室设置",
      workflowTemplateEyebrow: "工作流模板",
      workflowTemplateHeading: "让 Forge 理解工作流",
      workflowSourceLabel: "模板源码",
      importWorkflowTemplate: "导入工作流模板",
      workspaceEyebrow: "工作区",
      workspaceHeading: "按你的方式保存输出",
      projectNameLabel: "项目名称",
      projectNamePlaceholder: "写作和代码工作台",
      artifactsLabel: "产物",
      databaseLabel: "数据库",
      createProject: "创建项目"
    },
    settings: {
      title: "设置",
      eyebrow: "工作区偏好",
      description:
        "调整首页默认项，并配置模型和本地桥接。",
      navigationLabel: "设置分组",
      modelNavigationLabel: "模型设置分组",
      basicSectionTitle: "基本设置",
      basicSectionDescription: "设置工作区语言，以及创建 项目 时使用的默认项。",
      localBridgeSectionTitle: "本地桥接",
      modelSectionTitle: "模型配置",
      modelSectionDescription: "配置用于拆解需求的模型，以及本地桥接。",
      modelApiPlaneLabel: "模型配置",
      modelApiScopeLabel: "拆解需求",
      modelApiBlockTitle: "模型 API",
      modelApiBlockDescription: "用于 Forge 拆解需求。",
      agentSectionTitle: "Agent 管理",
      agentSectionDescription: "用于 Forge 通过本地桥接启动任务工作流。",
      agentProxyPlaneLabel: "本地桥接",
      agentProxyScopeLabel: "任务工作流分发",
      agentProxyBlockTitle: "本地桥接",
      agentProxySetupTitle: "CLI 初始化路径",
      agentProxySetupDescription:
        "预期配置路径是：安装 forgecli，执行 forgecli bridge bind --server <Forge Server URL>，然后执行 forgecli bridge start。",
      agentProxyCliUnavailable:
        "当前 build 还不能通过 CLI 完成初始化。如果你已经有本地桥接，才需要在这里粘贴 URL。",
      languageLabel: "语言",
      projectNameLabel: "项目名称",
      projectNameHelp: "修改当前项目在首页和项目切换器中显示的名称。",
      noProjectNameHelp: "请先创建或选择一个项目，再修改名称。",
      saveProjectName: "保存项目名称",
      defaultArtifactsLabel: "默认产物存储",
      defaultDatabaseLabel: "默认数据库",
      executionEyebrow: "执行能力",
      executionTitle: "模型和本地桥接",
      executionDescription:
        "拆解需求需要已配置的模型提供方；启动任务工作流需要本地桥接 URL。",
      modelProviderLabel: "模型提供方",
      modelBaseUrlLabel: "模型 Base URL",
      modelNameLabel: "模型名称",
      modelApiKeyLabel: "API Key",
      modelApiKeyConfigured: "已配置。如需替换，请输入新 Key。",
      modelApiKeyPlaceholder: "粘贴 API Key",
      agentProxyUrlLabel: "本地桥接 URL",
      modelConfigured: "模型已配置",
      modelMissing: "模型未配置",
      saveModelApi: "保存模型 API",
      testModelApi: "测试 API Key",
      saveAgentProxy: "保存本地桥接",
      agentProxyConfigured: "本地桥接已配置",
      agentProxyMissing: "本地桥接未配置",
      executionHelp:
        "API Key 由 Forge Server 保存，保存后不会再明文返回给浏览器。",
      saveExecutionSettings: "保存执行设置"
    },
    templatePage: {
      eyebrow: "工作流模板",
      title: "工作流模板管理",
      description:
        "单独管理 .wf 模板的导入、查看和预览，不再混在设置页里。",
      newWorkflow: "新建模板",
      importWorkflow: "导入模板",
      createDescription:
        "通过填写节点、执行器、输出和重试次数，可视化创建 Task Workflow Template。",
      builderNameLabel: "模板名称",
      builderNodesTitle: "Workflow Nodes",
      builderNodeIdLabel: "Node ID",
      builderNodeTypeLabel: "节点类型",
      builderExecutorLabel: "执行器",
      builderOutputLabel: "输出文件",
      builderRetriesLabel: "重试次数",
      addWorkflowNode: "添加 Workflow Node",
      removeWorkflowNode: "移除节点",
      createWorkflow: "创建模板",
      totalTemplates: "模板总数",
      totalWorkflowNodes: "节点",
      importEyebrow: "导入",
      importTitle: "添加工作流模板",
      importDescription:
        "粘贴 .wf 源文件。工作流模板统一描述任务维度的工作。",
      importModeLabel: "Workflow 导入方式",
      importModeSource: "粘贴源码",
      importModeFile: "上传 .wf",
      defaultTemplateDescriptions: {
        "creative-writing-task":
          "为创意写作任务编排大纲、初稿、修订和确认。",
        "research-writing-task":
          "为调研写作任务编排调研、提纲、草稿和编辑。",
        "software-change-task":
          "用 5 个节点编排软件任务的计划、实现、验证、评审和交付。"
      },
      templateTypeLabels: {
        builtin: "系统内置",
        custom: "项目模板"
      },
      unnamedWorkflowTemplate: "未命名工作流模板",
      fileSourceLabel: "上传工作流模板",
      fileSourceHelp:
        "上传的文件会先读取到源码编辑器，再执行导入。",
      libraryEyebrow: "模板库",
      libraryTitle: "可用模板",
      libraryDescription:
        "在这里确认模板节点数量，再决定使用哪个模板。",
      emptyTitle: "暂无工作流模板",
      emptyBody: "导入 .wf 文件后，会在这里作为项目可用模板展示。",
      previewEyebrow: "预览",
      previewTitle: "最近导入模板的节点",
      previewDescription:
        "查看节点顺序、执行器绑定、重试次数和依赖关系。",
      previewGraphLabel: "工作流模板节点预览",
      noPreviewTitle: "暂无模板预览",
      noPreviewBody: "导入工作流模板后，会在这里检查节点。",
      workflowNameLabel: "Workflow 名称",
      editWorkflow: "编辑",
      editWorkflowAria: "编辑 Workflow",
      renameWorkflow: "重命名 Workflow",
      previewWorkflow: "预览 Workflow",
      cancelWorkflowEdit: "取消",
      saveWorkflowName: "保存 Workflow 名称",
      workflowRenameHelp:
        "如果名称重复，Forge 会自动追加序号。",
      dependsOn: (dependencies) => `依赖 ${dependencies}`,
      retryBudget: (count) => `${count} 次重试`,
      startPointLabel: "起始",
      startPointDescription: (count) => `${count} 个起始节点`,
      endPointLabel: "结束",
      endPointDescription: (count) => `${count} 个终止节点`,
      startNodeBadge: "起始节点",
      endNodeBadge: "终止节点",
      inputsLabel: "输入",
      skillsLabel: "Skills",
      agentRolesLabel: "执行 Agent",
      artifactTypesLabel: "产物",
      exitCriteriaLabel: "验收条件",
      reviewMode: (mode) => `评审：${mode}`,
      humanReviewRequired: "需要人工评审",
      usesLabel: "使用",
      nodeInputsLabel: "节点输入",
      noOutputs: "未声明输出",
      templateSummary: (count) => `包含 ${count} 个节点`
    },
    workbench: {
      eyebrow: "工作台",
      firstProjectTitle: "创建第一个项目",
      firstProjectBody:
        "项目会把需求、工作流模板、任务和产物放在一个可追踪的位置。",
      workflowSetupTitle: "创建需求",
      workflowSetupBody:
        "先描述目标。Forge 会创建需求，随后可拆解需求。",
      readyTitle: "创建需求",
      readyBody:
        "先描述目标。工作流模板可以在设置里单独配置。",
      createFirstProject: "创建第一个项目",
      createFirstProjectBody:
        "先设置产物存储和数据库默认值，后续可以在设置里调整。",
      currentProject: "当前项目",
      noActiveProject: "未选择项目",
      projectsCount: "项目",
      nextActions: "下一步",
      quickActionsHeading: "选择接下来要做的事。",
      workflowSetupHeading: "配置第一个工作流模板。",
      newRequirement: "创建需求",
      newRequirementHelp: "描述目标，让 Forge 创建需求。",
      close: "关闭",
      closeRequirement: "关闭需求弹窗",
      importWorkflow: "导入工作流模板",
      importWorkflowHelp: "添加用于任务执行的 .wf 模板。",
      newProject: "新建项目",
      newProjectHelp: "创建另一个拥有独立存储默认值的项目。",
      pathLabel: "首次使用路径",
      pathProject: "创建项目",
      pathProjectHelp: "定义 Forge 保存产物和项目数据的位置。",
      pathRequirement: "创建需求",
      pathRequirementHelp: "描述 Forge 需要转成工作的目标。",
      pathReview: "开始任务",
      pathReviewHelp: "为生成的任务启动任务工作流。",
      defaultWorkflowHelp:
        "创建需求后，可在需求页拆解需求。",
      modelRequiredHelp:
        "模型配置尚未完成。Forge 会先保存这个需求，但暂时不能拆解需求。"
    },
    progress: {
      ariaLabel: "Forge 进展",
      workflowTemplates: "工作流模板",
      ideas: "需求",
      tasks: "任务",
      runs: "任务工作流"
    },
    footer: {
      brand: "Forge",
      description: "AI 工作编排控制平面",
      copyright: "@2026 Forge"
    },
    workspace: {
      generatedWorkLabel: "已生成工作",
      taskBoardEyebrow: "任务看板",
      taskBoardHeading: "开始已生成的任务。",
      taskBoardBody:
        "任务可以代表文档产出、代码变更、研究包，或任何会产出产物的 AI 工作。",
      taskBoardLabel: "任务看板",
      noTasks: "暂无任务",
      sourceLabel: "来源",
      runWorkflowTemplateLabel: "Task Workflow Template",
      importTaskWorkflowTemplateFirst: "请先导入 Task Workflow Template",
      startRun: "开始任务",
      noRunsForTask: "这个任务还没有启动任务工作流。",
      workflowRun: "任务工作流",
      noDependency: "无依赖",
      requirementsEyebrow: "需求",
      requirementsHeading: "当前需求",
      requirementsLabel: "需求",
      allRequirementsHeading: "全部需求",
      allRequirementsBody:
        "在当前项目内改名或移除仍然有效的需求。",
      viewAllRequirements: "查看全部需求",
      noRequirements: "暂无已创建需求。",
      planRequirement: "拆解需求",
      generateTasks: "生成任务",
      editRequirement: "编辑",
      requirementNameLabel: "需求名称",
      renameRequirement: "改名",
      cancelRequirementEdit: "取消",
      saveRequirementName: "保存名称",
      requirementRenameHelp: "当前项目内的需求名称不能重复。",
      deleteRequirement: "删除",
      requirementDeleteHelp: "软删除该需求，并隐藏关联任务。",
      requirementStatus: {
        completed: "需求已完成",
        decomposing: "拆解中",
        decomposition_failed: "拆解失败",
        init: "初始化",
        ready_to_generate_tasks: "待生成任务",
        tasks_generated: "已生成任务"
      }
    },
    options: {
      localOnly: "仅本地",
      cloud: "云端",
      sqlite: "SQLite",
      postgres: "Postgres",
      mysql: "MySQL"
    },
    taskStatus: {
      cancelled: "已取消",
      completed: "已完成",
      failed: "执行失败",
      init: "初始化",
      pending_acceptance: "待验收",
      running: "执行中"
    },
    status: {
      projectIdle: "尚未创建项目",
      workflowIdle: "尚未导入工作流",
      requirementIdle: "尚未创建需求",
      taskBoardIdle: "尚未创建任务",
      requirementResourcesUnavailable: "需求资源不可用",
      resourcesUnavailable: "工作台资源不可用",
      projectListUnavailable: "项目列表不可用",
      creatingProject: "正在创建项目",
      projectCreationFailed: "项目创建失败",
      importingWorkflowFile: "正在导入工作流模板",
      workflowImportFailed: "工作流模板导入失败",
      runningRequirementWorkflow: "正在拆解需求",
      requirementCreationFailed: "需求创建失败",
      createdRequirement: "需求已创建",
      decompositionReady: "拆解结果已生成",
      generatingTasks: "正在生成任务",
      modelNotConfigured:
        "需求已保存。请先在设置里完成模型配置，Forge 才能拆解需求。",
      savingRequirement: "正在保存需求",
      renamedRequirement: "已改名需求",
      requirementUpdateFailed: "需求更新失败",
      savingWorkflow: "正在保存工作流模板",
      renamedWorkflow: "已重命名工作流模板",
      workflowUpdateFailed: "工作流模板更新失败",
      deletingRequirement: "正在删除需求",
      deletedRequirement: "已删除需求",
      requirementDeletionFailed: "需求删除失败",
      settingsIdle: "设置未修改",
      testingModelApi: "正在测试模型 API",
      modelApiTestSucceeded: "模型 API 测试通过",
      modelApiTestFailed: "模型 API 测试失败",
      savingModelSettings: "正在保存模型 API",
      modelSettingsSaved: "模型 API 已保存",
      savingAgentProxySettings: "正在保存本地桥接",
      agentProxySettingsSaved: "本地桥接已保存",
      savingSettings: "正在保存设置",
      settingsSaved: "设置已保存",
      settingsSaveFailed: "设置保存失败",
      importTaskWorkflowFirst: "请先导入工作流模板",
      startingWorkflowRun: "正在启动任务工作流",
      workflowRunFailed: "任务工作流失败",
      ready: "就绪"
    },
    namedStatus: {
      createdProject: (name) => `已创建 ${name}`,
      importedWorkflow: (name) => `已导入 ${name}`,
      workflowRunStatus: (status) => `任务工作流 ${status}`
    },
    countStatus: {
      generatedTasks: (count) => `已生成 ${count} 个任务`
    }
  }
};

export function getMessages(locale: Locale) {
  return messages[locale] ?? messages[defaultLocale];
}

export function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale.code === value);
}

export function readStoredLocale(storage: LocaleStorage | undefined): Locale {
  if (!storage) {
    return defaultLocale;
  }

  const value = storage.getItem(localeStorageKey);

  return value && isLocale(value) ? value : defaultLocale;
}

export function saveStoredLocale(storage: LocaleStorage | undefined, locale: Locale) {
  storage?.setItem(localeStorageKey, locale);
}
