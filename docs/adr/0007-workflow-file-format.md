# `.wf` 工作流文件

Forge 使用 `.wf` 文件作为工作流定义、导入、分享和版本化的核心单位。一个 `.wf` 文件描述一个 workflow，并可以引用外部 Skill、Prompt、Artifact Type、Agent Role 或 Integration；Forge 解析 `.wf` 后生成可运行的 Requirement Workflow Template 或 Task Workflow Template，而不是把多个模板和资源强制打包成 Template Pack。`.wf` 采用 YAML-like 语法，MVP 只支持 DAG 和节点内 `maxRetries`，不支持任意循环、goto 或运行时动态生成节点。
