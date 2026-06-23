import {
  createHealthPayload,
  parseWorkflowFile,
  planWorkflowDag,
  readLegacyWorkflowScope,
  workflowFileSchema,
  type WorkflowFile
} from "@forge/core";
import {
  artifactStorageModes,
  agentConnectorTypes,
  createInMemoryDecompositionResultRepository,
  createInMemoryBridgeRepository,
  createInMemoryExecutionSettingsRepository,
  createInMemoryProjectRepository,
  createInMemoryRequirementRepository,
  createInMemorySkillRepository,
  createInMemoryTaskRepository,
  createInMemoryWorkflowRunRepository,
  createInMemoryWorkflowFileRepository,
  dbStrategies,
  executorTypes,
  modelProviderDefaults,
  modelProviderKinds,
  type AgentBinding,
  type ExecutionSettings,
  type ExecutionSettingsRepository,
  type BridgeJob,
  type BridgeRepository,
  type DecompositionResult,
  type DecompositionResultItemInput,
  type DecompositionResultRepository,
  type ModelProviderKind,
  type NodeRun,
  type ProjectRepository,
  type RequirementRepository,
  type Skill,
  type SkillRepository,
  type Task,
  type TaskRepository,
  type WorkflowFileMetadata,
  type WorkflowRun,
  type WorkflowRunRepository,
  type WorkflowFileRepository
} from "@forge/db";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { serveStatic } from "@hono/node-server/serve-static";
import { generateText, Output, type LanguageModel } from "ai";
import { Hono, type Context } from "hono";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { rm } from "node:fs/promises";
import { z } from "zod";
import {
  getSkillStoragePath,
  parseRemoteSkillSource,
  parseUploadedSkillArchive,
  writeSkillFiles,
  type SkillSourceFetcher
} from "./skill-source.js";
import {
  createTaskWorkflowRunner,
  readExecutorAssignments,
  serializeExecutorAssignments,
  type ExecutorAssignment,
  type TaskWorkflowNodeExecutor
} from "./task-workflow-runner.js";

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  artifactStorageMode: z.enum(artifactStorageModes).optional(),
  dbStrategy: z.enum(dbStrategies).optional(),
  defaultExecutorAgentBindingId: z.string().trim().nullable().optional(),
  defaultExecutorType: z.enum(executorTypes).optional()
});

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).optional(),
  defaultExecutorAgentBindingId: z.string().trim().nullable().optional(),
  defaultExecutorType: z.enum(executorTypes).optional()
});

const importWorkflowFileSchema = z.object({
  source: z.string().trim().min(1),
  templateType: z.enum(["builtin", "custom"]).optional()
});

const updateWorkflowFileSchema = z.object({
  name: z.string().trim().min(1)
});

const skillArchiveSchema = z.object({
  contentBase64: z.string().trim().min(1),
  name: z.string().trim().min(1)
});

const createSkillSchema = z.object({
  archive: skillArchiveSchema.optional(),
  projectId: z.string().trim().min(1).nullable().optional(),
  sourceUrl: z.string().trim().min(1).optional()
}).refine((input) => Boolean(input.archive) !== Boolean(input.sourceUrl), {
  message: "Provide exactly one Skill source"
});

const createRequirementSchema = z.object({
  projectId: z.string().trim().min(1).nullable().optional(),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  workflowFileId: z.string().trim().min(1)
});

const updateRequirementSchema = z.object({
  body: z.string().trim().min(1),
  title: z.string().trim().min(1)
});

const updateExecutionSettingsSchema = z.object({
  agentProxyUrl: z.string().trim().optional(),
  defaultExecutorAgentBindingId: z.string().trim().nullable().optional(),
  defaultExecutorType: z.enum(executorTypes).optional(),
  modelApiKey: z.string().trim().optional(),
  modelBaseUrl: z.string().trim().min(1).optional(),
  modelName: z.string().trim().min(1).optional(),
  modelProvider: z.enum(modelProviderKinds).optional()
});

function deduplicateWorkflowName(baseName: string, existingNames: string[]) {
  const trimmedBaseName = baseName.trim();
  const usedNames = new Set(existingNames.map((name) => name.trim()));

  if (!usedNames.has(trimmedBaseName)) {
    return trimmedBaseName;
  }

  let suffix = 2;
  let candidateName = `${trimmedBaseName} ${suffix}`;

  while (usedNames.has(candidateName)) {
    suffix += 1;
    candidateName = `${trimmedBaseName} ${suffix}`;
  }

  return candidateName;
}

const baseWorkflowTemplateSemanticKeyByName: Record<string, string> = {
  "autonomous research plan": "research-analysis",
  "code implementation": "software-task",
  "creative writing requirement": "creative-writing-task",
  "creative writing task": "creative-writing-task",
  "human approval": "review-approval",
  "research & writing requirement": "research-writing-task",
  "research & writing task": "research-writing-task",
  "research analysis": "research-analysis",
  "software change task": "software-task",
  "travel guide coding test": "travel-guide-coding-test",
  "writing review": "writing-editing",
  "代码编写模板": "software-task",
  "创意写作拆解模板": "creative-writing-task",
  "创意写作模板": "creative-writing-task",
  "调研分析模板": "research-analysis",
  "调研写作拆解模板": "research-writing-task",
  "调研写作模板": "research-writing-task",
  "评审审批模板": "review-approval",
  "写作编辑模板": "writing-editing",
  "旅行攻略模板": "travel-guide-coding-test",
  "旅行指南编写测试模板": "travel-guide-coding-test",
  "自主测试任务完成": "travel-guide-coding-test"
};
const baseWorkflowTemplateDisplayNameBySemanticKey: Record<string, string> = {
  "creative-writing-task": "创意写作模板",
  "research-analysis": "调研分析模板",
  "research-writing-task": "调研写作模板",
  "review-approval": "评审审批模板",
  "software-task": "代码编写模板",
  "travel-guide-coding-test": "旅行攻略模板",
  "writing-editing": "写作编辑模板"
};
const baseWorkflowTemplateSourceBySemanticKey: Record<string, string> = {
  "travel-guide-coding-test": `name: "旅行攻略模板"
version: "1.1"
inputs:
  - id: task
    type: task
    required: true
skills:
  - id: destination-research
    ref: skill:destination-research
  - id: itinerary-design
    ref: skill:itinerary-design
  - id: local-context
    ref: skill:local-context
  - id: editorial-review
    ref: skill:editorial-review
agents:
  - id: researcher
    role: travel-researcher
  - id: planner
    role: itinerary-planner
  - id: editor
    role: travel-editor
artifacts:
  - id: trip-brief
    type: markdown
    path: trip-brief.md
  - id: itinerary
    type: markdown
    path: itinerary.md
  - id: local-notes
    type: markdown
    path: local-notes.md
  - id: guide
    type: markdown
    path: travel-guide.md
nodes:
  - id: clarify-trip
    type: travel-requirement-brief
    description: Extract destination, traveler profile, dates, budget, pace, constraints, and open questions.
    uses:
      - skill:destination-research
    inputs:
      - task
    instruction:
      text: |
        从 Task 中提取旅行攻略需求，至少覆盖目的地、出行天数、出行人群、预算范围、旅行节奏、兴趣偏好、禁忌或限制条件。
        如果信息缺失，列出必须追问的问题；如果信息足够，给出可直接用于规划的旅行需求简报。
    outputs:
      - artifact: trip-brief
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Trip brief captures destination, duration, traveler profile, budget, pace, interests, and constraints.
        - Missing information is called out as explicit questions instead of being silently invented.
      retryInstruction: 补齐旅行需求简报中的目的地、天数、预算、偏好或限制条件。
  - id: design-itinerary
    type: itinerary-design
    dependsOn: clarify-trip
    uses:
      - skill:itinerary-design
    inputs:
      - artifact:trip-brief
    instruction:
      text: |
        基于旅行需求简报设计每日行程。每一天都要包含上午、下午、晚上安排，说明路线顺序、交通方式、预计耗时、餐饮建议和备选方案。
        行程要避免来回折返，强度要匹配旅行节奏，并标出需要提前预约或购票的项目。
    outputs:
      - artifact: itinerary
    exit:
      maxRetries: 2
      review: model
      criteria:
        - Daily itinerary is ordered by geography and time of day.
        - Each day includes transport, estimated duration, meal suggestions, and backup options.
        - Reservation or ticketing needs are visible.
      retryInstruction: 调整每日行程，让路线更顺、时间更可信，并补齐交通、餐饮和备选方案。
  - id: localize-guide
    type: local-travel-notes
    dependsOn: design-itinerary
    uses:
      - skill:local-context
    inputs:
      - artifact:trip-brief
      - artifact:itinerary
    instruction:
      text: |
        为行程补充当地化信息：交通卡或打车建议、住宿区域选择、预算拆分、餐厅和小吃、文化礼仪、安全风险、天气和装备提醒。
        内容必须服务于这份具体行程，不要写泛泛的城市介绍。
    outputs:
      - artifact: local-notes
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Local notes cover transport, lodging areas, budget, food, etiquette, safety, weather, and packing.
        - Advice is specific to the itinerary rather than generic destination copy.
      retryInstruction: 补齐交通、住宿、预算、餐饮、文化礼仪、安全和装备提醒，并删除泛泛介绍。
  - id: polish-guide
    type: travel-guide-draft
    dependsOn:
      - design-itinerary
      - localize-guide
    uses:
      - skill:editorial-review
    inputs:
      - artifact:trip-brief
      - artifact:itinerary
      - artifact:local-notes
    instruction:
      text: |
        输出一份可直接交付给用户的旅行攻略。结构包括：概览、适合人群、行前准备、每日行程、预算与交通、餐饮推荐、风险提醒、可替换方案。
        语气要具体、克制、可执行；不要承诺未经验证的价格或营业时间，无法确定的信息要标注为需二次确认。
    outputs:
      - artifact: guide
    exit:
      maxRetries: 1
      review: model
      criteria:
        - Final guide is organized, actionable, and ready for a traveler to use.
        - Uncertain prices, opening hours, or seasonal details are marked for confirmation.
        - The guide preserves constraints from the trip brief and does not introduce unsupported assumptions.
      retryInstruction: 重写旅行攻略，使结构完整、建议可执行，并标注需要二次确认的信息。
`
};
const baseWorkflowTemplateBySemanticKey = new Map(
  Object.entries(baseWorkflowTemplateSourceBySemanticKey).map(
    ([semanticKey, source]) => [semanticKey, parseWorkflowFile(source)]
  )
);

function normalizeBaseWorkflowTemplateName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+\d+$/, "");
}

function parseStoredWorkflowDefinition(definition: string): WorkflowFile | null {
  try {
    const parsed = JSON.parse(definition) as WorkflowFile;

    if (
      typeof parsed.name !== "string" ||
      !Array.isArray(parsed.nodes)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isLegacyRequirementWorkflowDefinition(definition: string) {
  return readLegacyWorkflowScope(definition) === "requirement";
}

function getBaseWorkflowTemplateSemanticKey(workflowFile: WorkflowFileMetadata) {
  const parsedWorkflow = parseStoredWorkflowDefinition(workflowFile.definition);
  const names = [workflowFile.name, parsedWorkflow?.name ?? ""];

  for (const name of names) {
    const key =
      baseWorkflowTemplateSemanticKeyByName[
        normalizeBaseWorkflowTemplateName(name)
      ];

    if (key) {
      return key;
    }
  }

  return "";
}

function selectWorkflowFileToKeep(
  currentWorkflowFile: WorkflowFileMetadata,
  candidateWorkflowFile: WorkflowFileMetadata
) {
  if (candidateWorkflowFile.nodeCount !== currentWorkflowFile.nodeCount) {
    return candidateWorkflowFile.nodeCount > currentWorkflowFile.nodeCount
      ? candidateWorkflowFile
      : currentWorkflowFile;
  }

  return candidateWorkflowFile.createdAt < currentWorkflowFile.createdAt
    ? candidateWorkflowFile
    : currentWorkflowFile;
}

async function deleteDuplicateBaseWorkflowTemplates(
  workflowFiles: WorkflowFileRepository
) {
  const existingWorkflowFiles = await workflowFiles.listWorkflowFileMetadata();
  const keptWorkflowFileBySemanticKey = new Map<string, WorkflowFileMetadata>();
  const duplicateWorkflowFileIds = new Set<string>();

  for (const workflowFile of existingWorkflowFiles) {
    const semanticKey = getBaseWorkflowTemplateSemanticKey(workflowFile);

    if (!semanticKey) {
      continue;
    }

    const currentWorkflowFile = keptWorkflowFileBySemanticKey.get(semanticKey);

    if (!currentWorkflowFile) {
      keptWorkflowFileBySemanticKey.set(semanticKey, workflowFile);
      continue;
    }

    const workflowFileToKeep = selectWorkflowFileToKeep(
      currentWorkflowFile,
      workflowFile
    );
    const workflowFileToDelete =
      workflowFileToKeep.id === currentWorkflowFile.id
        ? workflowFile
        : currentWorkflowFile;

    keptWorkflowFileBySemanticKey.set(semanticKey, workflowFileToKeep);
    duplicateWorkflowFileIds.add(workflowFileToDelete.id);
  }

  await Promise.all(
    [...duplicateWorkflowFileIds].map((workflowFileId) =>
      workflowFiles.deleteWorkflowFileMetadata(workflowFileId)
    )
  );

  await Promise.all(
    [...keptWorkflowFileBySemanticKey.entries()].map(
      ([semanticKey, workflowFile]) => {
        const displayName = baseWorkflowTemplateDisplayNameBySemanticKey[semanticKey];
        const workflow = baseWorkflowTemplateBySemanticKey.get(semanticKey);

        if (!displayName) {
          return Promise.resolve();
        }

        if (!workflow && workflowFile.name === displayName) {
          return Promise.resolve();
        }

        return workflowFiles.updateWorkflowFileMetadata({
          ...(workflow
            ? {
                definition: JSON.stringify(workflow),
                nodeCount: workflow.nodes.length
              }
            : {}),
          id: workflowFile.id,
          name: displayName
        });
      }
    )
  );

  return (await workflowFiles.listWorkflowFileMetadata()).map((workflowFile) =>
    getBaseWorkflowTemplateSemanticKey(workflowFile)
      ? { ...workflowFile, templateType: "builtin" as const }
      : workflowFile
  );
}

async function listTasksWithRecoveredWorkflowStatus(
  tasks: TaskRepository,
  workflowRuns: WorkflowRunRepository
) {
  const currentTasks = await tasks.listTasks();
  const runningWorkflowRuns = (await workflowRuns.listWorkflowRuns()).filter(
    (workflowRun) => workflowRun.status === "running"
  );
  const runningTaskIds = new Set(
    runningWorkflowRuns.map((workflowRun) => workflowRun.taskId)
  );

  return Promise.all(
    currentTasks.map((task) =>
      task.status === "init" && runningTaskIds.has(task.id)
        ? tasks.updateTaskStatus({ id: task.id, status: "running" })
        : task
    )
  );
}

const bridgeAgentSchema = z.object({
  capabilities: z.array(z.string().trim().min(1)).optional(),
  command: z.string().trim().min(1),
  connector: z.enum(agentConnectorTypes),
  name: z.string().trim().min(1)
});

const bridgeRegisterSchema = z.object({
  agents: z.array(bridgeAgentSchema).min(1),
  bridgeId: z.string().trim().min(1)
});

const bridgeJobCompletionSchema = z.object({
  errorMessage: z.string().trim().nullable().optional(),
  output: z.string().optional(),
  status: z.enum(["succeeded", "failed"])
});

const plannedTaskSchema = z.object({
  body: z.string().trim().min(1),
  dependsOn: z.array(z.string().trim().min(1)).optional(),
  executorAgentBindingId: z.string().trim().nullable().optional(),
  executorLabel: z.string().trim().optional(),
  executorType: z.enum(executorTypes).optional(),
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1)
});

const plannedTasksSchema = z.object({
  kind: z.literal("tasks").optional(),
  summary: z.string().trim().optional(),
  tasks: z.array(plannedTaskSchema).min(1)
});
const plannedClarificationSchema = z.object({
  kind: z.literal("clarification"),
  questions: z.array(z.string().trim().min(1)).min(1).max(3),
  summary: z.string().trim().optional()
});
const plannedRequirementOutputSchema = z.object({
  kind: z.enum(["tasks", "clarification"]).optional(),
  questions: z.array(z.string().trim().min(1)).min(1).max(3).optional(),
  summary: z.string().trim().optional(),
  tasks: z.array(plannedTaskSchema).min(1).optional()
});
const startRequirementDecompositionSchema = z.object({
  executorAgentBindingId: z.string().trim().nullable().optional(),
  executorType: z.enum(executorTypes).optional()
});

const nodeExecutorAssignmentSchema = z.object({
  executorAgentBindingId: z.string().trim().nullable().optional(),
  executorType: z.enum(executorTypes),
  nodeId: z.string().trim().min(1)
}).strict();

type ExecutorSelection = {
  executorAgentBindingId?: string | null;
  executorType?: "model-api" | "agent-binding";
};

type AppDependencies = {
  agentProxyClient?: AgentProxyClient;
  bridgeRepository?: BridgeRepository;
  decompositionResultRepository?: DecompositionResultRepository;
  executionSettingsRepository?: ExecutionSettingsRepository;
  fetchSkillSource?: SkillSourceFetcher;
  modelApiTester?: ModelApiTester;
  projectRepository?: ProjectRepository;
  requirementPlanner?: RequirementPlanner;
  requirementRepository?: RequirementRepository;
  skillRepository?: SkillRepository;
  skillStorageRoot?: string;
  taskWorkflowNodeExecutor?: TaskWorkflowNodeExecutor;
  taskRepository?: TaskRepository;
  workflowRunRepository?: WorkflowRunRepository;
  workflowFileRepository?: WorkflowFileRepository;
  releaseAssetsRoot?: string;
  webAssetsRoot?: string;
};

type RealtimeEvent =
  | {
      task: Task;
      type: "task.created" | "task.updated";
    }
  | {
      type: "tasks.deleted";
      requirementId: string;
    }
  | {
      type: "workflowRun.created" | "workflowRun.updated";
      workflowRun: WorkflowRun;
    }
  | {
      nodeRun: NodeRun;
      type: "nodeRun.created" | "nodeRun.updated";
      workflowRun: WorkflowRun | null;
    };

type RealtimeEventListener = (event: RealtimeEvent) => void;

function encodeSseEvent(event: RealtimeEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function createRealtimeEventHub() {
  const listeners = new Set<RealtimeEventListener>();

  return {
    createStream(signal?: AbortSignal) {
      let cleanup = () => {};

      return new ReadableStream<Uint8Array>({
        cancel() {
          cleanup();
        },
        start(controller) {
          const encoder = new TextEncoder();
          let closed = false;
          const write = (message: string) => {
            if (!closed) {
              controller.enqueue(encoder.encode(message));
            }
          };
          const listener: RealtimeEventListener = (event) => {
            write(encodeSseEvent(event));
          };
          const heartbeat = setInterval(() => {
            write(`: heartbeat ${Date.now()}\n\n`);
          }, 15000);

          cleanup = () => {
            if (closed) {
              return;
            }

            closed = true;
            clearInterval(heartbeat);
            listeners.delete(listener);
            signal?.removeEventListener("abort", cleanup);
          };

          listeners.add(listener);
          signal?.addEventListener("abort", cleanup, { once: true });
          write(": connected\n\n");
        }
      });
    },
    publish(event: RealtimeEvent) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  };
}

function createRealtimeTaskRepository(
  repository: TaskRepository,
  publish: (event: RealtimeEvent) => void
): TaskRepository {
  return {
    async createTasksFromDecompositionResult(input) {
      const createdTasks = await repository.createTasksFromDecompositionResult(input);

      for (const task of createdTasks) {
        publish({ task, type: "task.created" });
      }

      return createdTasks;
    },
    async deleteTasksForRequirement(requirementId) {
      await repository.deleteTasksForRequirement(requirementId);
      publish({ requirementId, type: "tasks.deleted" });
    },
    getTask: (id) => repository.getTask(id),
    listTasks: () => repository.listTasks(),
    async updateTaskStatus(input) {
      const task = await repository.updateTaskStatus(input);

      publish({ task, type: "task.updated" });

      return task;
    }
  };
}

function createRealtimeWorkflowRunRepository(
  repository: WorkflowRunRepository,
  publish: (event: RealtimeEvent) => void
): WorkflowRunRepository {
  async function getWorkflowRunForNodeRun(nodeRun: NodeRun) {
    const workflowRuns = await repository.listWorkflowRuns();

    return (
      workflowRuns.find(
        (workflowRun) => workflowRun.id === nodeRun.workflowRunId
      ) ?? null
    );
  }

  return {
    async createNodeRun(input) {
      const nodeRun = await repository.createNodeRun(input);
      const workflowRun = await getWorkflowRunForNodeRun(nodeRun);

      publish({ nodeRun, type: "nodeRun.created", workflowRun });

      return nodeRun;
    },
    async createWorkflowRun(input) {
      const workflowRun = await repository.createWorkflowRun(input);

      publish({ type: "workflowRun.created", workflowRun });

      return workflowRun;
    },
    listNodeRuns: (workflowRunId) => repository.listNodeRuns(workflowRunId),
    listWorkflowRuns: (taskId) => repository.listWorkflowRuns(taskId),
    async updateNodeRunStatus(input) {
      const nodeRun = await repository.updateNodeRunStatus(input);
      const workflowRun = await getWorkflowRunForNodeRun(nodeRun);

      publish({ nodeRun, type: "nodeRun.updated", workflowRun });

      return nodeRun;
    },
    async updateWorkflowRunStatus(input) {
      const workflowRun = await repository.updateWorkflowRunStatus(input);

      publish({ type: "workflowRun.updated", workflowRun });

      return workflowRun;
    }
  };
}

function isTaskExecutionFinished(task: Task) {
  return task.status === "pending_acceptance" || task.status === "completed";
}

function getFinalTaskForRequirement(tasks: Task[]) {
  const pendingTasks = new Map(tasks.map((task) => [task.id, task]));
  const orderedTaskIds: string[] = [];

  while (pendingTasks.size > 0) {
    const nextTask = tasks.find(
      (task) =>
        pendingTasks.has(task.id) &&
        task.dependsOn.every((dependencyId) => !pendingTasks.has(dependencyId))
    );

    if (!nextTask) {
      orderedTaskIds.push(...pendingTasks.keys());
      break;
    }

    orderedTaskIds.push(nextTask.id);
    pendingTasks.delete(nextTask.id);
  }

  const finalTaskId = orderedTaskIds.at(-1);

  return finalTaskId
    ? tasks.find((task) => task.id === finalTaskId) ?? null
    : null;
}

type RequirementPlanner = (input: {
  requirement: {
    id: string;
    title: string;
    body: string;
  };
  settings: ExecutionSettings;
  workflowFile: WorkflowFileMetadata;
}) => Promise<PlannedRequirementDecomposition>;

type PlannedRequirementTasks = {
  kind: "tasks";
  items: Array<
    Pick<DecompositionResultItemInput, "body" | "dependsOn" | "id" | "sortOrder" | "title">
  >;
  summary: string;
};

type PlannedRequirementClarification = {
  kind: "clarification";
  questions: string[];
  summary: string;
};

type PlannedRequirementDecomposition =
  | PlannedRequirementTasks
  | PlannedRequirementClarification;

type AgentProxyClient = (input: {
  agentProxyUrl: string;
  nodeRuns: Array<{
    dependsOn: string[];
    id: string;
    nodeId: string;
    sortOrder: number;
    status: string;
  }>;
  task: Task;
  workflowFile: WorkflowFileMetadata;
  workflowRun: WorkflowRun;
}) => Promise<void>;

type ModelApiTester = (settings: ExecutionSettings) => Promise<void>;

export function createApp({
  agentProxyClient,
  bridgeRepository,
  decompositionResultRepository,
  executionSettingsRepository,
  fetchSkillSource,
  modelApiTester,
  projectRepository,
  requirementPlanner,
  requirementRepository,
  skillRepository,
  skillStorageRoot,
  taskRepository,
  taskWorkflowNodeExecutor,
  workflowRunRepository,
  workflowFileRepository,
  releaseAssetsRoot,
  webAssetsRoot
}: AppDependencies = {}) {
  const app = new Hono();
  const api = new Hono();
  const executionSettings =
    executionSettingsRepository ?? createInMemoryExecutionSettingsRepository();
  const bridges = bridgeRepository ?? createInMemoryBridgeRepository();
  const decompositionResults =
    decompositionResultRepository ?? createInMemoryDecompositionResultRepository();
  const projects = projectRepository ?? createInMemoryProjectRepository();
  const requirements =
    requirementRepository ?? createInMemoryRequirementRepository();
  const skills = skillRepository ?? createInMemorySkillRepository();
  const resolvedSkillStorageRoot =
    skillStorageRoot?.trim() || join(homedir(), ".forge", "skills");
  const realtimeEvents = createRealtimeEventHub();
  const tasks = createRealtimeTaskRepository(
    taskRepository ?? createInMemoryTaskRepository(),
    realtimeEvents.publish
  );
  const workflowRuns = createRealtimeWorkflowRunRepository(
    workflowRunRepository ?? createInMemoryWorkflowRunRepository(),
    realtimeEvents.publish
  );
  const workflowFiles =
    workflowFileRepository ?? createInMemoryWorkflowFileRepository();
  const planner = requirementPlanner ?? planRequirementWithModel;
  const taskNodeExecutor =
    taskWorkflowNodeExecutor ?? executeTaskWorkflowNodeWithModel;
  const taskWorkflowRunner = createTaskWorkflowRunner({
    bridges,
    taskNodeExecutor,
    tasks,
    workflowRuns
  });
  const proxyClient = agentProxyClient ?? startWorkflowRunViaAgentProxy;
  const testModelApi = modelApiTester ?? testModelApiWithProvider;
  const skillSourceFetcher = fetchSkillSource ?? fetch;
  const resumingNodeRunIds = new Set<string>();

  async function getExecutorAssignment(
    settings: ExecutionSettings,
    requested?: ExecutorSelection,
    projectDefaults?: {
      defaultExecutorAgentBindingId: string | null;
      defaultExecutorType: "model-api" | "agent-binding";
    } | null
  ): Promise<ExecutorAssignment> {
    const executorType =
      requested?.executorType ??
      projectDefaults?.defaultExecutorType ??
      settings.defaultExecutorType;
    const executorAgentBindingId =
      requested?.executorAgentBindingId === undefined
        ? projectDefaults?.defaultExecutorAgentBindingId ??
          settings.defaultExecutorAgentBindingId
        : requested.executorAgentBindingId;

    if (executorType === "agent-binding") {
      const agentBindings = await bridges.listAgentBindings();
      const agent = agentBindings.find(
        (binding) => binding.id === executorAgentBindingId
      );

      if (!agent) {
        throw new Error("Selected Agent Binding was not found");
      }

      return {
        executorAgentBindingId: agent.id,
        executorLabel: agent.name,
        executorType: "agent-binding" as const
      };
    }

    return {
      executorAgentBindingId: null,
      executorLabel: `Model API · ${settings.modelName}`,
      executorType: "model-api" as const
    };
  }

  async function getProjectDefaults(record: {
    projectId: string | null;
  }) {
    if (!record.projectId) {
      return null;
    }

    const project = (await projects.listProjects()).find(
      (currentProject) => currentProject.id === record.projectId
    );

    if (!project) {
      throw new Error("Selected Project was not found");
    }

    return {
      defaultExecutorAgentBindingId: project.defaultExecutorAgentBindingId,
      defaultExecutorType: project.defaultExecutorType
    };
  }

  async function resolveWorkflowRunExecutorAssignments(input: {
    settings: ExecutionSettings;
    task: Task;
    workflow: WorkflowFile;
    workflowRun: WorkflowRun;
  }) {
    const plannedNodes = planWorkflowDag(input.workflow);
    const storedAssignments = readExecutorAssignments({
      executorAssignments: input.workflowRun.executorAssignments
    });
    const projectDefaults = await getProjectDefaults(input.task);
    const executorAssignments: Record<string, ExecutorAssignment> = {};

    for (const node of plannedNodes) {
      executorAssignments[node.id] =
        storedAssignments[node.id] ??
        (await getExecutorAssignment(input.settings, undefined, projectDefaults));
    }

    return executorAssignments;
  }

  async function getRequirementWorkflowFile(requirement: {
    id: string;
    projectId: string | null;
    workflowFileId: string;
    title: string;
    body: string;
  }) {
    const workflowFile = await workflowFiles.getWorkflowFileMetadata(
      requirement.workflowFileId
    );

    if (!workflowFile) {
      throw new Error("Selected workflow file was not found");
    }

    return workflowFile;
  }

  async function savePlannedDecomposition(input: {
    executor: ExecutorAssignment;
    plannedDecomposition: PlannedRequirementTasks;
    requirement: {
      id: string;
      projectId: string | null;
    };
  }) {
    const decompositionResult =
      await decompositionResults.saveDecompositionResult({
        items: input.plannedDecomposition.items.map((item) => ({
          ...item,
          ...input.executor
        })),
        projectId: input.requirement.projectId,
        requirementId: input.requirement.id,
        summary: input.plannedDecomposition.summary
      });

    const updatedRequirement = await requirements.updateRequirementStatus({
      id: input.requirement.id,
      status: "ready_to_generate_tasks"
    });

    return { decompositionResult, requirement: updatedRequirement };
  }

  async function recordRequirementClarification(input: {
    plannedDecomposition: PlannedRequirementClarification;
    requirement: {
      id: string;
    };
  }) {
    const questions = input.plannedDecomposition.questions
      .map((question) => question.trim())
      .filter(Boolean);
    const errorMessage = [
      input.plannedDecomposition.summary || "Requirement needs clarification.",
      ...questions.map((question) => `- ${question}`)
    ].join("\n");

    return requirements.updateRequirementStatus({
      errorMessage,
      id: input.requirement.id,
      status: "decomposition_failed"
    });
  }

  async function handlePlannedDecomposition(input: {
    executor: ExecutorAssignment;
    plannedDecomposition: PlannedRequirementDecomposition;
    requirement: {
      id: string;
      projectId: string | null;
    };
  }) {
    if (input.plannedDecomposition.kind === "clarification") {
      const requirement = await recordRequirementClarification({
        plannedDecomposition: input.plannedDecomposition,
        requirement: input.requirement
      });

      return { decompositionResult: null, requirement };
    }

    return savePlannedDecomposition({
      executor: input.executor,
      plannedDecomposition: input.plannedDecomposition,
      requirement: input.requirement
    });
  }

  async function startModelDecompositionRun(input: {
    executor: ExecutorAssignment;
    requirement: {
      id: string;
      projectId: string | null;
      workflowFileId: string;
      title: string;
      body: string;
    };
    settings: ExecutionSettings;
    workflowFile: WorkflowFileMetadata;
  }) {
    void (async () => {
      try {
        const plannedDecomposition = await planner({
          requirement: input.requirement,
          settings: input.settings,
          workflowFile: input.workflowFile
        });

        await handlePlannedDecomposition({
          executor: input.executor,
          plannedDecomposition,
          requirement: input.requirement
        });
      } catch (error) {
        await requirements.updateRequirementStatus({
          errorMessage: getErrorMessage(error),
          id: input.requirement.id,
          status: "decomposition_failed"
        });
      }
    })();
  }

  async function completeRequirementDecompositionJob(job: BridgeJob) {
    if (!job.payload || typeof job.payload !== "object") {
      return false;
    }

    const payload = job.payload as {
      executor?: ExecutorAssignment;
      requirement?: {
        id: string;
        projectId: string | null;
      };
      type?: string;
    };

    if (payload.type !== "requirement-decomposition" || !payload.requirement) {
      return false;
    }

    if (job.status === "failed") {
      await requirements.updateRequirementStatus({
        errorMessage: job.errorMessage ?? "Requirement decomposition failed",
        id: payload.requirement.id,
        status: "decomposition_failed"
      });
      return true;
    }

    try {
      const planned = normalizePlannedRequirementOutput(
        plannedRequirementOutputSchema.parse(JSON.parse(job.output ?? "{}"))
      );

      await handlePlannedDecomposition({
        executor: payload.executor ?? {
          executorAgentBindingId: null,
          executorLabel: "Model API",
          executorType: "model-api"
        },
        plannedDecomposition: planned,
        requirement: payload.requirement
      });
    } catch (error) {
      await requirements.updateRequirementStatus({
        errorMessage: `Requirement decomposition returned invalid output: ${getErrorMessage(error)}`,
        id: payload.requirement.id,
        status: "decomposition_failed"
      });
    }

    return true;
  }

  async function resumeRunningModelWorkflowRuns() {
    const settings = await executionSettings.getExecutionSettings();

    if (!isModelConfigured(settings)) {
      return;
    }

    const runningWorkflowRuns = (await workflowRuns.listWorkflowRuns()).filter(
      (workflowRun) => workflowRun.status === "running"
    );

    for (const workflowRun of runningWorkflowRuns) {
      const nodeRuns = await workflowRuns.listNodeRuns(workflowRun.id);
      const runningNodeRun = nodeRuns.find(
        (nodeRun) => nodeRun.status === "running"
      );

      if (!runningNodeRun || resumingNodeRunIds.has(runningNodeRun.id)) {
        continue;
      }

      const [task, workflowFile] = await Promise.all([
        tasks.getTask(workflowRun.taskId),
        workflowFiles.getWorkflowFileMetadata(workflowRun.workflowFileId)
      ]);

      if (!task || !workflowFile) {
        continue;
      }

      const workflow = parseRunnableWorkflowDefinition(workflowFile.definition);
      const node = workflow.nodes.find((candidate) => candidate.id === runningNodeRun.nodeId);

      if (!node) {
        continue;
      }

      const executorAssignments = Object.fromEntries(
        workflow.nodes.map((workflowNode) => [
          workflowNode.id,
          {
            executorAgentBindingId: null,
            executorLabel: `Model API · ${settings.modelName}`,
            executorType: "model-api" as const
          }
        ])
      );

      resumingNodeRunIds.add(runningNodeRun.id);
      setTimeout(() => {
        void taskWorkflowRunner.executeModelNodeAndAdvance({
          executorAssignments,
          node,
          nodeRun: runningNodeRun,
          settings,
          task,
          workflow,
          workflowFile,
          workflowRun
        }).finally(() => {
          resumingNodeRunIds.delete(runningNodeRun.id);
        });
      }, 0);
    }
  }

  api.get("/events", (c) => {
    return new Response(realtimeEvents.createStream(c.req.raw.signal), {
      headers: {
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "content-type": "text/event-stream; charset=utf-8",
        "x-accel-buffering": "no"
      }
    });
  });

  api.get("/health", (c) => c.json(createHealthPayload()));

  api.get("/execution-settings", async (c) => {
    return c.json({
      executionSettings: serializeExecutionSettings(
        await executionSettings.getExecutionSettings()
      )
    });
  });

  api.patch("/execution-settings", async (c) => {
    const payload = updateExecutionSettingsSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid execution settings payload" }, 400);
    }

    return c.json({
      executionSettings: serializeExecutionSettings(
        await executionSettings.updateExecutionSettings(payload.data)
      )
    });
  });

  api.post("/execution-settings/model/test", async (c) => {
    const payload = updateExecutionSettingsSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid model API test payload", ok: false }, 400);
    }

    const settings = createTransientModelSettings(
      await executionSettings.getExecutionSettings(),
      payload.data
    );

    try {
      if (!isModelConfigured(settings)) {
        throw new Error("Model API key is required for this provider");
      }

      await testModelApi(settings);

      return c.json({ ok: true });
    } catch (error) {
      return c.json({ error: getErrorMessage(error), ok: false }, 400);
    }
  });

  api.get("/projects", async (c) => {
    return c.json({ projects: await projects.listProjects() });
  });

  api.post("/projects", async (c) => {
    const payload = createProjectSchema.safeParse(await c.req.json().catch(() => null));

    if (!payload.success) {
      return c.json({ error: "Invalid project payload" }, 400);
    }

    try {
      const project = await projects.createProject(payload.data);

      return c.json(project, 201);
    } catch (error) {
      const message = getErrorMessage(error);

      return c.json(
        { error: message },
        message.toLowerCase().includes("already exists") ? 409 : 400
      );
    }
  });

  api.patch("/projects/:id", async (c) => {
    const payload = updateProjectSchema.safeParse(await c.req.json().catch(() => null));

    if (!payload.success) {
      return c.json({ error: "Invalid project payload" }, 400);
    }

    try {
      const project = await projects.updateProject({
        defaultExecutorAgentBindingId: payload.data.defaultExecutorAgentBindingId,
        defaultExecutorType: payload.data.defaultExecutorType,
        id: c.req.param("id"),
        name: payload.data.name
      });

      return c.json(project);
    } catch (error) {
      const message = getErrorMessage(error);
      const status = message.toLowerCase().includes("already exists")
        ? 409
        : message.toLowerCase().includes("not found")
          ? 404
          : 400;

      return c.json({ error: message }, status);
    }
  });

  api.get("/agent-bindings", async (c) => {
    return c.json({
      agentBindings: (await bridges.listAgentBindings()).map(serializeAgentBinding)
    });
  });

  api.post("/bridges/register", async (c) => {
    const payload = bridgeRegisterSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid local bridge registration payload" }, 400);
    }

    const agents = [];

    for (const agent of payload.data.agents) {
      agents.push(
        await bridges.upsertAgentBinding({
          capabilities: agent.capabilities ?? [agent.connector],
          command: agent.command,
          connector: agent.connector,
          name: agent.name,
          status: "online"
        })
      );
    }

    return c.json({
      agents: agents.map(serializeAgentBinding),
      bridgeId: payload.data.bridgeId
    });
  });

  api.post("/bridges/:bridgeId/heartbeat", async (c) => {
    const payload = bridgeRegisterSchema
      .omit({ bridgeId: true })
      .safeParse(await c.req.json().catch(() => null));

    if (!payload.success) {
      return c.json({ error: "Invalid local bridge heartbeat payload" }, 400);
    }

    const agents = [];

    for (const agent of payload.data.agents) {
      agents.push(
        await bridges.upsertAgentBinding({
          capabilities: agent.capabilities ?? [agent.connector],
          command: agent.command,
          connector: agent.connector,
          name: agent.name,
          status: "online"
        })
      );
    }

    return c.json({
      agents: agents.map(serializeAgentBinding),
      bridgeId: c.req.param("bridgeId")
    });
  });

  api.get("/bridges/:bridgeId/jobs/next", async (c) => {
    const job = await bridges.claimNextBridgeJob(
      c.req.param("bridgeId"),
      await taskWorkflowRunner.listRunnableNodeRunIdsForBridgeJobs()
    );

    if (!job) {
      return c.json({ job: null });
    }

    return c.json({ job: serializeBridgeJob(job) });
  });

  api.post("/bridges/:bridgeId/jobs/:jobId/complete", async (c) => {
    const payload = bridgeJobCompletionSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid local bridge job completion payload" }, 400);
    }

    try {
      const job = await bridges.completeBridgeJob({
        errorMessage: payload.data.errorMessage ?? null,
        id: c.req.param("jobId"),
        output: payload.data.output ?? null,
        status: payload.data.status
      });
      const completedRequirementDecomposition =
        await completeRequirementDecompositionJob(job);

      if (completedRequirementDecomposition) {
        return c.json({ job: serializeBridgeJob(job) });
      }

      const jobPayload =
        job.payload && typeof job.payload === "object"
          ? (job.payload as {
              task?: Task;
              workflowFile?: WorkflowFileMetadata;
              workflowRun?: WorkflowRun;
            })
          : {};
      const completedNodeRun = await workflowRuns.updateNodeRunStatus({
        errorMessage: payload.data.errorMessage ?? null,
        id: job.nodeRunId,
        output: payload.data.output ?? null,
        status: payload.data.status === "succeeded" ? "succeeded" : "failed"
      });

      if (payload.data.status === "failed") {
        await taskWorkflowRunner.failTaskWorkflowRun({
          nodeRun: completedNodeRun,
          taskId: jobPayload.task?.id,
          workflowRunId: job.workflowRunId
        });
      } else if (jobPayload.task && jobPayload.workflowFile && jobPayload.workflowRun) {
        const settings = await executionSettings.getExecutionSettings();
        const workflow = parseRunnableWorkflowDefinition(
          jobPayload.workflowFile.definition
        );

        await taskWorkflowRunner.advanceTaskWorkflowRun({
          executorAssignments: readExecutorAssignments(job.payload),
          settings,
          task: jobPayload.task,
          workflow,
          workflowFile: jobPayload.workflowFile,
          workflowRun: jobPayload.workflowRun
        });
      }

      return c.json({ job: serializeBridgeJob(job) });
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 404);
    }
  });

  api.get("/workflow-files", async (c) => {
    const metadata = await deleteDuplicateBaseWorkflowTemplates(workflowFiles);

    return c.json({
      workflowFiles: metadata.filter(
        (workflowFile) =>
          !isLegacyRequirementWorkflowDefinition(workflowFile.definition)
      )
    });
  });

  api.post("/workflow-files/import", async (c) => {
    const payload = importWorkflowFileSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid workflow import payload" }, 400);
    }

    try {
      if (readLegacyWorkflowScope(payload.data.source) === "requirement") {
        throw new Error("Requirement-scoped Workflow Files are no longer supported");
      }

      const workflow = parseWorkflowFile(payload.data.source);
      const existingWorkflowFiles = await workflowFiles.listWorkflowFileMetadata();
      const workflowName = deduplicateWorkflowName(
        workflow.name,
        existingWorkflowFiles.map((workflowFile) => workflowFile.name)
      );
      const storedWorkflow = { ...workflow, name: workflowName };
      const workflowFile = await workflowFiles.createWorkflowFileMetadata({
        definition: JSON.stringify(storedWorkflow),
        name: storedWorkflow.name,
        nodeCount: storedWorkflow.nodes.length,
        templateType: payload.data.templateType
      });

      return c.json({ workflow: storedWorkflow, workflowFile }, 201);
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 400);
    }
  });

  api.patch("/workflow-files/:id", async (c) => {
    const payload = updateWorkflowFileSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid workflow update payload" }, 400);
    }

    try {
      const workflowFile = await workflowFiles.getWorkflowFileMetadata(
        c.req.param("id")
      );

      if (!workflowFile) {
        return c.json({ error: "Workflow file was not found" }, 404);
      }

      const existingWorkflowFiles = await workflowFiles.listWorkflowFileMetadata();
      const workflowName = deduplicateWorkflowName(
        payload.data.name,
        existingWorkflowFiles
          .filter((existingWorkflowFile) => existingWorkflowFile.id !== workflowFile.id)
          .map((existingWorkflowFile) => existingWorkflowFile.name)
      );
      const updatedWorkflowFile = await workflowFiles.updateWorkflowFileMetadata({
        id: workflowFile.id,
        name: workflowName
      });

      return c.json({ workflowFile: updatedWorkflowFile });
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 400);
    }
  });

  api.get("/skills", async (c) => {
    const projectId = c.req.query("projectId") ?? null;

    return c.json({
      skills: (await skills.listSkills(projectId)).map(serializeSkill)
    });
  });

  api.post("/skills", async (c) => {
    const payload = createSkillSchema.safeParse(await c.req.json().catch(() => null));

    if (!payload.success) {
      return c.json({ error: "Invalid Skill payload" }, 400);
    }

    try {
      const parsedSkill = payload.data.archive
        ? parseUploadedSkillArchive(payload.data.archive)
        : await parseRemoteSkillSource(
            payload.data.sourceUrl ?? "",
            skillSourceFetcher
          );
      const projectId = payload.data.projectId?.trim() || null;
      const storagePath = getSkillStoragePath(
        resolvedSkillStorageRoot,
        projectId,
        parsedSkill.name
      );

      await writeSkillFiles(storagePath, parsedSkill.files);

      const skill = await skills.createSkill({
        body: parsedSkill.body,
        description: parsedSkill.description,
        files: parsedSkill.files,
        name: parsedSkill.name,
        projectId,
        ref: `skill:${parsedSkill.name}`,
        sourceUrl: payload.data.sourceUrl?.trim() || null,
        storagePath
      });

      return c.json({ skill: serializeSkill(skill) }, 201);
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 400);
    }
  });

  api.post("/skills/:id/update-from-source", async (c) => {
    try {
      const currentSkill = (await skills.listSkills()).find(
        (skill) => skill.id === c.req.param("id")
      );

      if (!currentSkill) {
        return c.json({ error: `Skill not found: ${c.req.param("id")}` }, 404);
      }

      if (!currentSkill.sourceUrl) {
        throw new Error("Skill does not have a source URL");
      }

      const parsedSkill = await parseRemoteSkillSource(
        currentSkill.sourceUrl,
        skillSourceFetcher
      );

      await rm(currentSkill.storagePath, { force: true, recursive: true });
      await writeSkillFiles(currentSkill.storagePath, parsedSkill.files);

      const skill = await skills.updateSkill(currentSkill.id, {
        body: parsedSkill.body,
        description: parsedSkill.description,
        files: parsedSkill.files,
        name: currentSkill.name,
        ref: currentSkill.ref,
        sourceUrl: currentSkill.sourceUrl,
        storagePath: currentSkill.storagePath
      });

      return c.json({ skill: serializeSkill(skill) });
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 400);
    }
  });

  api.delete("/skills/:id", async (c) => {
    try {
      const skill = (await skills.listSkills()).find(
        (currentSkill) => currentSkill.id === c.req.param("id")
      );

      await skills.deleteSkill(c.req.param("id"));

      if (skill?.storagePath) {
        await rm(skill.storagePath, { force: true, recursive: true });
      }

      return c.body(null, 204);
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 404);
    }
  });

  api.get("/requirements", async (c) => {
    return c.json({ requirements: await requirements.listRequirements() });
  });

  api.post("/requirements", async (c) => {
    const payload = createRequirementSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid requirement payload" }, 400);
    }

    let requirement;

    try {
      requirement = await requirements.createRequirement(payload.data);
    } catch (error) {
      const message = getErrorMessage(error);

      return c.json(
        { error: message },
        message.toLowerCase().includes("already exists") ? 409 : 400
      );
    }

    return c.json(
      {
        decompositionResult: null,
        requirement
      },
      201
    );
  });

  api.patch("/requirements/:id", async (c) => {
    const payload = updateRequirementSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid requirement payload" }, 400);
    }

    try {
      return c.json(
        await requirements.updateRequirement({
          body: payload.data.body,
          id: c.req.param("id"),
          title: payload.data.title
        })
      );
    } catch (error) {
      const message = getErrorMessage(error);
      const status = message.toLowerCase().includes("already exists")
        ? 409
        : message.toLowerCase().includes("not found")
          ? 404
          : 400;

      return c.json({ error: message }, status);
    }
  });

  api.post("/requirements/:id/acceptance", async (c) => {
    const requirementId = c.req.param("id");

    try {
      const requirement = (await requirements.listRequirements()).find(
        (candidate) => candidate.id === requirementId
      );

      if (!requirement) {
        return c.json({ error: "Requirement not found" }, 404);
      }

      const linkedTasks = (await tasks.listTasks()).filter(
        (task) => task.requirementId === requirement.id
      );

      if (linkedTasks.length === 0) {
        return c.json({ error: "Requirement has no linked Tasks" }, 409);
      }

      const unfinishedTaskCount = linkedTasks.filter(
        (task) => !isTaskExecutionFinished(task)
      ).length;

      if (unfinishedTaskCount > 0) {
        return c.json(
          {
            error: `${unfinishedTaskCount} linked Task${
              unfinishedTaskCount === 1 ? "" : "s"
            } unfinished`
          },
          409
        );
      }

      const finalTask = getFinalTaskForRequirement(linkedTasks);

      if (!finalTask) {
        return c.json({ error: "Final Task not found" }, 409);
      }

      const acceptedTask =
        finalTask.status === "completed"
          ? finalTask
          : await tasks.updateTaskStatus({
              id: finalTask.id,
              status: "completed"
            });
      const acceptedRequirement = await requirements.updateRequirementStatus({
        errorMessage: null,
        id: requirement.id,
        status: "completed"
      });

      return c.json({
        requirement: acceptedRequirement,
        task: acceptedTask
      });
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 400);
    }
  });

  api.delete("/requirements/:id", async (c) => {
    const requirementId = c.req.param("id");

    try {
      await requirements.deleteRequirement(requirementId);
      await tasks.deleteTasksForRequirement(requirementId);

      return c.body(null, 204);
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 404);
    }
  });

  api.post("/requirements/:id/reset", async (c) => {
    const requirementId = c.req.param("id");

    try {
      const requirement = await requirements.updateRequirementStatus({
        errorMessage: null,
        id: requirementId,
        status: "init"
      });

      await decompositionResults.deleteDecompositionResultForRequirement(
        requirementId
      );
      await tasks.deleteTasksForRequirement(requirementId);

      return c.json({ requirement });
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 404);
    }
  });

  api.post("/requirements/:id/decomposition-result", async (c) => {
    const payload = startRequirementDecompositionSchema.safeParse(
      await c.req.json().catch(() => ({}))
    );

    if (!payload.success) {
      return c.json({ error: "Invalid requirement decomposition payload" }, 400);
    }

    const requirement = (await requirements.listRequirements()).find(
      (currentRequirement) => currentRequirement.id === c.req.param("id")
    );

    if (!requirement) {
      return c.json({ error: "Requirement not found" }, 404);
    }

    const existingTasks = (await tasks.listTasks()).filter(
      (task) => task.requirementId === requirement.id
    );

    if (existingTasks.length > 0) {
      return c.json({ error: "Requirement already has generated tasks" }, 409);
    }

    try {
      const workflowFile = await getRequirementWorkflowFile(requirement);
      const settings = await executionSettings.getExecutionSettings();
      const projectDefaults = await getProjectDefaults(requirement);
      const executor = await getExecutorAssignment(
        settings,
        payload.data,
        projectDefaults
      );

      if (executor.executorType === "model-api" && !isModelConfigured(settings)) {
        throw new Error("Model configuration is required before decomposing requirements");
      }

      const updatedRequirement = await requirements.updateRequirementStatus({
        errorMessage: null,
        id: requirement.id,
        status: "decomposing"
      });

      if (executor.executorType === "agent-binding") {
        await bridges.createBridgeJob({
          agentName: executor.executorLabel,
          nodeRunId: `requirement:${requirement.id}`,
          payload: {
            executor,
            requirement: {
              body: requirement.body,
              id: requirement.id,
              projectId: requirement.projectId,
              title: requirement.title
            },
            type: "requirement-decomposition",
            workflowFile: {
              id: workflowFile.id,
              name: workflowFile.name
            }
          },
          workflowRunId: `requirement:${requirement.id}`
        });
      } else {
        await startModelDecompositionRun({
          executor,
          requirement,
          settings,
          workflowFile
        });
      }

      return c.json(
        {
          decompositionResult: null,
          estimatedSeconds: executor.executorType === "agent-binding" ? 45 : 20,
          executor,
          requirement: updatedRequirement
        },
        202
      );
    } catch (error) {
      const message = getErrorMessage(error);
      const failedRequirement = await requirements.updateRequirementStatus({
        errorMessage: message,
        id: requirement.id,
        status: "decomposition_failed"
      });

      return c.json(
        {
          decompositionResult: null,
          error: message,
          requirement: failedRequirement
        },
        400
      );
    }
  });

  api.get("/decomposition-results", async (c) => {
    const results = await Promise.all(
      (await requirements.listRequirements()).map((requirement) =>
        decompositionResults.getDecompositionResultForRequirement(requirement.id)
      )
    );

    return c.json({
      decompositionResults: results.filter(
        (result): result is DecompositionResult => result !== null
      )
    });
  });

  api.patch("/decomposition-results/:id", async (c) => {
    const payload = plannedTasksSchema.safeParse(
      await c.req.json().catch(() => null)
    );

    if (!payload.success) {
      return c.json({ error: "Invalid decomposition result payload" }, 400);
    }

    try {
      return c.json({
        decompositionResult:
          await decompositionResults.updateDecompositionResult({
            id: c.req.param("id"),
            items: payload.data.tasks.map((task, index) => ({
              body: task.body,
              dependsOn: task.dependsOn ?? [],
              executorAgentBindingId:
                task.executorType === "agent-binding"
                  ? task.executorAgentBindingId ?? null
                  : null,
              executorLabel:
                task.executorLabel ??
                (task.executorType === "agent-binding"
                  ? "Agent Binding"
                  : "Model API"),
              executorType: task.executorType ?? "model-api",
              id: task.id ?? `item_${index + 1}`,
              sortOrder: index,
              title: task.title
            })),
            summary: payload.data.summary ?? ""
          })
      });
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 404);
    }
  });

  api.post("/decomposition-results/:id/generate-tasks", async (c) => {
    const decompositionResult = await decompositionResults.getDecompositionResult(
      c.req.param("id")
    );

    if (!decompositionResult) {
      return c.json({ error: "Decomposition result not found" }, 404);
    }

    const existingTasks = (await tasks.listTasks()).filter(
      (task) => task.requirementId === decompositionResult.requirementId
    );

    if (existingTasks.length > 0) {
      return c.json({ error: "Requirement already has generated tasks" }, 409);
    }

    const generatedTasks = await tasks.createTasksFromDecompositionResult({
      items: decompositionResult.items,
      projectId: decompositionResult.projectId,
      requirementId: decompositionResult.requirementId
    });
    const requirement = await requirements.updateRequirementStatus({
      id: decompositionResult.requirementId,
      status: "tasks_generated"
    });

    return c.json({ requirement, tasks: generatedTasks }, 201);
  });

  api.get("/tasks", async (c) => {
    void resumeRunningModelWorkflowRuns();

    return c.json({
      tasks: await listTasksWithRecoveredWorkflowStatus(tasks, workflowRuns)
    });
  });

  api.post("/tasks/:id/acceptance", async (c) => {
    try {
      const task = await tasks.getTask(c.req.param("id"));

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      if (task.status !== "pending_acceptance") {
        return c.json({ error: "Task is not pending acceptance" }, 409);
      }

      const acceptedTask = await tasks.updateTaskStatus({
        id: task.id,
        status: "completed"
      });

      return c.json({ task: acceptedTask });
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 400);
    }
  });

  api.post("/tasks/:id/workflow-runs", async (c) => {
    const payload = z
      .object({
        nodeExecutorAssignments: z.array(nodeExecutorAssignmentSchema).optional(),
        workflowFileId: z.string().trim().min(1)
      })
      .strict()
      .safeParse(await c.req.json().catch(() => null));

    if (!payload.success) {
      return c.json({ error: "Invalid workflow run payload" }, 400);
    }

    try {
      const task = await tasks.getTask(c.req.param("id"));

      if (!task) {
        return c.json({ error: "Task not found" }, 404);
      }

      const unfinishedDependencyId = await findUnfinishedTaskDependency(task);

      if (unfinishedDependencyId) {
        return c.json(
          {
            error: `Task dependency is not complete: ${unfinishedDependencyId}`
          },
          409
        );
      }

      const workflowFile = await workflowFiles.getWorkflowFileMetadata(
        payload.data.workflowFileId
      );

      if (!workflowFile) {
        throw new Error("Selected workflow file was not found");
      }

      const settings = await executionSettings.getExecutionSettings();
      const projectDefaults = await getProjectDefaults(task);
      const workflow = parseRunnableWorkflowDefinition(workflowFile.definition);
      const plannedNodes = planWorkflowDag(workflow);
      const requestedExecutorByNodeId = new Map(
        (payload.data.nodeExecutorAssignments ?? []).map((assignment) => [
          assignment.nodeId,
          assignment
        ])
      );
      const unknownAssignment = [...requestedExecutorByNodeId.keys()].find(
        (nodeId) => !plannedNodes.some((node) => node.id === nodeId)
      );

      if (unknownAssignment) {
        return c.json(
          {
            error: `Unknown Workflow Node executor assignment: ${unknownAssignment}`
          },
          400
        );
      }

      const executorAssignments = new Map<string, ExecutorAssignment>();

      for (const node of plannedNodes) {
        executorAssignments.set(
          node.id,
          await getExecutorAssignment(
            settings,
            requestedExecutorByNodeId.get(node.id),
            projectDefaults
          )
        );
      }

      const hasModelApiExecutors = [...executorAssignments.values()].some(
        (executor) => executor.executorType === "model-api"
      );
      const hasAgentBindingExecutors = [...executorAssignments.values()].some(
        (executor) => executor.executorType === "agent-binding"
      );

      if (hasModelApiExecutors && !isModelConfigured(settings)) {
        throw new Error("Model configuration is required before starting Task Workflows");
      }

      if (hasAgentBindingExecutors && !settings.agentProxyUrl) {
        const hasOnlineBridgeAgents = await bridges.hasOnlineAgentBindings();

        if (!hasOnlineBridgeAgents) {
          return c.json(
            {
              error:
                "Configure local bridge before starting Task Workflows"
            },
            409
          );
        }
      }

      const serializedExecutorAssignments =
        serializeExecutorAssignments(executorAssignments);
      const workflowRun = await workflowRuns.createWorkflowRun({
        executorAssignments: serializedExecutorAssignments,
        taskId: c.req.param("id"),
        workflowFileId: workflowFile.id
      });
      const nodeRuns: NodeRun[] = [];

      for (const [index, node] of plannedNodes.entries()) {
        nodeRuns.push(
          await workflowRuns.createNodeRun({
            dependsOn: node.dependsOn,
            nodeId: node.id,
            sortOrder: index,
            status: "queued",
            workflowRunId: workflowRun.id
          })
        );
      }

      if (settings.agentProxyUrl) {
        await proxyClient({
          agentProxyUrl: settings.agentProxyUrl,
          nodeRuns,
          task,
          workflowFile,
          workflowRun
        });
      } else {
        const advancedNodeRuns = await taskWorkflowRunner.advanceTaskWorkflowRun({
          deferModelExecution: true,
          executorAssignments: serializedExecutorAssignments,
          settings,
          task,
          workflow,
          workflowFile,
          workflowRun
        });

        nodeRuns.splice(0, nodeRuns.length, ...advancedNodeRuns);
      }

      const updatedTask = await tasks.updateTaskStatus({
        id: task.id,
        status: "running"
      });

      return c.json(
        {
          nodeRuns,
          task: updatedTask,
          workflowRun
        },
        201
      );
    } catch (error) {
      return c.json({ error: getErrorMessage(error) }, 400);
    }
  });

  async function findUnfinishedTaskDependency(task: Task) {
    for (const dependencyTaskId of task.dependsOn) {
      const dependencyTask = await tasks.getTask(dependencyTaskId);

      if (!dependencyTask) {
        return dependencyTaskId;
      }

      const dependencyRuns = await workflowRuns.listWorkflowRuns(dependencyTaskId);

      if (!dependencyRuns.some((run) => run.status === "succeeded")) {
        return dependencyTaskId;
      }
    }

    return null;
  }

  api.post(
    "/tasks/:taskId/workflow-runs/:workflowRunId/node-runs/:nodeRunId/retry",
    async (c) => {
      try {
        const task = await tasks.getTask(c.req.param("taskId"));

        if (!task) {
          return c.json({ error: "Task not found" }, 404);
        }

        const workflowRun = (await workflowRuns.listWorkflowRuns(task.id)).find(
          (candidate) => candidate.id === c.req.param("workflowRunId")
        );

        if (!workflowRun) {
          return c.json({ error: "Workflow Run not found" }, 404);
        }

        const workflowFile = await workflowFiles.getWorkflowFileMetadata(
          workflowRun.workflowFileId
        );

        if (!workflowFile) {
          return c.json({ error: "Workflow File not found" }, 404);
        }

        const settings = await executionSettings.getExecutionSettings();
        const workflow = parseRunnableWorkflowDefinition(workflowFile.definition);
        const executorAssignments =
          await resolveWorkflowRunExecutorAssignments({
            settings,
            task,
            workflow,
            workflowRun
          });
        const nodeRuns = await taskWorkflowRunner.retryFailedNodeRun({
          deferModelExecution: true,
          executorAssignments,
          nodeRunId: c.req.param("nodeRunId"),
          settings,
          task,
          workflow,
          workflowFile,
          workflowRun
        });
        const [updatedWorkflowRun] = (
          await workflowRuns.listWorkflowRuns(task.id)
        ).filter((candidate) => candidate.id === workflowRun.id);
        const updatedTask = await tasks.getTask(task.id);

        return c.json({
          nodeRuns,
          task: updatedTask,
          workflowRun: updatedWorkflowRun
        });
      } catch (error) {
        return c.json({ error: getErrorMessage(error) }, 400);
      }
    }
  );

  api.get("/tasks/:id/workflow-runs", async (c) => {
    const task = await tasks.getTask(c.req.param("id"));

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    const runs = await workflowRuns.listWorkflowRuns(c.req.param("id"));
    const workflowRunsWithNodes = await Promise.all(
      runs.map(async (workflowRun) => ({
        nodeRuns: await workflowRuns.listNodeRuns(workflowRun.id),
        workflowRun
      }))
    );

    return c.json({ workflowRuns: workflowRunsWithNodes });
  });

  app.route("/api", api);
  app.all("/api/*", (c) => c.json({ error: "API route not found" }, 404));

  if (releaseAssetsRoot) {
    app.get("/release/forgecli", (c) => {
      const forgeCliReleasePath = findForgeCliReleasePath(releaseAssetsRoot);

      if (!forgeCliReleasePath) {
        return c.text("forgecli release not found", 404);
      }

      return serveReleaseAsset(c, releaseAssetsRoot, forgeCliReleasePath);
    });
    app.get("/release/*", (c) => {
      const assetPath = c.req.path.replace(/^\/release\/?/, "");

      return serveReleaseAsset(c, releaseAssetsRoot, assetPath);
    });
  }

  if (webAssetsRoot) {
    app.get("/", (c) => c.redirect("/main"));
    app.use(
      "*",
      serveStatic({
        root: webAssetsRoot,
        rewriteRequestPath: (path) => path
      })
    );
    app.get("*", async (c, next) =>
      serveStatic({ path: "index.html", root: webAssetsRoot })(c, next)
    );
  }

  return app;
}

function findForgeCliReleasePath(releaseAssetsRoot: string) {
  if (!existsSync(releaseAssetsRoot)) {
    return null;
  }

  const platformName = getPlatformName();
  const preferredPath = join(`forgecli-${platformName}`, "forgecli");

  if (existsSync(join(releaseAssetsRoot, preferredPath))) {
    return preferredPath;
  }

  const fallbackDirectory = readdirSync(releaseAssetsRoot, {
    withFileTypes: true
  })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("forgecli-"))
    .map((entry) => entry.name)
    .sort()
    .find((directory) => existsSync(join(releaseAssetsRoot, directory, "forgecli")));

  return fallbackDirectory ? join(fallbackDirectory, "forgecli") : null;
}

function serveReleaseAsset(
  c: Context,
  releaseAssetsRoot: string,
  assetPath: string
) {
  const absolutePath = join(releaseAssetsRoot, assetPath);
  const relativePath = relative(releaseAssetsRoot, absolutePath);

  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    !existsSync(absolutePath)
  ) {
    return c.text("release asset not found", 404);
  }

  const fileStat = statSync(absolutePath);

  if (!fileStat.isFile()) {
    return c.text("release asset not found", 404);
  }

  return c.body(readFileSync(absolutePath), 200, {
    "content-type": "application/octet-stream"
  });
}

function getPlatformName() {
  const osName = process.platform === "darwin" ? "macos" : process.platform;

  return `${osName}-${process.arch}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function serializeExecutionSettings(settings: ExecutionSettings) {
  return {
    agentProxyConfigured: settings.agentProxyUrl.length > 0,
    agentProxyUrl: settings.agentProxyUrl,
    defaultExecutorAgentBindingId: settings.defaultExecutorAgentBindingId,
    defaultExecutorType: settings.defaultExecutorType,
    modelBaseUrl: settings.modelBaseUrl,
    modelConfigured: isModelConfigured(settings),
    modelName: settings.modelName,
    modelProvider: settings.modelProvider,
    updatedAt: settings.updatedAt
  };
}

function serializeAgentBinding(agent: AgentBinding) {
  return {
    capabilities: agent.capabilities,
    command: agent.command,
    connector: agent.connector,
    errorMessage: agent.errorMessage,
    id: agent.id,
    lastSeenAt: agent.lastSeenAt,
    name: agent.name,
    status: agent.status,
    updatedAt: agent.updatedAt
  };
}

function serializeSkill(skill: Skill) {
  return {
    body: skill.body,
    createdAt: skill.createdAt,
    description: skill.description,
    files: skill.files,
    id: skill.id,
    name: skill.name,
    projectId: skill.projectId,
    ref: skill.ref,
    sourceUrl: skill.sourceUrl,
    storagePath: skill.storagePath,
    updatedAt: skill.updatedAt
  };
}

function serializeBridgeJob(job: BridgeJob) {
  return {
    ...(job.payload && typeof job.payload === "object" ? job.payload : {}),
    agentName: job.agentName,
    bridgeId: job.bridgeId,
    errorMessage: job.errorMessage,
    id: job.id,
    output: job.output,
    status: job.status,
    workflowRunId: job.workflowRunId
  };
}

function parseRunnableWorkflowDefinition(definition: string): WorkflowFile {
  return workflowFileSchema.parse(
    normalizeStoredWorkflowDefinition(JSON.parse(definition))
  );
}

function normalizeStoredWorkflowDefinition(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const workflow = value as Record<string, unknown>;
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const hasLegacyNodeFields = nodes.some((node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return false;
    }

    const record = node as Record<string, unknown>;

    return (
      "executor" in record ||
      (Array.isArray(record.outputs) &&
        record.outputs.some((output) => typeof output === "string"))
    );
  });
  const isLegacyTaskWorkflow =
    workflow.scope === "task" || hasLegacyNodeFields;
  const { scope: _legacyScope, ...normalizedWorkflow } = workflow;
  void _legacyScope;

  return {
    ...normalizedWorkflow,
    ...(isLegacyTaskWorkflow && workflow.version === undefined
      ? { version: "1.1" }
      : {}),
    ...(Array.isArray(workflow.nodes)
      ? {
          nodes: workflow.nodes.map((node) =>
            normalizeStoredWorkflowNode(node, isLegacyTaskWorkflow)
          )
        }
      : {})
  };
}

function normalizeStoredWorkflowNode(
  value: unknown,
  isLegacyTaskWorkflow: boolean
): unknown {
  if (
    !isLegacyTaskWorkflow ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return value;
  }

  const { executor: _legacyExecutor, outputs, ...node } =
    value as Record<string, unknown>;
  void _legacyExecutor;

  return {
    ...node,
    ...(outputs === undefined
      ? {}
      : {
          outputs: normalizeStoredWorkflowOutputs(outputs)
        })
  };
}

function normalizeStoredWorkflowOutputs(outputs: unknown): unknown {
  if (!Array.isArray(outputs)) {
    return outputs;
  }

  return outputs.map((output) =>
    typeof output === "string" ? { kind: "file", ref: output } : output
  );
}

function isModelConfigured(settings: ExecutionSettings) {
  return (
    !modelProviderDefaults[settings.modelProvider].requiresApiKey ||
    settings.modelApiKey.length > 0
  );
}

function createTransientModelSettings(
  current: ExecutionSettings,
  input: z.infer<typeof updateExecutionSettingsSchema>
): ExecutionSettings {
  const nextModelProvider = input.modelProvider ?? current.modelProvider;
  const providerChanged =
    input.modelProvider !== undefined && input.modelProvider !== current.modelProvider;
  const providerDefaults = modelProviderDefaults[nextModelProvider];
  const nextModelApiKey = input.modelApiKey?.trim();

  return {
    ...current,
    modelApiKey: nextModelApiKey ? nextModelApiKey : current.modelApiKey,
    modelBaseUrl:
      input.modelBaseUrl?.trim() ??
      (providerChanged ? providerDefaults.baseUrl : current.modelBaseUrl),
    modelName:
      input.modelName?.trim() ??
      (providerChanged ? providerDefaults.modelName : current.modelName),
    modelProvider: nextModelProvider
  };
}

async function testModelApiWithProvider(settings: ExecutionSettings) {
  await generateText({
    model: createPlanningLanguageModel(settings),
    prompt: "Reply with exactly: ok",
    system: "You are validating that a model API key and endpoint work.",
    temperature: 0
  });
}

async function planRequirementWithModel({
  requirement,
  settings,
  workflowFile
}: Parameters<RequirementPlanner>[0]) {
  const planningRequest = buildRequirementPlanningRequest({
    requirement,
    workflowFile
  });
  const { output } = await generateText({
    model: createPlanningLanguageModel(settings),
    output: Output.object({
      description:
        "A Forge Requirement planning result, either clarification questions or executable Tasks.",
      name: "forgeRequirementPlan",
      schema: plannedRequirementOutputSchema
    }),
    prompt: planningRequest.prompt,
    system: planningRequest.system,
    temperature: 0.2
  });

  return normalizePlannedRequirementOutput(output);
}

function normalizePlannedRequirementOutput(
  output: z.infer<typeof plannedRequirementOutputSchema>
): PlannedRequirementDecomposition {
  if (output.kind === "clarification") {
    const clarification = plannedClarificationSchema.parse(output);

    return {
      kind: "clarification",
      questions: clarification.questions.map((question) => question.trim()),
      summary: clarification.summary?.trim() || "Requirement needs clarification."
    };
  }

  const plannedTasks = plannedTasksSchema.parse(output);
  const tasks = plannedTasks.tasks;

  if (tasks.length === 0) {
    throw new Error("Model returned no decomposition result items");
  }

  return {
    kind: "tasks",
    items: tasks.map((task, index) => {
      if (!task.title?.trim() || !task.body?.trim()) {
        throw new Error("Model returned an invalid decomposition result item");
      }

      return {
        body: task.body.trim(),
        dependsOn: task.dependsOn ?? [],
        id: task.id ?? `item_${index + 1}`,
        sortOrder: index,
        title: task.title.trim()
      };
    }),
    summary:
      plannedTasks.summary?.trim() ||
      `拆解出 ${tasks.length} 个任务，确认后可生成任务。`
  };
}

export function buildRequirementPlanningRequest({
  requirement,
  workflowFile
}: {
  requirement: Pick<Parameters<RequirementPlanner>[0]["requirement"], "body" | "title">;
  workflowFile: Pick<WorkflowFileMetadata, "name">;
}) {
  return {
    prompt: JSON.stringify({
      requirement: {
        body: requirement.body,
        title: requirement.title
      },
      workflowFile: {
        name: workflowFile.name
      }
    }),
    system: [
      "You plan Forge Requirements before execution.",
      "Return either kind \"clarification\" with 1-3 concrete questions, or kind \"tasks\" with concise Task titles and actionable Task bodies.",
      "Ask clarification questions when missing information changes the target object, expected deliverable, audience, scope, constraints, or acceptance criteria.",
      "Preserve the user's target object exactly. Treat capitalized or quoted names as proper nouns unless the Requirement explicitly defines them otherwise.",
      "Do not reinterpret a named target as a generic subject area, acronym expansion, background topic, or encyclopedia category.",
      "For writing and research Requirements, decompose by deliverable workflow such as clarifying target, gathering source material, outlining, drafting, and review instead of inventing content chapters."
    ].join(" ")
  };
}

async function executeTaskWorkflowNodeWithModel({
  node,
  settings,
  task,
  workflow,
  workflowFile
}: Parameters<TaskWorkflowNodeExecutor>[0]) {
  const { text } = await generateText({
    model: createPlanningLanguageModel(settings),
    prompt: JSON.stringify({
      task: {
        body: task.body,
        title: task.title
      },
      workflow: {
        name: workflow.name,
        workflowFileName: workflowFile.name
      },
      workflowNode: {
        dependsOn: node.dependsOn,
        exitCriteria: node.exit.criteria,
        id: node.id,
        inputs: node.inputs,
        instruction: node.instruction ?? null,
        outputs: node.outputs,
        type: node.type,
        uses: node.uses
      }
    }),
    system:
      "You execute one Forge Workflow Node. Produce concise, usable work output for this node only.",
    temperature: 0.2
  });

  return text.trim();
}

type ProviderOptions = {
  apiKey?: string;
  baseURL?: string;
};

const planningLanguageModelFactories: Record<
  ModelProviderKind,
  (settings: ExecutionSettings) => LanguageModel
> = {
  anthropic: (settings) =>
    createAnthropic(createProviderOptions(settings)).chat(settings.modelName),
  deepseek: (settings) =>
    createDeepSeek(createProviderOptions(settings)).chat(settings.modelName),
  google: (settings) =>
    createGoogleGenerativeAI(createProviderOptions(settings)).chat(settings.modelName),
  groq: (settings) => createGroq(createProviderOptions(settings))(settings.modelName),
  lmstudio: (settings) => createOpenAICompatibleModel(settings, "lmstudio"),
  mistral: (settings) =>
    createMistral(createProviderOptions(settings)).chat(settings.modelName),
  ollama: (settings) => createOpenAICompatibleModel(settings, "ollama"),
  openai: (settings) =>
    createOpenAI(createProviderOptions(settings)).chat(settings.modelName),
  "openai-compatible": (settings) =>
    createOpenAICompatibleModel(settings, "openai-compatible"),
  openrouter: (settings) => createOpenAICompatibleModel(settings, "openrouter")
};

function createPlanningLanguageModel(settings: ExecutionSettings) {
  return planningLanguageModelFactories[settings.modelProvider](settings);
}

function createProviderOptions(settings: ExecutionSettings): ProviderOptions {
  return {
    ...(settings.modelApiKey ? { apiKey: settings.modelApiKey } : {}),
    ...(settings.modelBaseUrl ? { baseURL: settings.modelBaseUrl } : {})
  };
}

function createOpenAICompatibleModel(
  settings: ExecutionSettings,
  name: string
): LanguageModel {
  const provider = createOpenAICompatible({
    ...createProviderOptions(settings),
    baseURL:
      settings.modelBaseUrl || modelProviderDefaults[settings.modelProvider].baseUrl,
    name
  });

  return provider.chatModel(settings.modelName);
}

async function startWorkflowRunViaAgentProxy({
  agentProxyUrl,
  nodeRuns,
  task,
  workflowFile,
  workflowRun
}: Parameters<AgentProxyClient>[0]) {
  const response = await fetch(
    `${agentProxyUrl.replace(/\/$/, "")}/workflow-runs`,
    {
      body: JSON.stringify({
        nodeRuns,
        task,
        workflowFile,
        workflowRun
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    }
  );

  if (!response.ok) {
    throw new Error(`Local executor rejected Task Workflow with status ${response.status}`);
  }
}
