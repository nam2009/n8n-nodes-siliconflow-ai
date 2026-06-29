# 更新记录 / Changelog

本项目 `n8n-nodes-siliconflow-ai` 是 [QixYuanmeng/n8n-nodes-siliconflow](https://github.com/QixYuanmeng/n8n-nodes-siliconflow) 的重写版本，保留相同功能的同时解决了在最新 n8n 上的 `ERESOLVE` 安装失败问题。

## [0.4.2] — 2026-06-29

### Fixed
- **Vision 节点 Binary Data 图片源在 filesystem 二进制模式下报错** `Invalid base64 data format in binary property`。
  - 原因：原代码直接读 `binaryData.data` 并做 base64 正则校验，但在 n8n 的 `binaryDataMode: filesystem` 模式下 `.data` 为空（文件存于磁盘），导致校验失败。
  - 修复：改用 n8n 官方 API `helpers.getBinaryDataBuffer()` 读取真实字节再 base64 编码，内存模式与磁盘模式均适用。MIME 仍由二进制元数据推导。

## [0.4.1] — 2026-06-29

### Fixed
- **SiliconFlow 动作节点运行报 `Invalid URL` / `ERR_INVALID_URL`**。
  - 原因：请求 helper 把相对路径（如 `/chat/completions`）直接传给 `httpRequestWithAuthentication`，而该 helper 不会套用节点级 `requestDefaults.baseURL`（该机制仅对声明式路由节点生效）。
  - 修复：从凭证读取 `baseUrl` 并拼成完整 URL `${baseUrl}${path}` 后再发请求；Authorization 头仍由 helper 自动注入。

## [0.4.0] — 2026-06-29

### Added
- **模型选择新增 From List / By ID 双模式**，覆盖全部资源（Chat / Vision / Embeddings / Image / Rerank）及 Chat Model 节点。
  - **From List**：从内置常用模型清单选择。
  - **By ID**：手动输入任意模型 ID，**支持表达式**（如 `={{$json.model}}`），用于清单未收录或刚上线尚未更新的模型。
- 新增共享模块 `nodes/shared/models.ts`（模型清单 + 选择字段生成器 + 解析器），两个节点共用。

### Changed
- **全面更新模型清单**（按 2026-06 模型广场整理），替换原项目中已淘汰的模型：Chat 21、Vision 14、Embedding 8、Image 7、Rerank 6。
- 移除原 chat 类节点基于 `loadOptions` 的动态模型拉取，改为显式的 From List / By ID 选择器。

## [0.3.0] — 2026-06-29

### Added
- 新增 **SiliconFlow Chat Model** 节点（AI Agent 模型节点），输出 `AiLanguageModel`，可接入 n8n 的 AI Agent / Tools Agent / AI Chain。底层复用 `@langchain/openai` 的 `ChatOpenAI` 指向 SiliconFlow base URL。

### Changed
- **彻底解决 `ERESOLVE` 安装冲突**（核心改动）：
  - 动作节点 `SiliconFlow`：改为**零运行时依赖**，使用 n8n 内置 `httpRequestWithAuthentication`（移除 `axios`、`zod`、`langchain`）。
  - 模型节点 `SiliconFlowChatModel`：`@langchain/openai` / `@langchain/core` 声明为**可选 `peerDependencies`（`"*"`）**，不打包、不安装，运行时复用 n8n 自带 langchain —— 既保留 AI Agent 能力，又消除依赖冲突。
- 适配 `n8n-workflow@1.120` API：`NodeConnectionType` 已变为纯类型（改用字符串字面量 `'ai_languageModel'`）；节点 `group: 'ai'` 不再合法（改 `'transform'`）。
- SiliconFlow 动作节点新增 **Image Generation** 资源（`POST /images/generations`）。

## [0.2.0] — 2026-06-28

### Added
- SiliconFlow 动作节点支持 Chat Completion / Embedding / Image Generation / Rerank。
- 使用 n8n 内置 HTTP helper 直连 SiliconFlow，零运行时三方依赖。

## [0.1.0] — 2026-06-28

### Added
- 项目初始版本，基础 Chat / Embedding 能力。

---

> 本项目从 [QixYuanmeng/n8n-nodes-siliconflow](https://github.com/QixYuanmeng/n8n-nodes-siliconflow) 重写而来，感谢原作者的工作。
