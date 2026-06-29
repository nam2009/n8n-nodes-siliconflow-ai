# n8n-nodes-siliconflow-ai

![npm version](https://img.shields.io/npm/v/n8n-nodes-siliconflow-ai) ![npm](https://img.shields.io/npm/dm/n8n-nodes-siliconflow-ai) ![license](https://img.shields.io/npm/l/n8n-nodes-siliconflow-ai)

一个面向 [n8n](https://n8n.io) 的社区节点，封装 [SiliconFlow（硅基流动）](https://siliconflow.cn) 的 OpenAI 兼容 REST API。提供**两个节点**：

- **SiliconFlow**（动作节点）：Chat / Vision / Embeddings / Image Generation / Rerank
- **SiliconFlow Chat Model**（AI Agent 模型节点）：LangChain 兼容，可接入 n8n 的 AI Agent / Tools Agent / AI Chain

> 📌 当前版本 **0.4.2** · [查看完整更新记录](./CHANGELOG.md) · [致谢原项目](#-致谢)

> 🎯 **核心目的**：解决 [QixYuanmeng/n8n-nodes-siliconflow](https://github.com/QixYuanmeng/n8n-nodes-siliconflow) 在最新 n8n 中因把 `langchain@^0.3.29` 写进 `dependencies` 而与宿主 n8n 自带的 `@langchain/core@1.x` 产生 `ERESOLVE` 冲突、导致安装失败的问题。
>
> **依赖策略（关键）**：
> - 动作节点 `SiliconFlow`：**零运行时三方依赖**，完全使用 n8n 内置 `httpRequestWithAuthentication` 直连 SiliconFlow，永不冲突。
> - 模型节点 `SiliconFlowChatModel`：`@langchain/openai` / `@langchain/core` 仅声明为**可选 peerDependencies（`"*"`）**，不打包、不安装，运行时直接复用 n8n 自带的 langchain —— 既保留 AI Agent 能力，又彻底消除 `ERESOLVE`。

---

## 📦 安装

### 方式 1：通过 n8n UI 安装（推荐）

需要 n8n >= 1.0。

1. 启动 n8n
2. 打开 **Settings → Community Nodes**
3. 点击 **Install**
4. 输入包名：`n8n-nodes-siliconflow-ai`
5. 同意风险提示 → Install

### 方式 2：本地加载（无需发布到 npm）

启动 n8n 前设置环境变量：

```bash
# Linux / macOS / Git Bash
export N8N_CUSTOM_EXTENSIONS="/d/GITHUB/n8n-nodes-siliconflow-ai"

# Windows CMD
set N8N_CUSTOM_EXTENSIONS=D:\GITHUB\n8n-nodes-siliconflow-ai

# Windows PowerShell
$env:N8N_CUSTOM_EXTENSIONS="D:\GITHUB\n8n-nodes-siliconflow-ai"
```

或者把 `dist/` + `package.json` 复制到 `~/.n8n/custom/n8n-nodes-siliconflow-ai/`。

### 方式 3：Docker 自定义镜像

```dockerfile
FROM n8nio/n8n:latest
USER root
RUN mkdir -p /home/node/.n8n/custom/n8n-nodes-siliconflow-ai
COPY --chown=node:node dist /home/node/.n8n/custom/n8n-nodes-siliconflow-ai/dist
COPY --chown=node:node package.json /home/node/.n8n/custom/n8n-nodes-siliconflow-ai/
USER node
```

---

## 🔑 凭证配置

1. 登录 [SiliconFlow 控制台](https://cloud.siliconflow.cn/account/ak) 创建 API Key（新用户注册送 2000 万 token 免费额度）
2. n8n → **Credentials → New → SiliconFlow API**
3. 填写：
   - **API Key**：你的密钥
   - **Base URL**：默认 `https://api.siliconflow.cn/v1`（一般无需修改）
4. 点击 **Test connection**，会请求 `/v1/models` 验证

---

## ✨ 支持的能力

### 节点 1：SiliconFlow（动作节点）

| Resource | Operation | 端点 | 说明 |
|---|---|---|---|
| Chat | Complete | `POST /chat/completions` | 兼容 OpenAI 格式的对话，支持 thinking / tools 等参数 |
| Vision | Analyze | `POST /chat/completions` | 多模态视觉理解（支持二进制/URL/base64 图片） |
| Embeddings | Create | `POST /embeddings` | 文本向量化 |
| Image | Generate | `POST /images/generations` | 文生图 |
| Rerank | Create | `POST /rerank` | 文档重排序（RAG 后处理） |

### 节点 2：SiliconFlow Chat Model（AI Agent 模型节点）

输出 `AiLanguageModel` 连接，把 **SiliconFlow Chat Model** 节点连到 **AI Agent** / **Tools Agent** / **AI Chain** 即可让 Agent 使用 SiliconFlow 上的模型（含工具调用、推理模型 thinking 等）。底层复用 `@langchain/openai` 的 `ChatOpenAI` 指向 SiliconFlow base URL。

---

## 🧩 模型选择：From List / By ID

每个资源（Chat / Vision / Embeddings / Image / Rerank）以及 Chat Model 节点的模型选择都支持两种模式（顶部 **Model Selection** 切换）：

| 模式 | 说明 |
|---|---|
| **From List** | 从内置的常用模型清单里选（清单见下，已按 2026-06 模型广场整理） |
| **By ID** | 手动输入任意模型 ID，**支持表达式**（如 `={{$json.model}}`）。用于清单未收录、或刚上线尚未更新的模型 |

> SiliconFlow 模型会上下架，内置清单无法保证永远最新；遇到列表里没有的模型，直接切到 **By ID** 填入即可，无需等节点更新。

内置清单（按你提供的模型广场整理）：

- **Chat（21）**：GLM-5.2、Kimi-K2.7-Code、DeepSeek-V4-Pro/Flash、DeepSeek-V3.2(+Pro)、DeepSeek-R1、Nex-N2-Pro、MiniMax-M2.5(+Pro)、Qwen3.6/3.5 系列、Step-3.5-Flash、Ling-mini-2.0、Hunyuan-MT-7B、Seed-OSS-36B 等
- **Vision（14）**：Qwen3-VL-32B、Qwen3-Omni 系列、GLM-4.5V、DeepSeek-OCR 等
- **Embedding（8）**：Qwen3-Embedding 系列、bge-m3(+Pro)、bge-large-zh/en 等
- **Image（7）**：Z-Image(+Turbo)、ERNIE-Image-Turbo、Qwen-Image(+Edit)、Kolors 等
- **Rerank（6）**：Qwen3-Reranker 系列、bge-reranker-v2-m3(+Pro) 等

清单源码位于 `nodes/shared/models.ts`，可直接增删维护。

---

## 🚀 典型用法

### 1. 简易聊天工作流

```
[Manual Trigger] → [SiliconFlow (Chat)] → [Set] → [Respond to Webhook]
```

**SiliconFlow 节点配置：**
- Resource: `Chat Completion`
- Model: `Qwen/Qwen2.5-7B-Instruct`
- Messages: `=[{"role":"system","content":"你是一个翻译助手"},{"role":"user","content":"{{$json.text}}"}]`
- Additional Options → Temperature: `0.5`，Max Tokens: `1024`

**Set 节点**：把 `choices[0].message.content` 提取到 `output` 字段。

### 2. 批量 Embedding

把上游节点的 `texts` 字段传入：

- Resource: `Embedding`
- Model: `BAAI/bge-m3`
- Input: `={{$json.texts}}`（值为字符串数组）
- Additional Options → Encoding Format: `Float`

下游节点用 `data[0].embedding` 取第一条向量。

### 3. RAG 中的 Rerank 流程

```
[Vector Store] → [SiliconFlow (Rerank)] → [Top-K 送入 LLM]
```

- Resource: `Rerank`
- Model: `BAAI/bge-reranker-v2-m3`
- Query: `{{$json.question}}`
- Documents: `={{$json.docs}}`（如 `["doc1","doc2",...]` 或 `[{"text":"doc1"}]`）
- Top N: `3`

输出 `results` 数组中每项含 `index`、`relevance_score` 和 `document`（开启 Return Documents 时）。

### 4. 文生图

- Resource: `Image Generation`
- Model: `stabilityai/stable-diffusion-2-1`
- Prompt: `a cute cat astronaut, cinematic lighting`
- Image Size: `1024x1024`，Batch Size: `1`

输出 `images[0].url` 即图片 URL（部分模型返回 base64）。

### 5. 用 AI Agent 调用 SiliconFlow 模型

```
[AI Agent] ←（Model）— [SiliconFlow Chat Model]
        ↓
   [其它 Tool 节点…]
```

- 把 **SiliconFlow Chat Model** 节点的输出连到 **AI Agent** 的 Model 输入
- 在 Chat Model 节点选择模型（如 `deepseek-ai/DeepSeek-V3`、`Qwen/Qwen2.5-72B-Instruct`）
- Agent 即可使用该模型进行工具调用 / 推理

---

## 🧪 常见模型参考

| 用途 | 模型示例 |
|---|---|
| 对话 | `Qwen/Qwen2.5-7B-Instruct`、`deepseek-ai/DeepSeek-V3`、`THUDM/glm-4-9b-chat` |
| Embedding | `BAAI/bge-m3`、`Pro/BAAI/bge-m3` |
| 图像 | `stabilityai/stable-diffusion-2-1`、`black-forest-labs/FLUX.1-schnell` |
| Rerank | `BAAI/bge-reranker-v2-m3` |

完整列表见 [SiliconFlow 模型广场](https://siliconflow.cn/models)。

---

## 🆚 与原 n8n-nodes-siliconflow 的区别

| 项 | 原项目 | 本项目 |
|---|---|---|
| `langchain` 声明位置 | `dependencies`（被 npm 安装 → 触发 `ERESOLVE`） | **可选 `peerDependencies`（`"*"`）**，不安装，运行时复用 n8n 自带版本 |
| 动作节点运行时依赖 | `axios` + `zod` | **零**（用 n8n 内置 `httpRequestWithAuthentication`） |
| 最新 n8n 安装 | ❌ `ERESOLVE` 报错 | ✅ 干净通过 |
| AI Agent 模型节点 | ✅ 有 | ✅ 保留（同样接入 AI Agent） |
| 包大小 | 较大（打包 langchain/axios） | 很小（不打包三方运行时依赖） |
| 维护难度 | 跟随 langchain 升级易冲突 | 复用 n8n 自带 langchain，跟随 SiliconFlow API 变更即可 |

---

## 🛠 开发

```bash
# 克隆
git clone https://github.com/nam2009/n8n-nodes-siliconflow-ai.git
cd n8n-nodes-siliconflow-ai

# 安装开发依赖
npm install

# 编译
npm run build

# 监听模式（自动编译）
npm run build:watch
```

修改源码后建议在本地 n8n 验证（见上文「方式 2：本地加载」）。

---

## 📚 参考文档

- [SiliconFlow API 总览](https://docs.siliconflow.cn/cn/api-reference/authentication)
- [SiliconFlow Chat Completions](https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions)
- [SiliconFlow Embeddings](https://docs.siliconflow.cn/cn/api-reference/embeddings/embeddings)
- [SiliconFlow Images](https://docs.siliconflow.cn/cn/api-reference/images/images)
- [SiliconFlow Rerank](https://docs.siliconflow.cn/cn/api-reference/rerank/rerank)
- [n8n 社区节点开发指南](https://docs.n8n.io/integrations/community-nodes/building-community-nodes/)

---

## 📝 更新记录

详见 [CHANGELOG.md](./CHANGELOG.md)。简要回顾：

- **0.4.2** — 修复 Vision 节点在 filesystem 二进制模式下用 Binary Data 分析图片报错
- **0.4.1** — 修复 SiliconFlow 动作节点运行报 `Invalid URL`
- **0.4.0** — 新增 From List / By ID 模型选择；全面更新模型清单
- **0.3.0** — 解决 `ERESOLVE` 安装冲突；新增 AI Agent Chat Model 节点；新增 Image 资源

---

## 🙏 致谢

本项目从 [QixYuanmeng/n8n-nodes-siliconflow](https://github.com/QixYuanmeng/n8n-nodes-siliconflow) 重写而来，在保留原项目功能的基础上解决了其在最新 n8n 上的 `ERESOLVE` 依赖冲突安装失败问题。

衷心感谢原作者 **[QixYuanmeng](https://github.com/QixYuanmeng)** 的工作 —— 本项目的节点设计、参数结构与功能划分均参考自原项目。没有原项目的基础，就没有本项目。

> 原项目地址：https://github.com/QixYuanmeng/n8n-nodes-siliconflow

---

## 📄 License

MIT

