# Artifact 存储模式

Forge 支持 local-only 和 cloud 两种 Artifact Storage Mode。local-only 是默认模式，让 Artifact 内容通过本地 agent binding 保留在用户机器上；cloud 是可选模式，通过服务端存储适配器保存 Artifact 内容，初始实现可以落到服务器文件路径，但产品抽象不应暴露为“文件路径”。
