# Forge 产品需求文档

## 问题陈述

AI agent 已经可以写代码、起草文档、调研主题、评审产物并操作本地工具，但这些工作通常发生在互相割裂的聊天会话、IDE 面板、CLI 会话或厂商专属 agent 环境中。用户缺少一个共享控制平面，把需求转成可追踪任务，把任务分配给本地或远端 agent，编排多步骤工作流，评审输出，并在多次运行之间保留可追溯产物。

Forge 的目标是成为一个基于 Web 的 AI 工作编排平台。它不替代 Codex 这类本地 agent，而是把它们绑定到项目级工作流系统中，让 Requirement、Task、Workflow Template、Agent Run、Exit Review 和 Artifact 都变得可见、可控、可追踪。

## 产品定位

Forge 是通用 AI 工作编排控制平面。它通过同一套核心模型支持编码、研究、文档、创意写作和其他知识工作：

```text
Requirement
  -> Task Draft[]
  -> Task
    -> Workflow Run
      -> Node Run[]
      -> Artifact Version[]
```

Forge 不是 IDE，不是模型提供商，也不是单一 coding agent。Forge 托管项目、工作流、任务看板、agent binding、执行状态、artifact metadata 和评审决策。Harness 与被绑定的 agent 负责实际执行。

## 领域语言

本节是 Forge 的产品语义词表。产品文案、代码命名、文档和 agent 协作说明应优先使用这里的词汇，不用近义词替换核心概念。

### Forge

Forge 是 AI 工作编排的控制平面。Forge 负责项目、需求、工作流模板、工作流运行、状态追踪、产物和人工评审点。

_避免使用_：Agent、IDE、编码环境

### Harness

Harness 是承接 Forge 委派工作的执行平面。Harness 连接 Forge 与本地或远端 agent，并为这些 agent 提供工作区、工具、文件、命令和外部服务访问能力。

_避免使用_：Forge runtime、workflow manager

### Project

Project 是 Forge 中组织需求、模板、技能、工作流运行、产物和 agent 连接的工作空间。

_避免使用_：Repository、workspace

### Requirement

Requirement 是用户对目标工作的描述，尚未被拆解成可执行任务。Requirement 可以描述软件改动、文档、研究产出、创意作品或其他交付物。

_避免使用_：Task、issue、ticket

### Task

Task 是由 Requirement 通过工作流模板生成的、类似 issue 的可执行工作单元。Task 是 Forge 在计划、执行、评审和完成过程中追踪的主要对象，它的结果可以是代码、文档、研究笔记、创作文本或其他产物。

_避免使用_：Requirement、job

### Task Draft

Task Draft 是 Requirement 被正式接受到任务看板之前生成的候选任务。用户可以编辑、删除、合并、排序或批准 Task Draft。

_避免使用_：Task、generated issue

### Task Board

Task Board 是用于追踪任务计划、执行、评审和完成状态的项目主视图。它是用户管理 Forge 工作的主要入口。

_避免使用_：Workflow dashboard、run list

### Workflow Template

Workflow Template 是用于把 Requirement 转换成 Task，或用于编排 Task 完成步骤的可复用定义。Workflow Template 有明确的作用域，以区分需求拆解和任务执行。

_避免使用_：Pipeline、playbook

### Workflow File

Workflow File 是使用 `.wf` 后缀描述一个工作流的文件。Workflow File 是 Forge 中定义、导入、分享和版本化工作流的核心单位，可以在文件内声明节点、输入、输出、准出条件、重试策略和 agent 角色，也可以引用外部 Skill、Prompt 或 Artifact Type。

_避免使用_：Template Pack、preset

### Requirement Workflow Template

Requirement Workflow Template 是把 Requirement 转换为一个或多个 Task 的工作流模板。

_避免使用_：Task template

### Task Workflow Template

Task Workflow Template 是针对 Task 运行并产出一个或多个 Artifact 的工作流模板。

_避免使用_：Requirement template

### Workflow Node

Workflow Node 是工作流模板中的一个步骤。Node 定义要调用什么能力、需要什么输入、期望什么输出，以及通过什么准出条件。

_避免使用_：Step、stage

### Exit Criteria

Exit Criteria 是 Workflow Node 在进入下游节点前必须满足的通过条件。初始产品中，Exit Criteria 主要由执行该节点的同一个 agent 通过大模型自然语言评审完成，也可以配置人工评审，并通过最大重试次数避免无限执行循环。

_避免使用_：Output、done flag

### Node Status

Node Status 是 Workflow Run 中 Workflow Node 的生命周期状态。初始状态集合为 idle、queued、running、waiting、blocked、reviewing、failed、succeeded、skipped。

_避免使用_：Task status、run status

### Workflow Run Control Room

Workflow Run Control Room 是 Task 层级的工作流运行检查与控制视图。它展示工作流节点、节点状态、分配的 agent、进度、产物、日志和人工评审点。

_避免使用_：Task board、logs page

### Skill

Skill 是可被 Workflow Node 调用的可复用能力，例如需求分析、计划、编码、测试生成、评审、文档、研究、起草或编辑。

_避免使用_：Prompt、command

### Artifact

Artifact 是任务执行过程中产出或收集的持久化结果。Artifact 可以是代码改动、PR、文档、报告、大纲、手稿、数据集、评审意见或测试结果。

_避免使用_：Result、output

### Artifact Version

Artifact Version 是由某次 Node Run 产出的不可变 Artifact 版本。Task 可以把某个 Artifact Version 标记为当前版本或已接受版本，同时保留旧版本用于评审和追溯。

_避免使用_：Draft、revision

### Artifact Storage Mode

Artifact Storage Mode 是决定 Artifact 内容存储位置的项目策略。初始模式包括 local-only 和 cloud：local-only 表示 Artifact 内容通过本地 agent binding 留在用户机器上；cloud 表示 Forge 通过服务端存储适配器保存 Artifact 内容。

_避免使用_：File path、sync setting

### Artifact Publisher

Artifact Publisher 是未来的插件能力，用于把 Artifact 发布或同步到外部介质，例如飞书文档、Google Docs、Notion、GitHub PR、云盘或自定义系统。发布和存储是两个不同概念。

_避免使用_：Storage mode、export

### Agent

Agent 是可以通过 Harness 执行 Workflow Node 的 AI 工作者。Agent 可以专长于编码、研究、起草、评审、测试或其他工作。

_避免使用_：Skill、workflow

### Hosted Agent

Hosted Agent 是注册到 Forge 中、可被分配给 Task 和 Workflow Node 的 agent。该 agent 仍然可以在本地运行，使用本地模型凭证，并通过本地 Harness 执行。

_避免使用_：Forge-owned model、skill

### Agent Binding

Agent Binding 是把本地或远端 agent 连接到 Forge 的关系。Binding 让 Forge 能发现 agent 能力、给它分配工作、接收进度流和收集产物，同时不拥有该 agent 的模型运行时。

_避免使用_：Deployment、installation

### Agent Connector

Agent Connector 是 Agent Binding 使用的协议适配器。Connector 把 Forge 的任务和工作流命令翻译成 agent 的原生协议，例如 MCP、A2A、CLI、HTTP 或自定义 bridge。

_避免使用_：Agent、skill

### Agent Pairing

Agent Pairing 是多个 agent 以不同角色共同参与同一个 Task 或 Workflow Run 的协作模式，例如 planner、executor、reviewer、researcher、editor、tester。

_避免使用_：Agent fallback、multi-run comparison

### Cat Factory View

Cat Factory View 是 Workflow Run Control Room 的默认呈现方式和视觉交互隐喻：Workflow Node 被表现为工位，agent 被表现为工作角色，推动产物在工厂中流转。它在同一视图中保留状态、日志、产物、审批、重跑和阻塞等专业控制，不定义另一套工作流模型。

_避免使用_：Workflow engine、simulation

## 目标

- 让用户创建用于 AI 协作工作的项目。
- 让用户提交 Requirement，并通过 Workflow Template 生成可编辑 Task Draft。
- 让用户通过类似 issue 的 Task Board 追踪工作。
- 让用户通过 Agent Connector 把本地 agent 绑定到 Forge，尤其是 Codex。
- 让 Forge 将 Workflow Node 分配给已绑定 agent，同时模型调用和本地工具执行仍可保留在用户机器上。
- 让用户通过 Cat Factory 风格的 Control Room 检查 Workflow Run。
- 让每个 Workflow Node 定义由模型评审的 Exit Criteria 和最大重试次数。
- 让 Task 产出带版本的 Artifact，包括代码、文档、报告、草稿、评审和测试结果。
- 默认支持 local-only Artifact 存储，并把 cloud Artifact 存储作为可选模式。

## 非目标

- MVP 不构建 Forge 自己的模型运行时。
- Forge 不要求 Artifact 必须是代码变更。
- Forge 不从完整 CI/CD 系统起步。
- MVP 不实现复杂结构化规则引擎来判断 Exit Criteria。
- Forge 不强制云端存储或远端执行。
- MVP 不实现飞书文档等外部发布插件；这属于二期能力。

## 目标用户

- 希望让本地 agent 在项目中运行可复用流程的个人创作者或开发者。
- 希望把 AI 执行从一次性聊天变成 issue-like、可追踪工作的工程师。
- 希望用 AI 工作流管理大纲、草稿、评审和修订的写作者与研究者。
- 希望共享 AI 工作看板，同时让敏感执行仍留在本地的团队。
- 希望让本地或自定义 agent 在工作流平台中被发现和分配任务的 agent 构建者。

## 核心概念

### Project

Project 组织 Requirement、Task Draft、Task、Workflow File、Workflow Template、Agent Binding、Skill、Artifact 和设置。Project 有默认 Artifact Storage Mode 和已导入的 `.wf` 工作流文件集合。

### Requirement

Requirement 是用户对目标工作的描述。它可以描述软件改动、研究报告、小说章节、论文、文档或其他交付物。

### Task Draft

Task Draft 由 Requirement Workflow Template 从 Requirement 生成。用户可以在它成为正式 Task 之前编辑、删除、合并、排序和批准。

### Task

Task 是类似 issue 的工作对象。它包含标题、描述、状态、优先级、标签、负责人、agent 角色分配、Workflow Run、评论、Artifact 和评审状态。

### Workflow Template

Workflow Template 有明确作用域：

- Requirement Workflow Template：把 Requirement 转成 Task Draft。
- Task Workflow Template：针对 Task 运行并产出 Artifact Version。

### Workflow File

Workflow File 是使用 `.wf` 后缀描述工作流的源文件。它是 Forge 中定义、导入、分享和版本化工作流的核心单位。Forge 读取 `.wf` 文件后，将其中的定义解析为 Requirement Workflow Template 或 Task Workflow Template。

`.wf` 文件可以直接声明：

- workflow metadata
- scope
- inputs
- nodes
- node dependencies
- executor
- outputs
- exit criteria
- max retries
- human review policy

`.wf` 文件也可以引用外部资源：

- Skill
- Prompt
- Artifact Type
- Agent Role
- Integration

MVP 中 `.wf` 采用 YAML-like 语法，只支持 DAG 和节点内 retry，不支持任意循环、goto 或运行时动态生成节点。

### Workflow Node

Workflow Node 定义模板中的一个工作单元：

```text
Workflow Node
  type
  trigger
  executor
  inputs
  outputs
  exit criteria
  controls
```

Node 类型：

- Skill node
- Agent node
- Human review node
- Integration node
- Condition node
- Artifact node

### Exit Criteria

Exit Criteria 定义节点输出何时足够好，可以进入下一步。MVP 中，Exit Criteria 由执行该节点的同一个 agent 通过大模型自然语言评审完成。模板可以选择要求 Human Review。

每个节点支持：

- Review prompt
- Pass rubric
- Retry instruction
- Maximum retry count
- 重试耗尽后的处理行为

### Workflow Run

Workflow Run 是某个 Task Workflow 的一次执行实例。一个 Task 在生命周期中可以有多个 Workflow Run。

### Node Run

Node Run 是某个 Workflow Node 的一次执行实例。它记录状态、分配 agent、日志、评审结果、重试次数、产出的 Artifact 和阻塞原因。

### Artifact

Artifact 是 Workflow Run 中产生的持久化结果。例如：

- 代码变更
- Pull request 引用
- 测试结果
- 研究笔记
- 大纲
- 报告
- 草稿
- 手稿
- 评审意见
- 决策记录

Artifact 需要版本化。每个 Node Run 都可以产出不可变 Artifact Version，Task 可以把某个版本标记为当前版本或已接受版本。

### Agent Binding

Agent Binding 把本地或远端 agent 连接到 Forge。Agent 仍然可以在本地运行，使用本地模型凭证，并操作本地工作区。

### Agent Connector

Connector 把 Forge 的工作流命令适配为 agent 的协议：

- MCP Connector：用于以 MCP server 暴露的 agent，包括 Codex 风格的本地集成。
- CLI Connector：用于可以通过本地命令驱动的 agent。
- HTTP/SSE Connector：用于长期运行的本地或远端 bridge。
- A2A Connector：作为未来更丰富 agent-to-agent 互操作的方向。

### Agent Pairing

Agent Pairing 允许多个 agent 以不同角色参与同一个 Task 或 Workflow Run，例如 planner、executor、reviewer、researcher、editor、tester。MVP 数据模型应支持该能力，但首批模板可以先使用单个默认 agent。

## 核心竞争力判断

Forge 目前具备潜在核心竞争力，但还不是稳固护城河。它的差异点不在“又做一个 agent”，而在于把本地 agent、通用工作流、可评审节点、版本化产物和项目级任务管理组合成一个控制平面。

已有行业实践覆盖了部分相邻能力：云端 coding agent、IDE 内 agent、MCP 工具连接、agent 互操作协议、issue-to-PR 自动化等。但 Forge 的组合仍有机会形成独特定位：

- **本地 agent 托管到 Web 控制平面**：用户保留本地模型账号、工具、仓库和权限，Forge 负责编排和协作。
- **通用 AI work workflow**：不局限 coding，同一模型支持代码、论文、小说、文档、研究等。
- **Requirement -> Task Draft -> Task -> Workflow Run -> Artifact Version**：比聊天更结构化，比 CI 更适合 AI 产物。
- **大模型评审式 Exit Criteria**：把“质量是否过关”变成每个节点的一等能力。
- **Cat Factory Control Room**：把复杂 agent 执行状态变成用户可感知的过程，而不是隐藏在日志里。

结论：Forge 的核心竞争力可以成立，但需要强化两个方向：**绑定 agent 的体验壁垒** 和 **工作流/产物知识沉淀壁垒**。否则它容易被理解为“AI 任务看板 + agent 调用器”，壁垒不够深。

## 建议增强功能

### 1. Agent Capability Registry

让每个绑定 agent 上报能力、适用场景、可访问资源、成本、历史表现和风险边界。Forge 根据 Task 类型推荐或自动选择 agent。

价值：形成 agent 路由能力，避免用户手动判断哪个 agent 适合哪个任务。

### 2. Agent Pairing 作为标志性能力

把 Agent Pairing 从二期概念提前纳入 MVP 的数据模型和部分内置模板。比如：

```text
Planner Agent -> 拆解方案
Executor Agent -> 产出 artifact
Critic Agent -> 评审 exit criteria
Editor/Tester Agent -> 修订或验证
```

价值：这是 Forge 区别于单 agent 工具的强差异点。

### 3. Workflow Memory

Forge 应保存每个项目、模板、节点和 artifact 的运行经验：

- 哪些 Exit Criteria 经常失败
- 哪些 agent 在哪些模板上表现更好
- 哪些 retry instruction 更有效
- 哪些 artifact 版本被最终接受

价值：让 Forge 越用越懂项目和工作流，形成数据飞轮。

### 4. `.wf` Registry

把 `.wf` 做成可安装、可分享、可版本化的工作流文件。一个 `.wf` 文件描述一个 workflow，可以引用外部 Skill、Artifact Type、Exit Criteria Prompt 和示例任务；多个 `.wf` 文件可以通过 registry 组织，但 registry 不是核心领域对象。

价值：把平台从“工具”变成“工作流生态”。

### 5. Artifact Publisher 插件体系

二期支持将 Artifact 发布到飞书文档、Google Docs、Notion、GitHub PR、云盘等外部介质。

价值：让 Forge 产物进入团队已有工作场景，而不是困在 Forge 内。

### 6. Evaluation Run / Agent Benchmark

允许同一个 Task 或 Node 并行交给多个 agent，比较耗时、重试次数、评审结果、人工接受率和 artifact 质量。

价值：帮助用户建立对 agent 的可量化信任，也让 Forge 拥有 agent 选择依据。

### 7. Secure Local Bridge

本地 agent 与远端 Forge 之间需要安全绑定机制：设备授权、短期 token、能力白名单、artifact 上传策略、命令权限边界和审计日志。

价值：这是本地 agent 托管模式能否被团队采用的前提。

## 用户故事

1. 作为用户，我想创建 Project，以便组织相关 AI 工作。
2. 作为用户，我想选择 Project 的 Artifact 存储在本地还是云端，以便控制隐私和协作方式。
3. 作为用户，我想创建 Requirement，以便先描述目标工作，而不是直接创建执行任务。
4. 作为用户，我想选择 Requirement Workflow Template，以便 Forge 能按合适方式拆解需求。
5. 作为用户，我想让 Forge 生成 Task Draft，以便在任务进入看板前检查拆解结果。
6. 作为用户，我想编辑 Task Draft，以便 AI 生成的拆解符合我的意图。
7. 作为用户，我想合并、删除和排序 Task Draft，以便工作结构保持清晰。
8. 作为用户，我想批准 Task Draft，以便它们成为可追踪 Task。
9. 作为用户，我想使用 Task Board，以便像管理 issue 一样管理 AI 工作。
10. 作为用户，我想给 Task 指定 Task Workflow Template，以便任务能按一致流程执行。
11. 作为用户，我想把本地 Codex agent 绑定到 Forge，以便 Forge 能委派工作但不接管我的模型运行时。
12. 作为用户，我想通过 CLI 命令绑定其他本地 agent，以便 Forge 能接入不支持 MCP 的 agent。
13. 作为用户，我想让 Forge 发现 agent 能力，以便为任务选择合适 agent。
14. 作为用户，我想把 Task 分配给已绑定 agent，以便 agent 执行 Workflow Node。
15. 作为用户，我想让 Forge 展示工作流进度，以便不用读原始日志也能知道发生了什么。
16. 作为用户，我想让 Workflow Run Control Room 把节点显示为工厂工位，以便一眼理解进度。
17. 作为用户，我想让 agent 在 Cat Factory View 中表现为工作角色，以便 agent 活动更可见、更有记忆点。
18. 作为用户，我想每个节点都显示状态、日志、Artifact、重试和阻塞原因，以便视觉隐喻不遮蔽专业控制。
19. 作为用户，我想让节点定义 Exit Criteria，以便输出必须通过评审才能进入下一步。
20. 作为用户，我想让 Exit Criteria 支持自然语言 rubric，以便写作、研究等定性工作也能被判断。
21. 作为用户，我想设置最大重试次数，以便失败节点不会无限循环。
22. 作为用户，我想启用可选 Human Review，以便关键产物需要我批准。
23. 作为用户，我想让节点失败后进入 blocked 或 failed 状态，以便我可以介入。
24. 作为用户，我想让 Artifact 版本化，以便比较修订并接受最佳结果。
25. 作为用户，我想重跑某个 Workflow Node，以便不重启全部工作也能改进某个阶段。
26. 作为用户，我想重跑某个 Task Workflow，以便比较多次尝试。
27. 作为用户，我想使用软件改动模板，以便 Forge 支持 coding workflow。
28. 作为用户，我想使用研究写作模板，以便 Forge 支持论文、报告和文章。
29. 作为用户，我想使用创意写作模板，以便 Forge 支持小说和长文草稿。
30. 作为团队成员，我想远端部署 Forge，以便多人查看共享 Task 和 Workflow 状态。
31. 作为重视隐私的用户，我想使用 local-only Artifact 模式，以便内容留在我的机器上。
32. 作为协作者，我想使用 cloud Artifact 模式，以便被选中的 Artifact 可以远端查看。
33. 作为模板作者，我想定义包含输入、输出、Exit Criteria 和 controls 的 Workflow Node，以便模板可复用。
34. 作为模板作者，我想通过 `.wf` 文件定义工作流，并引用 Skill、Artifact Type 和 prompt，以便工作流可以被导入、分享和版本化。
35. 作为 agent 构建者，我想通过 Connector 把 agent 暴露给 Forge，以便用户可以把 Workflow Node 分配给它。
36. 作为未来用户，我想把 Artifact 发布到飞书文档等外部介质，以便 Forge 产物进入团队已有工作场景。

## MVP 范围

### 平台

- Web 应用。
- 推荐本地部署。
- 支持远端部署。
- Project 创建和 Project 设置。
- Project 级默认 Artifact Storage Mode。
- Artifact 级存储模式覆盖。

### Requirement 和 Task

- 创建 Requirement。
- 选择 Requirement Workflow Template。
- 生成 Task Draft。
- 编辑、合并、删除、排序和批准 Task Draft。
- 从已批准 Task Draft 创建 Task。
- Task Board 作为项目主视图。
- Task 详情页展示评论、状态、Workflow Run、Artifact 和已分配模板。

### Workflow Template

- Requirement Workflow Template。
- Task Workflow Template。
- Node 定义包含：
  - Type
  - Trigger
  - Executor
  - Inputs
  - Outputs
  - Exit Criteria
  - Maximum retries
  - Optional human review
- `.wf` Workflow File 抽象。

### 内置 `.wf` 工作流文件

1. Software Change Workflow
   - 把 Requirement 拆解为实现、测试、评审和文档任务。
   - Task Workflow 支持计划、编码、测试、评审和 Artifact 捕获。

2. Research & Writing Workflow
   - 把 Requirement 拆解为大纲、研究、草稿、评审和定稿任务。
   - Task Workflow 支持资料收集、综合分析、起草和批判评审。

3. Creative Writing Workflow
   - 把 Requirement 拆解为设定、世界观、提纲、章节起草、编辑和连续性评审任务。
   - Task Workflow 支持起草和修订。

### Agent Binding

- 在 Forge 中把本地 agent 注册为 Hosted Agent。
- MCP Connector 作为优先路径。
- CLI Connector 作为兜底路径。
- Agent capability metadata。
- 将 agent 分配给 Task 和 Workflow Node。
- 本地 agent 执行并回传进度与 Artifact。
- 提供本地 CLI 启动和管理常驻 Local Agent Bridge daemon。
- Local Agent Bridge daemon 主动连接 Forge Server，负责注册、心跳、领取 job、执行本地 agent、回传事件和产物。

### Workflow Run Control Room

- Cat Factory View 是默认 Control Room 呈现。
- Workflow Node 显示为工厂工位。
- Agent 显示为工作角色。
- Artifact 显示为在工位间流转的工件。
- 清晰展示 Node Status：
  - idle
  - queued
  - running
  - waiting
  - blocked
  - reviewing
  - failed
  - succeeded
  - skipped
- Node detail panel 展示日志、Artifact、重试、Exit Review 和控制操作。
- 支持操作：
  - Start run
  - Pause run
  - Rerun node
  - Skip node if allowed
  - Approve human review
  - Request changes
  - Mark blocked

### Artifact 管理

- Forge 保存 Artifact metadata。
- Artifact Version 不可变保留。
- 当前版本和已接受版本标记。
- Local-only 存储模式。
- 通过服务端存储适配器实现 cloud 存储模式。
- Content reference 抽象。

## 二期范围

- Artifact Publisher 插件系统。
- 飞书文档 Publisher。
- Google Docs、Notion、GitHub PR、云盘和自定义 Publisher adapter。
- A2A Connector，用于更丰富的多 agent 互操作。
- Agent Pairing 模板，分配 planner、executor、reviewer、researcher、editor、tester 等角色。
- Agent evaluation 和 benchmark run。
- 多 agent 结果比较。
- `.wf` registry。
- 团队高级权限模型。
- 结构化规则检查，作为模型评审式 Exit Criteria 的可选补充。

## 实现决策

- Forge 是控制平面；Harness 和 agent 是执行平面。
- Forge 的核心领域是通用 AI 工作编排，不是 AI coding only。
- Task 是稳定的 issue-like 协作对象；Workflow Run 是执行实例。
- Requirement 拆解先生成 Task Draft，再创建 Task。
- Workflow Template 有明确作用域：requirement 或 task。
- Workflow Node 包含 trigger、executor、inputs、outputs、exit criteria 和 controls。
- Exit Criteria 初始由大模型自然语言评审判断。
- Same Agent 是 Exit Criteria 的默认 reviewer。
- Human Review 可选。
- 每个节点支持最大重试次数。
- Artifact 内容存储由 Artifact Storage Mode 控制。
- Local-only 是默认存储模式。
- Cloud storage 通过 storage adapter 作为可选模式。
- Artifact Publisher 是未来插件概念，与 storage 分离。
- Cat Factory View 是默认 Workflow Run Control Room 呈现，不是另一套 workflow engine。
- MCP Connector 是优先本地 agent binding 策略。
- CLI Connector 是兜底策略。
- A2A 是未来互操作方向。

## 建议数据模型

```text
Project
  id
  name
  default_artifact_storage_mode
  workflow_files[]
  agent_bindings[]

Requirement
  id
  project_id
  title
  body
  selected_requirement_template_id
  status

TaskDraft
  id
  requirement_id
  title
  description
  proposed_task_template_id
  order
  status

Task
  id
  project_id
  requirement_id
  title
  description
  status
  priority
  labels[]
  selected_task_template_id
  current_workflow_run_id

WorkflowTemplate
  id
  source_file_id
  scope
  name
  description
  nodes[]

WorkflowFile
  id
  project_id
  filename
  content_hash
  parsed_template_ids[]
  imported_at

WorkflowNode
  id
  template_id
  type
  trigger
  executor
  inputs
  outputs
  exit_criteria
  max_retries
  controls

WorkflowRun
  id
  task_id
  template_id
  status
  started_at
  completed_at

NodeRun
  id
  workflow_run_id
  node_id
  status
  assigned_agent_binding_id
  retry_count
  logs_ref
  exit_review
  blocker_reason

Artifact
  id
  task_id
  type
  title
  current_version_id
  accepted_version_id
  storage_mode

ArtifactVersion
  id
  artifact_id
  produced_by_node_run_id
  content_ref
  summary
  review_result
  created_at

AgentBinding
  id
  project_id
  name
  connector_type
  capabilities[]
  status
```

## UX 需求

### Project Home

Project Home 默认打开 Task Board。用户可以切换到 Requirements、Templates、Agents、Artifacts 和 Settings。

### Requirement Creation

创建流程要求用户输入 Requirement、选择模板并可选补充上下文。Forge 随后生成 Task Draft 供用户评审。

### Task Board

Task Board 支持状态列，并支持按模板、agent、Artifact 类型和 blocked 状态过滤。Task card 展示当前 run 状态和最近 Artifact。

### Task Detail

Task Detail 包含当前 Workflow Run Control Room、Artifact 列表、评论、Run 历史和 Task metadata。

### Cat Factory Control Room

Control Room 使用 Cat Factory View 作为主要空间表达方式。每个工位映射一个 Workflow Node。视图必须保持操作清晰：状态、阻塞、重试、日志、Artifact 和评审操作始终可访问。

## 测试决策

MVP 测试应聚焦外部行为：

- 创建 Project 会设置默认 Artifact Storage Mode。
- 用模板创建 Requirement 会生成 Task Draft，而不是直接生成 Task。
- 批准 Task Draft 后会在 Task Board 上创建 Task。
- Task Workflow Run 会按预期顺序创建 Node Run。
- Node Run 状态转换遵循定义好的状态集合。
- Exit Criteria 失败会触发重试，直到最大重试次数。
- 超过最大重试次数后，Node 进入 blocked 或 failed。
- Optional Human Review 会暂停 Node，直到用户作出决定。
- Artifact Version 不可变。
- Artifact 级 Storage Mode 可以覆盖 Project 默认值。
- 本地 agent binding 可以通过 MCP 或 CLI connector metadata 注册。
- Cat Factory Control Room 准确反映底层 Node Status。

## 成功指标

- 用户可以在一个会话内创建 Project、提交 Requirement、评审 Task Draft 并启动 Workflow Run。
- 可以注册并分配一个 Codex 风格的本地 agent 到某个 Node。
- 一个 Workflow Run 可以产出至少一个版本化 Artifact。
- Exit Review 失败可以触发重试，并在超过最大重试次数后进入 blocked。
- 用户不打开原始日志也能通过 Cat Factory Control Room 理解工作流进度。
- 同一套核心系统至少能运行一个 coding workflow 和一个 non-coding workflow。

## 行业背景

Forge 与云端 coding agent 和 agent 互操作方向相邻，但差异点是把本地 agent 绑定进通用工作流控制平面。相关参考包括 OpenAI Codex MCP integration、Model Context Protocol、Google A2A 和 GitHub Copilot coding agent 的产品模式。

## 待决问题

- Cloud mode 的第一个 storage adapter 应该只支持 server filesystem，还是从第一天就提供 object-storage-compatible interface？
- 本地 agent bridge 绑定远端 Forge 实例时，最小安全握手协议是什么？
- Human Review 在第一版中应该是 Node type、Node control，还是两者都支持？
- Agent Pairing 应该在 MVP UI 中暴露到什么程度，还是仅由数据模型支持？
- `.wf` 在 MVP 中应支持 UI 编辑，还是先以文件导入和只读预览为主？
