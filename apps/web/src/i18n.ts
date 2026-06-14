export type Locale = "en" | "zh";

type Messages = {
  nav: {
    appLabel: string;
    controlRoom: string;
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
    recipeLabel: string;
    importRecipeFirst: string;
    generateTaskDrafts: string;
  };
  setup: {
    ariaLabel: string;
    recipeEyebrow: string;
    recipeHeading: string;
    workflowSourceLabel: string;
    importRecipe: string;
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
    basicSectionTitle: string;
    basicSectionDescription: string;
    modelSectionTitle: string;
    modelSectionDescription: string;
    modelApiBlockTitle: string;
    modelApiBlockDescription: string;
    agentSectionTitle: string;
    agentSectionDescription: string;
    agentProxyBlockTitle: string;
    agentProxySetupTitle: string;
    agentProxySetupDescription: string;
    agentProxyCliUnavailable: string;
    languageLabel: string;
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
    agentProxyConfigured: string;
    agentProxyMissing: string;
    executionHelp: string;
    saveExecutionSettings: string;
  };
  templatePage: {
    eyebrow: string;
    title: string;
    description: string;
    totalTemplates: string;
    requirementTemplates: string;
    taskTemplates: string;
    importEyebrow: string;
    importTitle: string;
    importDescription: string;
    libraryEyebrow: string;
    libraryTitle: string;
    libraryDescription: string;
    emptyTitle: string;
    emptyBody: string;
    previewEyebrow: string;
    previewTitle: string;
    previewDescription: string;
    noPreviewTitle: string;
    noPreviewBody: string;
    templateSummary: (scope: string, count: number) => string;
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
    recipes: string;
    ideas: string;
    tasks: string;
    runs: string;
  };
  workspace: {
    generatedWorkLabel: string;
    taskBoardEyebrow: string;
    taskBoardHeading: string;
    taskBoardBody: string;
    taskBoardLabel: string;
    noTasks: string;
    sourceLabel: string;
    runRecipeLabel: string;
    importTaskRecipeFirst: string;
    startRun: string;
    noRunsForTask: string;
    workflowRun: string;
    recipeAndHistoryLabel: string;
    recipeMapEyebrow: string;
    recipeMapHeading: string;
    templateCount: (count: number) => string;
    moreTemplates: string;
    recipeSummary: (scope: string, count: number) => string;
    noDependency: string;
    noRecipePreviewTitle: string;
    noRecipePreviewBody: string;
    requirementsEyebrow: string;
    requirementsHeading: string;
    requirementsLabel: string;
    noRequirements: string;
    deleteRequirement: string;
    requirementDeleteHelp: string;
    requirementStatus: Record<"open" | "running" | "completed" | "failed", string>;
  };
  options: {
    localOnly: string;
    cloud: string;
    sqlite: string;
    postgres: string;
    mysql: string;
  };
  taskStatus: {
    done: string;
    in_progress: string;
    todo: string;
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
    modelNotConfigured: string;
    deletingRequirement: string;
    deletedRequirement: string;
    requirementDeletionFailed: string;
    settingsIdle: string;
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
      controlRoom: "Control Room",
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
      recipeLabel: "Recipe",
      importRecipeFirst: "Import a recipe first",
      generateTaskDrafts: "Submit Requirement"
    },
    setup: {
      ariaLabel: "Studio setup",
      recipeEyebrow: "Recipe",
      recipeHeading: "Teach Forge the workflow",
      workflowSourceLabel: "Workflow File source",
      importRecipe: "Import Recipe",
      workspaceEyebrow: "Workspace",
      workspaceHeading: "Save outputs where you want them",
      projectNameLabel: "Project name",
      projectNamePlaceholder: "Writing and code desk",
      artifactsLabel: "Artifacts",
      databaseLabel: "Database",
      createProject: "Create Project"
    },
    settings: {
      title: "Settings",
      eyebrow: "Workspace preferences",
      description:
        "Tune Control Room defaults and connect Forge to model planning and local Agent execution.",
      navigationLabel: "Settings sections",
      basicSectionTitle: "Basic settings",
      basicSectionDescription:
        "Set the workspace language and defaults used when creating Projects.",
      modelSectionTitle: "Model settings",
      modelSectionDescription:
        "Configure the model planner and the local Agent execution entrypoint.",
      modelApiBlockTitle: "Model API",
      modelApiBlockDescription:
        "Used when Forge plans Requirements into Tasks.",
      agentSectionTitle: "Agent execution",
      agentSectionDescription:
        "Used when Forge starts Task Workflow Runs through the local Harness.",
      agentProxyBlockTitle: "Local Agent proxy",
      agentProxySetupTitle: "CLI initialization path",
      agentProxySetupDescription:
        "Expected setup is: install forgecli, run forgecli bridge bind --server <Forge Server URL>, then run forgecli bridge start.",
      agentProxyCliUnavailable:
        "CLI setup is not available in this build. Paste an existing local Harness proxy URL only if you already run one.",
      languageLabel: "Language",
      defaultArtifactsLabel: "Default artifact storage",
      defaultDatabaseLabel: "Default database",
      executionEyebrow: "Execution capability",
      executionTitle: "Model and local Agent proxy",
      executionDescription:
        "Requirement submission needs a model API key to plan Tasks. Workflow Runs need a local Agent proxy URL.",
      modelProviderLabel: "Model provider",
      modelBaseUrlLabel: "Model base URL",
      modelNameLabel: "Model name",
      modelApiKeyLabel: "API key",
      modelApiKeyConfigured: "Configured. Enter a new key to replace it.",
      modelApiKeyPlaceholder: "Paste API key",
      agentProxyUrlLabel: "Local Agent proxy URL",
      modelConfigured: "Model configured",
      modelMissing: "Model not configured",
      agentProxyConfigured: "Agent proxy configured",
      agentProxyMissing: "Agent proxy not configured",
      executionHelp:
        "API keys are stored by the Forge server and are never returned to the browser after saving. The Agent proxy URL is a temporary bridge setting until Agent Binding lands.",
      saveExecutionSettings: "Save execution settings"
    },
    templatePage: {
      eyebrow: "Workflow templates",
      title: "Workflow template management",
      description:
        "Import, inspect, and organize .wf templates separately from workspace settings.",
      totalTemplates: "Total templates",
      requirementTemplates: "Requirement templates",
      taskTemplates: "Task templates",
      importEyebrow: "Import",
      importTitle: "Add a Workflow File",
      importDescription:
        "Paste a .wf source file. Requirement templates create Tasks; Task templates run existing Tasks.",
      libraryEyebrow: "Library",
      libraryTitle: "Available templates",
      libraryDescription:
        "Use this list to confirm scope and node count before selecting a template in a workflow.",
      emptyTitle: "No Workflow templates yet",
      emptyBody: "Import a .wf file to make it available in this Project.",
      previewEyebrow: "Preview",
      previewTitle: "Last imported template nodes",
      previewDescription:
        "Review node order, executor binding, retry budget, and dependencies.",
      noPreviewTitle: "No template preview",
      noPreviewBody: "Import a Workflow File to inspect its nodes here.",
      templateSummary: (scope, count) => `${scope} template with ${count} nodes`
    },
    workbench: {
      eyebrow: "Workbench",
      firstProjectTitle: "Create your first Project",
      firstProjectBody:
        "A Project keeps Requirements, Workflow Files, Tasks, and Artifacts in one traceable place.",
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
      workflowSetupHeading: "Set up the first Workflow File.",
      newRequirement: "New Requirement",
      newRequirementHelp: "Describe a goal and let Forge create Tasks.",
      close: "Close",
      closeRequirement: "Close Requirement dialog",
      importWorkflow: "Import Workflow File",
      importWorkflowHelp: "Add a .wf template for Requirement or Task execution.",
      newProject: "New Project",
      newProjectHelp: "Create another Project with its own storage defaults.",
      pathLabel: "First run path",
      pathProject: "Create a Project",
      pathProjectHelp: "Define where Forge stores Artifacts and project data.",
      pathRequirement: "Submit a Requirement",
      pathRequirementHelp: "Describe the outcome Forge should turn into work.",
      pathReview: "Run Tasks",
      pathReviewHelp: "Start Workflow Runs for the generated Tasks.",
      defaultWorkflowHelp:
        "Uses the default Requirement workflow. Custom templates live in Workflow templates.",
      modelRequiredHelp:
        "Model planning is not configured. Forge will save this Requirement, but it will not create Tasks yet."
    },
    progress: {
      ariaLabel: "Forge progress",
      recipes: "Recipes",
      ideas: "Ideas",
      tasks: "Tasks",
      runs: "Runs"
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
      runRecipeLabel: "Run recipe",
      importTaskRecipeFirst: "Import a task recipe first",
      startRun: "Start Run",
      noRunsForTask: "No runs started for this Task.",
      workflowRun: "Workflow Run",
      recipeAndHistoryLabel: "Templates and history",
      recipeMapEyebrow: "Workflow templates",
      recipeMapHeading: "Template list",
      templateCount: (count) => `${count} ${count === 1 ? "template" : "templates"}`,
      moreTemplates: "More templates",
      recipeSummary: (scope, count) =>
        `${scope} template with ${count} Workflow Nodes`,
      noDependency: "No dependency",
      noRecipePreviewTitle: "No recipe preview",
      noRecipePreviewBody: "Import a Workflow File to show its nodes here.",
      requirementsEyebrow: "Requirements",
      requirementsHeading: "Submitted Requirements.",
      requirementsLabel: "Requirements",
      noRequirements: "No Requirements submitted yet.",
      deleteRequirement: "Delete",
      requirementDeleteHelp: "Soft deletes this Requirement and hides linked Tasks.",
      requirementStatus: {
        completed: "Completed",
        failed: "Failed",
        open: "Open",
        running: "Running"
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
      done: "Done",
      in_progress: "In progress",
      todo: "To do"
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
      modelNotConfigured:
        "Requirement saved. Configure a model in Settings before Forge can create Tasks.",
      deletingRequirement: "Deleting Requirement",
      deletedRequirement: "Deleted Requirement",
      requirementDeletionFailed: "Requirement deletion failed",
      settingsIdle: "Settings unchanged",
      savingSettings: "Saving settings",
      settingsSaved: "Settings saved",
      settingsSaveFailed: "Settings save failed",
      importTaskWorkflowFirst: "Import a task .wf first",
      startingWorkflowRun: "Starting Workflow Run",
      workflowRunFailed: "Workflow Run failed",
      ready: "Ready"
    },
    namedStatus: {
      createdProject: (name) => `Created ${name}`,
      importedWorkflow: (name) => `Imported ${name}`,
      workflowRunStatus: (status) => `Workflow Run ${status}`
    },
    countStatus: {
      generatedTasks: (count) => `Created ${count} Tasks`
    }
  },
  zh: {
    nav: {
      appLabel: "Forge Studio",
      controlRoom: "控制室",
      settings: "设置",
      workflowTemplates: "Workflow 模板",
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
      recipeLabel: "配方",
      importRecipeFirst: "请先导入配方",
      generateTaskDrafts: "提出你的需求"
    },
    setup: {
      ariaLabel: "工作室设置",
      recipeEyebrow: "配方",
      recipeHeading: "让 Forge 理解工作流",
      workflowSourceLabel: "Workflow File 源码",
      importRecipe: "导入配方",
      workspaceEyebrow: "工作区",
      workspaceHeading: "按你的方式保存输出",
      projectNameLabel: "Project 名称",
      projectNamePlaceholder: "写作和代码工作台",
      artifactsLabel: "Artifacts",
      databaseLabel: "数据库",
      createProject: "创建 Project"
    },
    settings: {
      title: "设置",
      eyebrow: "工作区偏好",
      description:
        "调整控制室默认项，并连接模型规划能力和本地 Agent 执行能力。",
      navigationLabel: "设置分组",
      basicSectionTitle: "基本设置",
      basicSectionDescription: "设置工作区语言，以及创建 Project 时使用的默认项。",
      modelSectionTitle: "模型设置",
      modelSectionDescription: "配置 Requirement 规划模型，以及本地 Agent 执行入口。",
      modelApiBlockTitle: "模型 API",
      modelApiBlockDescription: "用于 Forge 将 Requirement 规划为 Task。",
      agentSectionTitle: "Agent 执行",
      agentSectionDescription: "用于 Forge 通过本地 Harness 启动 Task Workflow Run。",
      agentProxyBlockTitle: "本地 Agent 代理",
      agentProxySetupTitle: "CLI 初始化路径",
      agentProxySetupDescription:
        "预期配置路径是：安装 forgecli，执行 forgecli bridge bind --server <Forge Server URL>，然后执行 forgecli bridge start。",
      agentProxyCliUnavailable:
        "当前 build 还不能通过 CLI 完成初始化。如果你已经有本地 Harness proxy，才需要在这里粘贴 URL。",
      languageLabel: "语言",
      defaultArtifactsLabel: "默认 Artifact 存储",
      defaultDatabaseLabel: "默认数据库",
      executionEyebrow: "执行能力",
      executionTitle: "模型和本地 Agent 代理",
      executionDescription:
        "提交 Requirement 后需要模型 API Key 才能规划 Task；启动 Workflow Run 需要本地 Agent 代理 URL。",
      modelProviderLabel: "模型提供方",
      modelBaseUrlLabel: "模型 Base URL",
      modelNameLabel: "模型名称",
      modelApiKeyLabel: "API Key",
      modelApiKeyConfigured: "已配置。如需替换，请输入新 Key。",
      modelApiKeyPlaceholder: "粘贴 API Key",
      agentProxyUrlLabel: "本地 Agent 代理 URL",
      modelConfigured: "模型已配置",
      modelMissing: "模型未配置",
      agentProxyConfigured: "Agent 代理已配置",
      agentProxyMissing: "Agent 代理未配置",
      executionHelp:
        "API Key 由 Forge Server 保存，保存后不会再明文返回给浏览器。Agent 代理 URL 是 Agent Binding 落地前的临时 Bridge 设置。",
      saveExecutionSettings: "保存执行设置"
    },
    templatePage: {
      eyebrow: "Workflow 模板",
      title: "Workflow 模板管理",
      description:
        "单独管理 .wf 模板的导入、查看和作用域，不再混在设置页里。",
      totalTemplates: "模板总数",
      requirementTemplates: "Requirement 模板",
      taskTemplates: "Task 模板",
      importEyebrow: "导入",
      importTitle: "添加 Workflow File",
      importDescription:
        "粘贴 .wf 源文件。Requirement 模板负责生成 Task；Task 模板负责运行已有 Task。",
      libraryEyebrow: "模板库",
      libraryTitle: "可用模板",
      libraryDescription:
        "在这里确认模板作用域和节点数量，再决定用于哪个工作流。",
      emptyTitle: "暂无 Workflow 模板",
      emptyBody: "导入 .wf 文件后，会在这里作为 Project 可用模板展示。",
      previewEyebrow: "预览",
      previewTitle: "最近导入模板的节点",
      previewDescription:
        "查看节点顺序、执行器绑定、重试次数和依赖关系。",
      noPreviewTitle: "暂无模板预览",
      noPreviewBody: "导入 Workflow File 后，会在这里检查节点。",
      templateSummary: (scope, count) => `${scope} 模板，包含 ${count} 个节点`
    },
    workbench: {
      eyebrow: "工作台",
      firstProjectTitle: "创建第一个 Project",
      firstProjectBody:
        "Project 会把 Requirements、Workflow Files、Tasks 和 Artifacts 放在一个可追踪的位置。",
      workflowSetupTitle: "提出你的需求",
      workflowSetupBody:
        "先描述目标。Forge 会使用默认 Requirement workflow，自定义模板可在设置里配置。",
      readyTitle: "提出你的需求",
      readyBody:
        "先描述目标。Workflow templates 可以在设置里单独配置。",
      createFirstProject: "创建第一个 Project",
      createFirstProjectBody:
        "先设置 Artifact 存储和数据库默认值，后续可以在设置里调整。",
      currentProject: "当前 Project",
      noActiveProject: "未选择 Project",
      projectsCount: "Projects",
      nextActions: "下一步",
      quickActionsHeading: "选择接下来要做的事。",
      workflowSetupHeading: "配置第一个 Workflow File。",
      newRequirement: "提出你的需求",
      newRequirementHelp: "描述目标，让 Forge 生成 Task。",
      close: "关闭",
      closeRequirement: "关闭需求弹窗",
      importWorkflow: "导入 Workflow File",
      importWorkflowHelp: "添加用于 Requirement 或 Task 执行的 .wf 模板。",
      newProject: "新建 Project",
      newProjectHelp: "创建另一个拥有独立存储默认值的 Project。",
      pathLabel: "首次使用路径",
      pathProject: "创建 Project",
      pathProjectHelp: "定义 Forge 保存 Artifact 和项目数据的位置。",
      pathRequirement: "提交 Requirement",
      pathRequirementHelp: "描述 Forge 需要转成工作的目标。",
      pathReview: "运行 Task",
      pathReviewHelp: "为生成的 Task 启动 Workflow Run。",
      defaultWorkflowHelp:
        "使用默认 Requirement workflow。自定义模板在 Workflow 模板里配置。",
      modelRequiredHelp:
        "模型规划尚未配置。Forge 会先保存这个 Requirement，但暂时不会创建 Task。"
    },
    progress: {
      ariaLabel: "Forge 进展",
      recipes: "配方",
      ideas: "需求",
      tasks: "任务",
      runs: "运行"
    },
    workspace: {
      generatedWorkLabel: "已生成工作",
      taskBoardEyebrow: "Task Board",
      taskBoardHeading: "运行已生成的 Task。",
      taskBoardBody:
        "Task 可以代表文档产出、代码变更、研究包，或任何会产出 Artifact 的 AI 工作。",
      taskBoardLabel: "Task Board",
      noTasks: "暂无 Task",
      sourceLabel: "来源",
      runRecipeLabel: "运行配方",
      importTaskRecipeFirst: "请先导入 Task 配方",
      startRun: "开始运行",
      noRunsForTask: "这个 Task 还没有启动运行。",
      workflowRun: "Workflow Run",
      recipeAndHistoryLabel: "模板和历史",
      recipeMapEyebrow: "Workflow 模板",
      recipeMapHeading: "模板列表",
      templateCount: (count) => `当前 ${count} 个模板`,
      moreTemplates: "更多模板",
      recipeSummary: (scope, count) =>
        `${scope} 模板，包含 ${count} 个 Workflow Node`,
      noDependency: "无依赖",
      noRecipePreviewTitle: "暂无配方预览",
      noRecipePreviewBody: "导入 Workflow File 后会在这里展示节点。",
      requirementsEyebrow: "需求",
      requirementsHeading: "已提交的需求。",
      requirementsLabel: "需求",
      noRequirements: "暂无已提交需求。",
      deleteRequirement: "删除",
      requirementDeleteHelp: "软删除该需求，并隐藏关联 Task。",
      requirementStatus: {
        completed: "已完成",
        failed: "失败",
        open: "待处理",
        running: "运行中"
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
      done: "已完成",
      in_progress: "进行中",
      todo: "待处理"
    },
    status: {
      projectIdle: "尚未创建 Project",
      workflowIdle: "尚未导入工作流",
      requirementIdle: "尚未创建 Requirement",
      taskBoardIdle: "尚未创建 Task",
      requirementResourcesUnavailable: "Requirement 资源不可用",
      resourcesUnavailable: "工作台资源不可用",
      projectListUnavailable: "Project 列表不可用",
      creatingProject: "正在创建 Project",
      projectCreationFailed: "Project 创建失败",
      importingWorkflowFile: "正在导入 Workflow File",
      workflowImportFailed: "Workflow 导入失败",
      runningRequirementWorkflow: "正在生成 Task",
      requirementCreationFailed: "Requirement 创建失败",
      modelNotConfigured:
        "Requirement 已保存。请先在设置里配置模型，Forge 才能创建 Task。",
      deletingRequirement: "正在删除 Requirement",
      deletedRequirement: "已删除 Requirement",
      requirementDeletionFailed: "Requirement 删除失败",
      settingsIdle: "设置未修改",
      savingSettings: "正在保存设置",
      settingsSaved: "设置已保存",
      settingsSaveFailed: "设置保存失败",
      importTaskWorkflowFirst: "请先导入 Task .wf",
      startingWorkflowRun: "正在启动 Workflow Run",
      workflowRunFailed: "Workflow Run 失败",
      ready: "就绪"
    },
    namedStatus: {
      createdProject: (name) => `已创建 ${name}`,
      importedWorkflow: (name) => `已导入 ${name}`,
      workflowRunStatus: (status) => `Workflow Run ${status}`
    },
    countStatus: {
      generatedTasks: (count) => `已生成 ${count} 个 Task`
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
