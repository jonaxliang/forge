# Forge

Forge is an AI work orchestration control plane. It connects requirements, reusable workflow templates, skills, and local agent execution environments into traceable work across code, documents, research, and other knowledge work.

## Language

**Forge**:
The control plane for AI work orchestration. Forge owns projects, requirements, workflow templates, workflow runs, status tracking, artifacts, and human review points.
_Avoid_: Agent, IDE, coding environment

**Harness**:
The execution plane that provides an AI working environment for running work delegated by Forge. Harness connects Forge to local or remote agents and gives those agents access to workspaces, tools, files, commands, and external services.
_Avoid_: Forge runtime, workflow manager

**Project**:
A workspace in Forge that groups related requirements, templates, skills, workflow runs, artifacts, and agent connections.
_Avoid_: Repository, workspace

**Requirement**:
A user-facing description of desired work before it has been decomposed into executable tasks. A requirement may describe a software change, document, research output, creative work, or other deliverable.
_Avoid_: Task, issue, ticket

**Task**:
An issue-like executable unit of work derived from a requirement through a workflow template. A task is the primary object Forge tracks while work is being planned, run, reviewed, and completed, and its outcome may be code, documents, research notes, creative writing, or other artifacts.
_Avoid_: Requirement, job

**Task Board**:
The primary project view for tracking tasks across planning, execution, review, and completion. It is the main entry point for users managing work in Forge.
_Avoid_: Workflow dashboard, run list

**Workflow Template**:
A reusable definition for converting requirements into tasks or coordinating the steps needed to complete tasks. Workflow templates have an explicit scope so requirement decomposition and task execution remain separate.
_Avoid_: Pipeline, playbook

**Requirement Workflow Template**:
A workflow template that converts a requirement into one or more tasks.
_Avoid_: Task template

**Task Workflow Template**:
A workflow template that runs against a task and produces one or more artifacts.
_Avoid_: Requirement template

**Workflow Node**:
A step inside a workflow template. A node defines what capability is invoked, what inputs it expects, and what outputs it should produce.
_Avoid_: Step, stage

**Workflow Run Control Room**:
The task-level view for inspecting and controlling a workflow run. It shows workflow nodes, node status, assigned agents, progress, artifacts, logs, and human review points.
_Avoid_: Task board, logs page

**Skill**:
A reusable capability that can be invoked by a workflow node, such as requirement analysis, planning, coding, test generation, review, documentation, research, drafting, or editing.
_Avoid_: Prompt, command

**Artifact**:
A durable output produced or collected during task execution. Artifacts may include code changes, pull requests, documents, reports, outlines, manuscripts, datasets, review notes, or test results.
_Avoid_: Result, output

**Agent**:
An AI worker that can execute workflow nodes through a harness. Agents may specialize in coding, research, drafting, reviewing, testing, or other work.
_Avoid_: Skill, workflow

**Hosted Agent**:
An agent registered in Forge so it can be assigned to tasks and workflow nodes. The agent may still run locally, use local model credentials, and execute through a local harness.
_Avoid_: Forge-owned model, skill

**Agent Binding**:
The relationship that connects a local or remote agent to Forge. A binding lets Forge discover the agent's capabilities, assign work to it, stream progress from it, and collect artifacts without owning the agent's model runtime.
_Avoid_: Deployment, installation

**Agent Connector**:
The protocol adapter used by an agent binding. A connector translates Forge task and workflow commands into the local agent's native protocol, such as MCP, A2A, CLI, HTTP, or a custom bridge.
_Avoid_: Agent, skill

**Agent Pairing**:
A collaboration pattern where multiple agents contribute to the same task or workflow run with distinct roles, such as planner, executor, reviewer, researcher, editor, or tester.
_Avoid_: Agent fallback, multi-run comparison

**Cat Factory View**:
A visual interaction metaphor for the Workflow Run Control Room where workflow nodes are represented as stations and agents are represented as working characters moving work through the factory. It is a presentation layer for status, progress, blockers, and collaboration, not a separate workflow model.
_Avoid_: Workflow engine, simulation
