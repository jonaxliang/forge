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
    skillSectionTitle: string;
    skillSectionDescription: string;
    skillPlaneLabel: string;
    skillScopeLabel: string;
    skillUploadTitle: string;
    skillUploadDescription: string;
    skillNameLabel: string;
    skillRefLabel: string;
    skillDescriptionLabel: string;
    skillFileLabel: string;
    skillSourceUrlLabel: string;
    skillSourceUrlPlaceholder: string;
    skillSourceUrlHelp: string;
    skillBodyLabel: string;
    uploadSkill: string;
    uploadSkillZip: string;
    importSkillFromLink: string;
    confirmSkillUpload: string;
    skillUploadChooseFiles: string;
    skillUploadNoFileTitle: string;
    skillUploadNoFileDescription: string;
    skillUploadSelectedTitle: string;
    skillUploadValidationHelp: string;
    skillUploadFileCount: (count: number) => string;
    viewSkill: string;
    linkedSkillSource: string;
    updateSkillFromSource: string;
    deleteSkill: string;
    skillLibraryLabel: string;
    skillLibraryTitle: string;
    skillLibraryDescription: string;
    skillContentsTitle: string;
    skillFileTreeTitle: string;
    skillPreviewTitle: string;
    noSkills: string;
    localBridgeSectionTitle: string;
    modelSectionTitle: string;
    modelSectionDescription: string;
    modelApiPlaneLabel: string;
    modelApiScopeLabel: string;
    modelApiBlockTitle: string;
    modelApiBlockDescription: string;
    defaultExecutorTitle: string;
    defaultExecutorDescription: string;
    defaultExecutorTypeLabel: string;
    agentBindingExecutorLabel: string;
    defaultAgentBindingLabel: string;
    noAgentBindings: string;
    agentSectionTitle: string;
    agentSectionDescription: string;
    agentProxyPlaneLabel: string;
    agentProxyScopeLabel: string;
    agentProxyBlockTitle: string;
    agentProxySetupTitle: string;
    agentProxySetupDescription: string;
    agentProxySetupHelpLabel: string;
    agentProxyCliUnavailable: string;
    cliDownloadTitle: string;
    cliDownloadIntro: string;
    cliDownloadRelease: string;
    cliDownloadLocalBuild: string;
    cliDownloadNextStep: string;
    closeCliDownloadHelp: string;
    registeredAgentBindingsTitle: string;
    registeredAgentBindingsDescription: string;
    noRegisteredAgentBindings: string;
    agentBindingCommandLabel: string;
    agentBindingCapabilitiesLabel: string;
    agentBindingLastSeenLabel: string;
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
    saveDefaultExecutor: string;
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
    builderNameHelp: string;
    builderNodesTitle: string;
    builderNodeIdLabel: string;
    builderNodeIdHelp: string;
    builderNodeTypeLabel: string;
    builderNodeTypeHelp: string;
    builderSkillLabel: string;
    builderSkillHelp: string;
    builderNoSkill: string;
    builderOutputLabel: string;
    builderOutputHelp: string;
    builderRetriesLabel: string;
    builderRetriesHelp: string;
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
    reviewLabel: string;
    reviewMode: (mode: string) => string;
    humanReviewLabel: string;
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
    taskBoardFilterAll: string;
    taskBoardRequirementFilterLabel: string;
    noTasks: string;
    sourceLabel: string;
    runWorkflowTemplateLabel: string;
    importTaskWorkflowTemplateFirst: string;
    chooseWorkflowRunExecutors: string;
    chooseWorkflowRunExecutorsHelp: string;
    workflowNodeExecutorLabel: string;
    useDefaultExecutor: string;
    startRun: string;
    runAllTaskWorkflows: string;
    rerunWorkflow: string;
    noRunsForTask: string;
    taskDependenciesLabel: string;
    taskDependenciesBlocked: string;
    workflowRun: string;
    viewWorkflowRunDetails: string;
    retryWorkflowNode: string;
    retryingWorkflowNode: string;
    retryWorkflowNodeTitle: string;
    retryWorkflowNodeHelp: string;
    workflowRunDetailsTitle: string;
    workflowRunProgressLabel: string;
    workflowRunCurrentNode: (current: number, total: number) => string;
    workflowRunProgressUnknown: string;
    workflowRunTemplateLabel: string;
    workflowRunInputsLabel: string;
    workflowRunOutputsLabel: string;
    workflowRunDependsOnLabel: string;
    workflowRunUsesLabel: string;
    workflowRunInstructionLabel: string;
    workflowRunExitCriteriaLabel: string;
    workflowRunProcessLabel: string;
    workflowRunOutputLabel: string;
    workflowRunErrorLabel: string;
    workflowRunNodeRunIdLabel: string;
    workflowRunUpdatedAtLabel: string;
    workflowRunNoNodeMetadata: string;
    workflowRunNoProcessDetails: string;
    workflowRunRunningNoProcessDetails: string;
    workflowRunFailedNoProcessDetails: string;
    workflowRunSucceededNoProcessDetails: string;
    noDependency: string;
    requirementsEyebrow: string;
    requirementsHeading: string;
    requirementsLabel: string;
    allRequirementsHeading: string;
    allRequirementsBody: string;
    viewAllRequirements: string;
    noRequirements: string;
    chooseDecompositionExecutor: string;
    chooseDecompositionExecutorHelp: string;
    continueDecomposition: string;
    decompositionEstimatedTime: (seconds: number) => string;
    decompositionRunningHelp: string;
    decompositionRunningTitle: string;
    executorInProgressLabel: string;
    planRequirement: string;
    startDecomposition: string;
    generateTasks: string;
    editRequirement: string;
    answerClarification: string;
    answerClarificationAriaLabel: (title: string) => string;
    clarificationDialogTitle: string;
    clarificationDialogHelp: string;
    clarificationQuestionsLabel: string;
    clarificationAnswerLabel: string;
    clarificationAnswerHelp: string;
    clarificationAnswerSectionTitle: string;
    saveClarificationAnswer: string;
    requirementNameLabel: string;
    requirementBodyLabel: string;
    renameRequirement: string;
    cancelRequirementEdit: string;
    saveRequirementName: string;
    saveRequirement: string;
    requirementRenameHelp: string;
    requirementBodyHelp: string;
    requirementIdLabel: string;
    requirementProjectLabel: string;
    requirementWorkflowLabel: string;
    requirementCreatedLabel: string;
    requirementUpdatedLabel: string;
    requirementStatusLabel: string;
    decompositionItemsLabel: string;
    decompositionResultTitle: string;
    decompositionResultHelp: string;
    decompositionSummaryLabel: string;
    decompositionItemLabel: string;
    decompositionItemTitleLabel: string;
    decompositionItemBodyLabel: string;
    decompositionItemDependenciesLabel: string;
    decompositionItemDependenciesHelp: string;
    saveDecompositionResult: string;
    executorLabel: string;
    modelApiExecutorLabel: string;
    linkedTasksLabel: string;
    nextActionLabel: string;
    unknownProject: string;
    unknownWorkflowTemplate: string;
    noDecompositionItems: string;
    itemsCount: (count: number) => string;
    tasksCount: (count: number) => string;
    nextActionPlan: string;
    nextActionDecomposing: string;
    nextActionGenerateTasks: string;
    nextActionTrackTasks: string;
    nextActionDone: string;
    nextActionResolveError: string;
    nextActionAnswerClarification: string;
    moreRequirementActions: string;
    resetRequirement: string;
    resetRequirementHelp: string;
    resetRequirementConfirmTitle: string;
    resetRequirementConfirmBody: string;
    confirmRequirementReset: string;
    deleteRequirement: string;
    deleteRequirementAction: string;
    requirementDeleteHelp: string;
    deleteRequirementConfirmTitle: string;
    deleteRequirementConfirmBody: string;
    cancelRequirementAction: string;
    requirementStatus: Record<
      | "init"
      | "decomposing"
      | "decomposition_failed"
      | "ready_to_generate_tasks"
      | "tasks_generated"
      | "completed"
      | "open"
      | "draft",
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
    savingDecompositionResult: string;
    decompositionResultSaved: string;
    generatingTasks: string;
    modelNotConfigured: string;
    savingRequirement: string;
    renamedRequirement: string;
    clarificationAnswerSaved: string;
    requirementUpdateFailed: string;
    savingWorkflow: string;
    renamedWorkflow: string;
    workflowUpdateFailed: string;
    deletingRequirement: string;
    deletedRequirement: string;
    requirementDeletionFailed: string;
    resettingRequirement: string;
    resetRequirement: string;
    requirementResetFailed: string;
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
    skillListUnavailable: string;
    savingSkill: string;
    skillSaved: string;
    updatingSkill: string;
    skillUpdated: string;
    skillUpdateFailed: string;
    deletingSkill: string;
    skillDeleted: string;
    skillDeletionFailed: string;
    importTaskWorkflowFirst: string;
    startingWorkflowRun: string;
    runningAllTaskWorkflows: string;
    ranAllTaskWorkflows: string;
    runAllTaskWorkflowsFailed: string;
    retryingWorkflowNode: string;
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
      skillSectionTitle: "Skill library",
      skillSectionDescription:
        "Upload reusable Skill definitions that Workflow Nodes can reference.",
      skillPlaneLabel: "Skill registry",
      skillScopeLabel: "Workflow Node tools",
      skillUploadTitle: "Upload Skill",
      skillUploadDescription:
        "Store the Skill content and expose its ref to Workflow templates.",
      skillNameLabel: "Skill name",
      skillRefLabel: "Skill ref",
      skillDescriptionLabel: "Description",
      skillFileLabel: "Skill zip",
      skillSourceUrlLabel: "Skill source URL",
      skillSourceUrlPlaceholder: "Enter a GitHub or zip URL",
      skillSourceUrlHelp:
        "GitHub tree, GitHub archive, raw SKILL.md, or zip URL. Forge validates SKILL.md before import.",
      skillBodyLabel: "Skill body",
      uploadSkill: "Upload Skill",
      uploadSkillZip: "Upload zip",
      importSkillFromLink: "Import from link",
      confirmSkillUpload: "Confirm upload",
      skillUploadChooseFiles: "Choose zip",
      skillUploadNoFileTitle: "No Skill zip selected",
      skillUploadNoFileDescription:
        "Select a .zip package that contains SKILL.md and optional references.",
      skillUploadSelectedTitle: "Selected zip",
      skillUploadValidationHelp:
        "Upload one .zip package. The archive must include SKILL.md with name and description frontmatter.",
      skillUploadFileCount: () => "1 zip selected",
      viewSkill: "View Skill",
      linkedSkillSource: "Linked source",
      updateSkillFromSource: "Update from source",
      deleteSkill: "Delete Skill",
      skillLibraryLabel: "Skill library",
      skillLibraryTitle: "Uploaded Skills",
      skillLibraryDescription:
        "These refs are available in the Workflow builder tool selector.",
      skillContentsTitle: "Skill contents",
      skillFileTreeTitle: "File tree",
      skillPreviewTitle: "Preview",
      noSkills: "No Skills uploaded yet.",
      localBridgeSectionTitle: "Local bridge",
      modelSectionTitle: "Model settings",
      modelSectionDescription:
        "Configure the model planner and the local Agent execution entrypoint.",
      modelApiPlaneLabel: "Planning plane",
      modelApiScopeLabel: "Requirement to Task planning",
      modelApiBlockTitle: "Model API",
      modelApiBlockDescription:
        "Used when Forge plans Requirements into Tasks.",
      defaultExecutorTitle: "Default executor",
      defaultExecutorDescription:
        "Project default for generated Tasks and Workflow Runs unless a run overrides it.",
      defaultExecutorTypeLabel: "Executor source",
      agentBindingExecutorLabel: "Agent Binding",
      defaultAgentBindingLabel: "Default Agent Binding",
      noAgentBindings: "No Agent Bindings",
      agentSectionTitle: "Agent execution",
      agentSectionDescription:
        "Used when Forge starts Task Workflows through the local bridge.",
      agentProxyPlaneLabel: "Execution bridge",
      agentProxyScopeLabel: "Task Workflow dispatch",
      agentProxyBlockTitle: "Local bridge",
      agentProxySetupTitle: "CLI initialization path",
      agentProxySetupDescription:
        "Expected setup is: install forgecli, run forgecli bridge bind --server <Forge Server URL>, run forgecli agent add <name> --connector <cli|mcp> --command <command>, then run forgecli bridge start.",
      agentProxySetupHelpLabel: "How to get forgecli",
      agentProxyCliUnavailable:
        "CLI setup is not available in this build. Paste an existing local bridge URL only if you already run one.",
      cliDownloadTitle: "Download forgecli",
      cliDownloadIntro:
        "Get forgecli first, then run the local bridge commands from this setup path.",
      cliDownloadRelease:
        "Direct download URL served by this Forge Server:",
      cliDownloadLocalBuild:
        "If the URL returns 404, run pnpm release from the repository root to populate release/. For local development without release packaging, run pnpm build:forgecli.",
      cliDownloadNextStep:
        "After installing or building it, bind this Forge Server, register an Agent Binding, and start the bridge.",
      closeCliDownloadHelp: "Close CLI download help",
      registeredAgentBindingsTitle: "Registered Agent Bindings",
      registeredAgentBindingsDescription:
        "These names are registered by the local bridge and appear in executor selection.",
      noRegisteredAgentBindings:
        "No Agent Binding has been registered by the local bridge.",
      agentBindingCommandLabel: "Command",
      agentBindingCapabilitiesLabel: "Capabilities",
      agentBindingLastSeenLabel: "Last seen",
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
      saveDefaultExecutor: "Save default executor",
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
        "Create a Task Workflow Template by naming nodes, Skills, outputs, and retry budgets.",
      builderNameLabel: "Template name",
      builderNameHelp:
        "Human-readable name shown in the Workflow template library.",
      builderNodesTitle: "Workflow Nodes",
      builderNodeIdLabel: "Node ID",
      builderNodeIdHelp:
        "Stable identifier used by dependencies and run history.",
      builderNodeTypeLabel: "Node type",
      builderNodeTypeHelp:
        "Semantic label for what this Workflow Node does. It is not the node name.",
      builderSkillLabel: "Skill",
      builderSkillHelp:
        "Optional reusable tool instructions for this Workflow Node.",
      builderNoSkill: "No Skill",
      builderOutputLabel: "Output file",
      builderOutputHelp:
        "Artifact file this Workflow Node should produce.",
      builderRetriesLabel: "Retries",
      builderRetriesHelp:
        "How many times Forge may retry this Workflow Node.",
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
        "Review node order, Skill usage, retry budget, outputs, and dependencies.",
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
      reviewLabel: "Review",
      reviewMode: (mode) => `Review: ${mode}`,
      humanReviewLabel: "Human",
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
      taskBoardFilterAll: "All",
      taskBoardRequirementFilterLabel: "Requirement",
      noTasks: "No Tasks",
      sourceLabel: "Source",
      runWorkflowTemplateLabel: "Task Workflow Template",
      importTaskWorkflowTemplateFirst: "Import a Task Workflow Template first",
      chooseWorkflowRunExecutors: "Choose Workflow Run executors",
      chooseWorkflowRunExecutorsHelp:
        "Each Workflow Node uses the Project default executor unless you override it for this run.",
      workflowNodeExecutorLabel: "Workflow Node executor",
      useDefaultExecutor: "Project default",
      startRun: "Start Run",
      runAllTaskWorkflows: "Run all",
      rerunWorkflow: "Rerun Workflow",
      noRunsForTask: "No runs started for this Task.",
      taskDependenciesLabel: "Depends on",
      taskDependenciesBlocked: "Waiting for dependency Task completion.",
      workflowRun: "Task Workflow",
      viewWorkflowRunDetails: "View details",
      retryWorkflowNode: "Retry node",
      retryingWorkflowNode: "Retrying",
      retryWorkflowNodeTitle: "Retry from this Workflow Node",
      retryWorkflowNodeHelp:
        "Completed dependencies stay unchanged. This node and downstream nodes will run again.",
      workflowRunDetailsTitle: "Workflow Run details",
      workflowRunProgressLabel: "Progress",
      workflowRunCurrentNode: (current, total) =>
        `Current node ${current} / ${total}`,
      workflowRunProgressUnknown: "No node progress yet",
      workflowRunTemplateLabel: "Template",
      workflowRunInputsLabel: "Inputs",
      workflowRunOutputsLabel: "Outputs",
      workflowRunDependsOnLabel: "Depends on",
      workflowRunUsesLabel: "Uses",
      workflowRunInstructionLabel: "Instruction",
      workflowRunExitCriteriaLabel: "Exit Criteria",
      workflowRunProcessLabel: "Execution trace",
      workflowRunOutputLabel: "Output",
      workflowRunErrorLabel: "Error",
      workflowRunNodeRunIdLabel: "Node Run",
      workflowRunUpdatedAtLabel: "Updated",
      workflowRunNoNodeMetadata: "Not declared",
      workflowRunNoProcessDetails:
        "Process details have not been captured yet.",
      workflowRunRunningNoProcessDetails:
        "This Workflow Node is running. Output will appear here when the execution returns.",
      workflowRunFailedNoProcessDetails:
        "This Workflow Node failed before execution details were captured. Start a new run to persist the error message.",
      workflowRunSucceededNoProcessDetails:
        "This Workflow Node completed before execution output was captured.",
      noDependency: "No dependency",
      requirementsEyebrow: "Requirements",
      requirementsHeading: "Current Requirement",
      requirementsLabel: "Requirements",
      allRequirementsHeading: "All Requirements",
      allRequirementsBody:
        "Review, edit, decompose, generate Tasks, or remove active Requirements in the current Project.",
      viewAllRequirements: "View all Requirements",
      noRequirements: "No Requirements submitted yet.",
      chooseDecompositionExecutor: "Choose decomposition executor",
      chooseDecompositionExecutorHelp:
        "Pick the Model API or an Agent Binding for this decomposition run. Generated task proposals can still be edited before Tasks are created.",
      continueDecomposition: "View progress",
      decompositionEstimatedTime: (seconds) => `May take about ${seconds}s.`,
      decompositionRunningHelp:
        "Forge is decomposing this Requirement asynchronously. You can close this dialog and return later.",
      decompositionRunningTitle: "Requirement decomposition in progress",
      executorInProgressLabel: "Selected executor",
      planRequirement: "Decompose Requirement",
      startDecomposition: "Start decomposition",
      generateTasks: "Generate Tasks",
      editRequirement: "Edit",
      answerClarification: "Answer questions",
      answerClarificationAriaLabel: (title) =>
        `Answer clarification for ${title}`,
      clarificationDialogTitle: "Answer questions",
      clarificationDialogHelp:
        "Fill in the missing context Forge needs before decomposing this Requirement again.",
      clarificationQuestionsLabel: "Questions",
      clarificationAnswerLabel: "Your answers",
      clarificationAnswerHelp:
        "Answers will be appended to the Requirement description, then Forge will decompose the Requirement again.",
      clarificationAnswerSectionTitle: "Clarification answers:",
      saveClarificationAnswer: "Submit answers and decompose",
      requirementNameLabel: "Requirement name",
      requirementBodyLabel: "Requirement description",
      renameRequirement: "Rename",
      cancelRequirementEdit: "Cancel",
      saveRequirementName: "Save name",
      saveRequirement: "Save Requirement",
      requirementRenameHelp:
        "Requirement names must be unique in the current Project.",
      requirementBodyHelp:
        "Keep the expected outcome, constraints, and acceptance context current.",
      moreRequirementActions: "More Requirement actions",
      resetRequirement: "Reset Requirement",
      resetRequirementHelp:
        "Returns this Requirement to the pre-decomposition state and hides generated Tasks.",
      resetRequirementConfirmTitle: "Reset this Requirement?",
      resetRequirementConfirmBody:
        "This will remove the current decomposition result, hide linked Tasks, and let you run decomposition again.",
      confirmRequirementReset: "Reset Requirement",
      deleteRequirement: "Delete",
      deleteRequirementAction: "Delete Requirement",
      requirementDeleteHelp: "Soft deletes this Requirement and hides linked Tasks.",
      deleteRequirementConfirmTitle: "Delete this Requirement?",
      deleteRequirementConfirmBody:
        "This will soft delete the Requirement and hide linked Tasks from active lists.",
      cancelRequirementAction: "Cancel",
      requirementIdLabel: "Requirement ID",
      requirementProjectLabel: "Project",
      requirementWorkflowLabel: "Workflow File",
      requirementCreatedLabel: "Created",
      requirementUpdatedLabel: "Updated",
      requirementStatusLabel: "Status",
      decompositionItemsLabel: "Decomposition items",
      modelApiExecutorLabel: "Model API",
      linkedTasksLabel: "Linked Tasks",
      nextActionLabel: "Next action",
      unknownProject: "Unknown Project",
      unknownWorkflowTemplate: "Unknown Workflow File",
      noDecompositionItems: "No decomposition result",
      itemsCount: (count) => `${count} ${count === 1 ? "item" : "items"}`,
      tasksCount: (count) => `${count} ${count === 1 ? "Task" : "Tasks"}`,
      nextActionPlan: "Decompose Requirement",
      nextActionDecomposing: "View decomposition progress",
      nextActionGenerateTasks: "Generate Tasks",
      nextActionTrackTasks: "Track generated Tasks",
      nextActionDone: "Review accepted output",
      nextActionResolveError: "Resolve decomposition failure",
      nextActionAnswerClarification: "Answer clarification questions",
      decompositionResultTitle: "Decomposition result",
      decompositionResultHelp: "Review generated Tasks before creating work.",
      saveDecompositionResult: "Save decomposition",
      decompositionSummaryLabel: "Summary",
      decompositionItemLabel: "Task draft",
      decompositionItemTitleLabel: "Title",
      decompositionItemBodyLabel: "Body",
      decompositionItemDependenciesLabel: "Depends on",
      decompositionItemDependenciesHelp:
        "Select prerequisite items that must finish before this Task can start.",
      executorLabel: "Executor",
      requirementStatus: {
        completed: "Completed",
        decomposing: "Decomposing",
        decomposition_failed: "Decomposition failed",
        draft: "Draft",
        init: "Initialized",
        open: "Open",
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
      savingDecompositionResult: "Saving decomposition result",
      decompositionResultSaved: "Decomposition result saved",
      generatingTasks: "Generating Tasks",
      modelNotConfigured:
        "Requirement saved. Configure a model in Settings before Forge can create Tasks.",
      savingRequirement: "Saving Requirement",
      renamedRequirement: "Renamed Requirement",
      clarificationAnswerSaved: "Clarification answers saved",
      requirementUpdateFailed: "Requirement update failed",
      savingWorkflow: "Saving Workflow",
      renamedWorkflow: "Renamed Workflow",
      workflowUpdateFailed: "Workflow update failed",
      deletingRequirement: "Deleting Requirement",
      deletedRequirement: "Deleted Requirement",
      requirementDeletionFailed: "Requirement deletion failed",
      resettingRequirement: "Resetting Requirement",
      resetRequirement: "Requirement reset",
      requirementResetFailed: "Requirement reset failed",
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
      skillListUnavailable: "Skill list unavailable",
      savingSkill: "Saving Skill",
      skillSaved: "Skill saved",
      updatingSkill: "Updating Skill",
      skillUpdated: "Skill updated",
      skillUpdateFailed: "Skill update failed",
      deletingSkill: "Deleting Skill",
      skillDeleted: "Skill deleted",
      skillDeletionFailed: "Skill deletion failed",
      importTaskWorkflowFirst: "Import a task .wf first",
      startingWorkflowRun: "Starting Task Workflow",
      runningAllTaskWorkflows: "Running all Task Workflows",
      ranAllTaskWorkflows: "All Task Workflows finished",
      runAllTaskWorkflowsFailed: "Run all failed",
      retryingWorkflowNode: "Retrying Workflow Node",
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
      skillSectionTitle: "Skill 库",
      skillSectionDescription: "上传可复用的 Skill 定义，供 Workflow Node 引用。",
      skillPlaneLabel: "Skill 注册表",
      skillScopeLabel: "Workflow Node 工具",
      skillUploadTitle: "上传 Skill",
      skillUploadDescription:
        "保存 Skill 内容，并把它的 ref 暴露给工作流模板。",
      skillNameLabel: "Skill 名称",
      skillRefLabel: "Skill ref",
      skillDescriptionLabel: "描述",
      skillFileLabel: "Skill zip",
      skillSourceUrlLabel: "Skill 链接",
      skillSourceUrlPlaceholder: "输入 GitHub 等地址",
      skillSourceUrlHelp:
        "支持 GitHub tree、GitHub archive、raw SKILL.md 或 zip URL。Forge 会先验证 SKILL.md 再导入。",
      skillBodyLabel: "Skill 正文",
      uploadSkill: "上传 Skill",
      uploadSkillZip: "上传 zip",
      importSkillFromLink: "通过链接导入",
      confirmSkillUpload: "确定上传",
      skillUploadChooseFiles: "选择 zip",
      skillUploadNoFileTitle: "未选择 Skill zip",
      skillUploadNoFileDescription: "选择包含 SKILL.md 和可选参考文件的 .zip 包。",
      skillUploadValidationHelp:
        "请上传一个 .zip 包。压缩包内必须包含带 name 和 description frontmatter 的 SKILL.md。",
      skillUploadSelectedTitle: "已选择 zip",
      skillUploadFileCount: () => "已选择 1 个 zip",
      viewSkill: "查看",
      linkedSkillSource: "已链接来源",
      updateSkillFromSource: "从链接更新",
      deleteSkill: "删除",
      skillLibraryLabel: "Skill 库",
      skillLibraryTitle: "已上传 Skills",
      skillLibraryDescription:
        "这些 ref 会出现在工作流构建器的工具选择里。",
      skillContentsTitle: "Skill 内容",
      skillFileTreeTitle: "文件树",
      skillPreviewTitle: "预览",
      noSkills: "还没有上传 Skill。",
      localBridgeSectionTitle: "本地桥接",
      modelSectionTitle: "模型配置",
      modelSectionDescription: "配置用于拆解需求的模型，以及本地桥接。",
      modelApiPlaneLabel: "模型配置",
      modelApiScopeLabel: "拆解需求",
      modelApiBlockTitle: "模型 API",
      modelApiBlockDescription: "用于 Forge 拆解需求。",
      defaultExecutorTitle: "默认执行方",
      defaultExecutorDescription:
        "当前项目生成任务和启动 Workflow Run 时默认使用，也可在单次运行中覆盖。",
      defaultExecutorTypeLabel: "执行方来源",
      agentBindingExecutorLabel: "Agent Binding",
      defaultAgentBindingLabel: "默认 Agent Binding",
      noAgentBindings: "暂无 Agent Binding",
      agentSectionTitle: "Agent 管理",
      agentSectionDescription: "用于 Forge 通过本地桥接启动任务工作流。",
      agentProxyPlaneLabel: "本地桥接",
      agentProxyScopeLabel: "任务工作流分发",
      agentProxyBlockTitle: "本地桥接",
      agentProxySetupTitle: "CLI 初始化路径",
      agentProxySetupDescription:
        "预期配置路径是：安装 forgecli，执行 forgecli bridge bind --server <Forge Server URL>，执行 forgecli agent add <name> --connector <cli|mcp> --command <command> 命名并注册 Agent Binding，然后执行 forgecli bridge start。",
      agentProxySetupHelpLabel: "如何获取 forgecli",
      agentProxyCliUnavailable:
        "当前 build 还不能通过 CLI 完成初始化。如果你已经有本地桥接，才需要在这里粘贴 URL。",
      cliDownloadTitle: "下载 forgecli",
      cliDownloadIntro:
        "先获取 forgecli，再按这里的初始化路径启动本地桥接。",
      cliDownloadRelease:
        "由当前 Forge Server 提供的直接下载地址：",
      cliDownloadLocalBuild:
        "如果下载地址返回 404，请先在仓库根目录执行 pnpm release 生成 release/。本地开发不打包时，可执行 pnpm build:forgecli。",
      cliDownloadNextStep:
        "安装或构建完成后，绑定当前 Forge Server，注册 Agent Binding，再启动本地桥接。",
      closeCliDownloadHelp: "关闭 CLI 下载帮助",
      registeredAgentBindingsTitle: "已注册 Agent Bindings",
      registeredAgentBindingsDescription:
        "这些名称由本地桥接注册，会出现在执行方选择里。",
      noRegisteredAgentBindings: "本地桥接尚未注册 Agent Binding。",
      agentBindingCommandLabel: "命令",
      agentBindingCapabilitiesLabel: "能力",
      agentBindingLastSeenLabel: "最近在线",
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
      saveDefaultExecutor: "保存默认执行方",
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
        "通过填写节点、Skill、输出和重试次数，可视化创建 Task Workflow Template。",
      builderNameLabel: "模板名称",
      builderNameHelp:
        "展示在工作流模板库里的可读名称。",
      builderNodesTitle: "Workflow Nodes",
      builderNodeIdLabel: "Node ID",
      builderNodeIdHelp:
        "稳定标识，用于依赖关系和运行记录。",
      builderNodeTypeLabel: "节点类型",
      builderNodeTypeHelp:
        "描述这个 Workflow Node 做什么的语义类别，不是节点名称。",
      builderSkillLabel: "Skill",
      builderSkillHelp:
        "可选，为这个 Workflow Node 关联可复用的工具说明。",
      builderNoSkill: "不使用 Skill",
      builderOutputLabel: "输出文件",
      builderOutputHelp:
        "这个 Workflow Node 预期产出的产物文件。",
      builderRetriesLabel: "重试次数",
      builderRetriesHelp:
        "Forge 可以重试这个 Workflow Node 的次数。",
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
        "查看节点顺序、Skill 使用、重试次数、输出和依赖关系。",
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
      reviewLabel: "评审",
      reviewMode: (mode) => `评审：${mode}`,
      humanReviewLabel: "人工",
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
      taskBoardFilterAll: "全部",
      taskBoardRequirementFilterLabel: "需求",
      noTasks: "暂无任务",
      sourceLabel: "来源",
      runWorkflowTemplateLabel: "Task Workflow Template",
      importTaskWorkflowTemplateFirst: "请先导入 Task Workflow Template",
      chooseWorkflowRunExecutors: "选择任务工作流执行方",
      chooseWorkflowRunExecutorsHelp:
        "每个 Workflow Node 默认使用项目默认执行方，也可以只为本次运行单独覆盖。",
      workflowNodeExecutorLabel: "Workflow Node 执行方",
      useDefaultExecutor: "项目默认",
      startRun: "开始任务",
      runAllTaskWorkflows: "运行全部",
      rerunWorkflow: "重新运行工作流",
      noRunsForTask: "这个任务还没有启动任务工作流。",
      taskDependenciesLabel: "前置依赖",
      taskDependenciesBlocked: "正在等待前置任务完成。",
      workflowRun: "任务工作流",
      viewWorkflowRunDetails: "查看详情",
      retryWorkflowNode: "重试节点",
      retryingWorkflowNode: "重试中",
      retryWorkflowNodeTitle: "从这个 Workflow Node 重试",
      retryWorkflowNodeHelp:
        "已完成的前置节点会保留，这个节点和后续节点会重新执行。",
      workflowRunDetailsTitle: "Workflow Run 详情",
      workflowRunProgressLabel: "执行进度",
      workflowRunCurrentNode: (current, total) =>
        `当前节点 ${current} / ${total}`,
      workflowRunProgressUnknown: "暂无节点进度",
      workflowRunTemplateLabel: "模板",
      workflowRunInputsLabel: "输入",
      workflowRunOutputsLabel: "输出",
      workflowRunDependsOnLabel: "前置节点",
      workflowRunUsesLabel: "使用资源",
      workflowRunInstructionLabel: "Prompt / 指令",
      workflowRunExitCriteriaLabel: "退出条件",
      workflowRunProcessLabel: "执行过程",
      workflowRunOutputLabel: "输出",
      workflowRunErrorLabel: "错误",
      workflowRunNodeRunIdLabel: "Node Run",
      workflowRunUpdatedAtLabel: "更新时间",
      workflowRunNoNodeMetadata: "未声明",
      workflowRunNoProcessDetails: "执行过程详情尚未回传。",
      workflowRunRunningNoProcessDetails:
        "这个 Workflow Node 正在执行，模型或 Agent 返回后会在这里显示输出。",
      workflowRunFailedNoProcessDetails:
        "这个 Workflow Node 已失败，但它发生在详情持久化修复前，未记录错误详情。重新启动任务后会保存错误信息。",
      workflowRunSucceededNoProcessDetails:
        "这个 Workflow Node 已完成，但它发生在详情持久化修复前，未记录输出。",
      noDependency: "无依赖",
      requirementsEyebrow: "需求",
      requirementsHeading: "当前需求",
      requirementsLabel: "需求",
      allRequirementsHeading: "全部需求",
      allRequirementsBody:
        "在当前项目内查看、编辑、拆解、生成任务或移除仍然有效的需求。",
      viewAllRequirements: "查看全部需求",
      noRequirements: "暂无已创建需求。",
      chooseDecompositionExecutor: "选择拆解执行方",
      chooseDecompositionExecutorHelp:
        "为本次拆解选择模型 API 或 Agent Binding。拆解出的任务草稿在生成任务前仍可编辑。",
      continueDecomposition: "查看进度",
      decompositionEstimatedTime: (seconds) => `可能需要约 ${seconds} 秒。`,
      decompositionRunningHelp:
        "Forge 正在异步拆解这个需求。可以关闭弹窗，稍后从需求行继续查看。",
      decompositionRunningTitle: "需求拆解中",
      executorInProgressLabel: "已选择执行方",
      planRequirement: "拆解需求",
      startDecomposition: "开始拆解",
      generateTasks: "生成任务",
      editRequirement: "编辑",
      answerClarification: "填写回答",
      answerClarificationAriaLabel: (title) => `填写 ${title} 的澄清回答`,
      clarificationDialogTitle: "填写回答",
      clarificationDialogHelp:
        "补充 Forge 拆解需求前缺少的上下文，提交后会立即重新拆解需求。",
      clarificationQuestionsLabel: "需要回答的问题",
      clarificationAnswerLabel: "你的回答",
      clarificationAnswerHelp:
        "回答会追加到需求描述中，Forge 会立即重新拆解需求。",
      clarificationAnswerSectionTitle: "澄清回答：",
      saveClarificationAnswer: "提交回答并重新拆解",
      requirementNameLabel: "需求名称",
      requirementBodyLabel: "需求描述",
      renameRequirement: "改名",
      cancelRequirementEdit: "取消",
      saveRequirementName: "保存名称",
      saveRequirement: "保存需求",
      requirementRenameHelp: "当前项目内的需求名称不能重复。",
      requirementBodyHelp: "保持目标、约束和验收上下文最新。",
      moreRequirementActions: "更多需求操作",
      resetRequirement: "重置需求",
      resetRequirementHelp: "回退到未拆解任务的状态，并隐藏已生成任务。",
      resetRequirementConfirmTitle: "确认重置这个需求？",
      resetRequirementConfirmBody:
        "这会移除当前拆解结果，隐藏关联任务，并允许重新触发拆解。",
      confirmRequirementReset: "重置需求",
      deleteRequirement: "删除",
      deleteRequirementAction: "删除需求",
      requirementDeleteHelp: "软删除该需求，并隐藏关联任务。",
      deleteRequirementConfirmTitle: "确认删除这个需求？",
      deleteRequirementConfirmBody:
        "这会软删除该需求，并从活跃列表中隐藏关联任务。",
      cancelRequirementAction: "取消",
      requirementIdLabel: "需求 ID",
      requirementProjectLabel: "项目",
      requirementWorkflowLabel: "工作流文件",
      requirementCreatedLabel: "创建时间",
      requirementUpdatedLabel: "更新时间",
      requirementStatusLabel: "状态",
      decompositionItemsLabel: "拆解条目",
      modelApiExecutorLabel: "模型 API",
      linkedTasksLabel: "关联任务",
      nextActionLabel: "下一步",
      unknownProject: "未知项目",
      unknownWorkflowTemplate: "未知工作流文件",
      noDecompositionItems: "暂无拆解结果",
      itemsCount: (count) => `${count} 个条目`,
      tasksCount: (count) => `${count} 个任务`,
      nextActionPlan: "拆解需求",
      nextActionDecomposing: "查看拆解进度",
      nextActionGenerateTasks: "生成任务",
      nextActionTrackTasks: "跟进已生成任务",
      nextActionDone: "复核已验收产物",
      nextActionResolveError: "处理拆解失败",
      nextActionAnswerClarification: "填写澄清回答",
      decompositionResultTitle: "拆解结果",
      decompositionResultHelp: "生成任务前先复核任务草稿。",
      saveDecompositionResult: "保存拆解结果",
      decompositionSummaryLabel: "摘要",
      decompositionItemLabel: "任务草稿",
      decompositionItemTitleLabel: "标题",
      decompositionItemBodyLabel: "正文",
      decompositionItemDependenciesLabel: "前置依赖",
      decompositionItemDependenciesHelp:
        "选择必须先完成的拆解条目，后续任务会等待这些任务完成。",
      executorLabel: "执行方",
      requirementStatus: {
        completed: "需求已完成",
        decomposing: "拆解中",
        decomposition_failed: "拆解失败",
        draft: "草稿",
        init: "初始化",
        open: "待拆解",
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
      savingDecompositionResult: "正在保存拆解结果",
      decompositionResultSaved: "拆解结果已保存",
      generatingTasks: "正在生成任务",
      modelNotConfigured:
        "需求已保存。请先在设置里完成模型配置，Forge 才能拆解需求。",
      savingRequirement: "正在保存需求",
      renamedRequirement: "已改名需求",
      clarificationAnswerSaved: "澄清回答已保存",
      requirementUpdateFailed: "需求更新失败",
      savingWorkflow: "正在保存工作流模板",
      renamedWorkflow: "已重命名工作流模板",
      workflowUpdateFailed: "工作流模板更新失败",
      deletingRequirement: "正在删除需求",
      deletedRequirement: "已删除需求",
      requirementDeletionFailed: "需求删除失败",
      resettingRequirement: "正在重置需求",
      resetRequirement: "需求已重置",
      requirementResetFailed: "需求重置失败",
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
      skillListUnavailable: "Skill 列表不可用",
      savingSkill: "正在保存 Skill",
      skillSaved: "Skill 已保存",
      updatingSkill: "正在更新 Skill",
      skillUpdated: "Skill 已更新",
      skillUpdateFailed: "Skill 更新失败",
      deletingSkill: "正在删除 Skill",
      skillDeleted: "Skill 已删除",
      skillDeletionFailed: "Skill 删除失败",
      importTaskWorkflowFirst: "请先导入工作流模板",
      startingWorkflowRun: "正在启动任务工作流",
      runningAllTaskWorkflows: "正在运行全部任务工作流",
      ranAllTaskWorkflows: "全部任务工作流已完成",
      runAllTaskWorkflowsFailed: "运行全部失败",
      retryingWorkflowNode: "正在重试 Workflow Node",
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
