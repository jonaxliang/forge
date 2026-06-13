# Forge

Forge 是一个 AI 工作编排控制平面。它把需求、可复用工作流模板、技能、本地 agent 执行环境连接起来，让代码、文档、研究、创作等知识工作变成可追踪、可评审、可复用的流程。

## 语言

**Forge**：
AI 工作编排的控制平面。Forge 负责项目、需求、工作流模板、工作流运行、状态追踪、产物和人工评审点。
_避免使用_：Agent、IDE、编码环境

**Harness**：
承接 Forge 委派工作的执行平面。Harness 连接 Forge 与本地或远端 agent，并为这些 agent 提供工作区、工具、文件、命令和外部服务访问能力。
_避免使用_：Forge runtime、workflow manager

**Project**：
Forge 中组织需求、模板、技能、工作流运行、产物和 agent 连接的工作空间。
_避免使用_：Repository、workspace

**Requirement**：
用户对目标工作的描述，尚未被拆解成可执行任务。Requirement 可以描述软件改动、文档、研究产出、创意作品或其他交付物。
_避免使用_：Task、issue、ticket

**Task**：
由 Requirement 通过工作流模板生成的、类似 issue 的可执行工作单元。Task 是 Forge 在计划、执行、评审和完成过程中追踪的主要对象，它的结果可以是代码、文档、研究笔记、创作文本或其他产物。
_避免使用_：Requirement、job

**Task Draft**：
Requirement 被正式接受到任务看板之前生成的候选任务。用户可以编辑、删除、合并、排序或批准 Task Draft。
_避免使用_：Task、generated issue

**Task Board**：
用于追踪任务计划、执行、评审和完成状态的项目主视图。它是用户管理 Forge 工作的主要入口。
_避免使用_：Workflow dashboard、run list

**Workflow Template**：
用于把 Requirement 转换成 Task，或用于编排 Task 完成步骤的可复用定义。Workflow Template 有明确的作用域，以区分需求拆解和任务执行。
_避免使用_：Pipeline、playbook

**Workflow File**：
使用 `.wf` 后缀描述一个工作流的文件。Workflow File 是 Forge 中定义、导入、分享和版本化工作流的核心单位，可以在文件内声明节点、输入、输出、准出条件、重试策略和 agent 角色，也可以引用外部 Skill、Prompt 或 Artifact Type。
_避免使用_：Template Pack、preset

**Requirement Workflow Template**：
把 Requirement 转换为一个或多个 Task 的工作流模板。
_避免使用_：Task template

**Task Workflow Template**：
针对 Task 运行并产出一个或多个 Artifact 的工作流模板。
_避免使用_：Requirement template

**Workflow Node**：
工作流模板中的一个步骤。Node 定义要调用什么能力、需要什么输入、期望什么输出，以及通过什么准出条件。
_避免使用_：Step、stage

**Exit Criteria**：
Workflow Node 在进入下游节点前必须满足的通过条件。初始产品中，Exit Criteria 主要由执行该节点的同一个 agent 通过大模型自然语言评审完成，也可以配置人工评审，并通过最大重试次数避免无限执行循环。
_避免使用_：Output、done flag

**Node Status**：
Workflow Run 中 Workflow Node 的生命周期状态。初始状态集合为 idle、queued、running、waiting、blocked、reviewing、failed、succeeded、skipped。
_避免使用_：Task status、run status

**Workflow Run Control Room**：
Task 层级的工作流运行检查与控制视图。它展示工作流节点、节点状态、分配的 agent、进度、产物、日志和人工评审点。
_避免使用_：Task board、logs page

**Skill**：
可被 Workflow Node 调用的可复用能力，例如需求分析、计划、编码、测试生成、评审、文档、研究、起草或编辑。
_避免使用_：Prompt、command

**Artifact**：
任务执行过程中产出或收集的持久化结果。Artifact 可以是代码改动、PR、文档、报告、大纲、手稿、数据集、评审意见或测试结果。
_避免使用_：Result、output

**Artifact Version**：
由某次 Node Run 产出的不可变 Artifact 版本。Task 可以把某个 Artifact Version 标记为当前版本或已接受版本，同时保留旧版本用于评审和追溯。
_避免使用_：Draft、revision

**Artifact Storage Mode**：
决定 Artifact 内容存储位置的项目策略。初始模式包括 local-only 和 cloud：local-only 表示 Artifact 内容通过本地 agent binding 留在用户机器上；cloud 表示 Forge 通过服务端存储适配器保存 Artifact 内容。
_避免使用_：File path、sync setting

**Artifact Publisher**：
未来的插件能力，用于把 Artifact 发布或同步到外部介质，例如飞书文档、Google Docs、Notion、GitHub PR、云盘或自定义系统。发布和存储是两个不同概念。
_避免使用_：Storage mode、export

**Agent**：
可以通过 Harness 执行 Workflow Node 的 AI 工作者。Agent 可以专长于编码、研究、起草、评审、测试或其他工作。
_避免使用_：Skill、workflow

**Hosted Agent**：
注册到 Forge 中、可被分配给 Task 和 Workflow Node 的 agent。该 agent 仍然可以在本地运行，使用本地模型凭证，并通过本地 Harness 执行。
_避免使用_：Forge-owned model、skill

**Agent Binding**：
把本地或远端 agent 连接到 Forge 的关系。Binding 让 Forge 能发现 agent 能力、给它分配工作、接收进度流和收集产物，同时不拥有该 agent 的模型运行时。
_避免使用_：Deployment、installation

**Agent Connector**：
Agent Binding 使用的协议适配器。Connector 把 Forge 的任务和工作流命令翻译成 agent 的原生协议，例如 MCP、A2A、CLI、HTTP 或自定义 bridge。
_避免使用_：Agent、skill

**Agent Pairing**：
多个 agent 以不同角色共同参与同一个 Task 或 Workflow Run 的协作模式，例如 planner、executor、reviewer、researcher、editor、tester。
_避免使用_：Agent fallback、multi-run comparison

**Cat Factory View**：
Workflow Run Control Room 的默认呈现方式和视觉交互隐喻：Workflow Node 被表现为工位，agent 被表现为工作角色，推动产物在工厂中流转。它在同一视图中保留状态、日志、产物、审批、重跑和阻塞等专业控制，不定义另一套工作流模型。
_避免使用_：Workflow engine、simulation
