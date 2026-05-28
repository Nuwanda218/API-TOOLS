# API Tools 本地多模型工作台设计

## 背景

目标是设计一个本地个人 Web 工具，用来管理多种模型 API，并在此基础上提供基础对话、GPT image2 最小入口、用量检测，以及未来可扩展的模块化多模型协作工作流。

第一版不是 SaaS，也不做多人登录或云端部署。它面向个人本地使用，重点是把 API 接入、模型管理、请求诊断、用量统计和会话工作台打通。

## 第一版目标

第一版实现一个本地个人 API 管理与多模型工作台原型。

必须包含：

- Vite + React 前端。
- Express 后端。
- SQLite 本地数据库。
- `.env` 保存 API Key。
- 顶部模块导航：工作台、API接入、模型管理、用量检测、工作流模板、设置。
- 工作台三栏布局：会话列表、当前会话/结果、运行详情/用量摘要/错误诊断。
- OpenAI-compatible provider 接入。
- Provider 和 model CRUD。
- 模型测试与错误诊断。
- 基础聊天 workflow。
- GPT image2 最小入口。
- Run 和 run step 记录。
- Token、延迟、错误、估算成本记录。
- 模块化 workflow 抽象，为未来多模型专职协作预留。

暂不包含：

- 多用户登录。
- 云端部署。
- 计费系统。
- 拖拽式工作流编辑器。
- 自动 agent 调度。
- Prompt 自动优化。
- 模型并排对比。
- 图像编辑或图像历史画廊。
- API Key 加密数据库存储。

## 总体架构

项目采用本地前后端分离结构：

```text
Vite React 前端
  → Express 本地后端
    → SQLite
    → .env
    → Provider adapters
      → OpenAI-compatible APIs
      → OpenAI image API / image2
```

### 前端

前端使用 Vite + React。主界面是会话工作台，但顶部保留一等模块入口：

```text
API Tools | 工作台 | API接入 | 模型管理 | 用量检测 | 工作流模板 | 设置
```

前端不直接调用外部模型 API，也不读取完整 API Key。所有模型请求都经过 Express 后端。

### 后端

后端使用 Express，负责：

- 读取 `.env` 中的 API Key。
- 管理 provider/model/session/run/usage 数据。
- 调用不同模型 adapter。
- 标准化 provider 错误。
- 记录 run 和 run_step。
- 计算 token、延迟、错误率和成本估算。

### 数据层

- `.env` 保存敏感信息，例如 API Key。
- SQLite 保存非敏感配置和运行数据。

API Key 不进入前端、不进入 SQLite、不写入日志。

## 页面结构

### 顶部一级模块

- **工作台**：默认首页，负责聊天、image2 最小入口、运行步骤展示。
- **API接入**：添加/编辑 provider，配置 `baseUrl`、`apiKeyEnv`、兼容类型、启停状态。
- **模型管理**：添加/编辑 model，配置模型能力、默认参数、价格、测试状态。
- **用量检测**：按 provider/model/workflow/session 查看请求量、token、估算成本、错误率、延迟。
- **工作流模板**：第一版展示内置模板；未来扩展模块化多模型协作配置。
- **设置**：本地路径、数据库位置、主题、导入导出等。

### 工作台三栏

```text
┌──────────────────────────────────────────────────────────────┐
│ API Tools | 工作台 | API接入 | 模型管理 | 用量检测 | 工作流模板 | 设置 │
├───────────────┬──────────────────────────────┬───────────────┤
│ 会话列表       │ 当前会话 / 生成结果            │ 运行详情       │
│               │                              │               │
│ + 新建会话     │ Workflow: 基础聊天             │ 当前模型        │
│ 基础聊天       │ Model: DeepSeek Chat          │ Provider       │
│ Image2 测试    │                              │ 延迟 / token    │
│ 模型测试       │ user / assistant messages     │ 成本 / 错误     │
│               │                              │ run steps      │
│               │ [输入框................] [发送]│               │
└───────────────┴──────────────────────────────┴───────────────┘
```

左侧显示会话列表；中间显示当前会话、图像结果或模型测试结果；右侧显示运行详情、当前 provider/model、用量摘要、错误诊断和 run steps。

## 配置和数据模型

### `.env`

`.env` 保存 API Key：

```env
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
CUSTOM_OPENAI_COMPATIBLE_KEY=sk-...
```

数据库和前端只保存变量名，例如 `OPENAI_API_KEY`。

### `providers`

Provider 表示 API 服务商或兼容端点。

```ts
{
  id: string;
  name: string;
  type: "openai-compatible" | "openai-official";
  baseUrl: string;
  apiKeyEnv: string;
  enabled: boolean;
}
```

### `models`

Model 表示某个 provider 下的具体模型。

```ts
{
  id: string;
  providerId: string;
  displayName: string;
  modelId: string;
  capability: "chat" | "image" | "multimodal";
  enabled: boolean;
  defaultParams: {
    temperature?: number;
    maxTokens?: number;
    imageSize?: string;
  };
  pricing?: {
    inputTokenPrice?: number;
    outputTokenPrice?: number;
    imagePrice?: number;
  };
}
```

### `sessions`

```ts
{
  id: string;
  title: string;
  workflowType: "chat" | "image-minimal" | "model-test";
  createdAt: string;
  updatedAt: string;
}
```

### `messages`

```ts
{
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  modelId?: string;
  runId?: string;
  createdAt: string;
}
```

### `runs`

一次用户请求触发一次 run。

```ts
{
  id: string;
  sessionId: string;
  workflowType: "chat" | "image-minimal" | "model-test";
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  endedAt?: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCostEstimate?: number;
}
```

### `run_steps`

Run step 是未来多模型协作的核心记录单元。第一版通常每次 run 只有一个 step，但结构必须支持多个 step。

```ts
{
  id: string;
  runId: string;
  stepIndex: number;
  stepType:
    | "chat-completion"
    | "image-generation"
    | "model-test"
    | "prompt-optimizer"
    | "reviewer"
    | "summarizer";
  providerId: string;
  modelId: string;
  status: "running" | "succeeded" | "failed";
  inputPreview: string;
  outputPreview?: string;
  errorCode?: string;
  errorMessage?: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  costEstimate?: number;
}
```

## 模块化工作流设计

未来多模型协作的长期核心是：不同模型承担专属工作，组合成完整产出链。

第一版不做拖拽编辑器，但从代码和数据结构上引入 workflow/module 抽象。

```ts
interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  modules: WorkflowModule[];
}

interface WorkflowModule {
  id: string;
  name: string;
  role:
    | "chat"
    | "image-generation"
    | "model-test"
    | "prompt-optimizer"
    | "reviewer"
    | "summarizer";
  capability: "chat" | "image" | "multimodal";
  modelSelection:
    | { type: "user-selected" }
    | { type: "fixed-model"; modelId: string }
    | { type: "capability-default"; capability: "chat" | "image" | "multimodal" };
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}
```

第一版内置三个 workflow：

```text
basic-chat:
  user input
    → chat module
    → assistant message

image-minimal:
  prompt
    → image generation module
    → image result

model-test:
  test prompt
    → model test module
    → diagnostic result
```

未来扩展图像创作工作流：

```text
user idea
  → requirement analyzer
  → prompt optimizer
  → image generation
  → reviewer
  → final recommendation
```

每个模块可以绑定不同模型。例如需求理解使用便宜快速模型，提示词优化使用创意写作强的模型，图像生成使用 image2，审查使用多模态模型，最终整合使用高质量文本模型。

## 后端模块划分

```text
server/
  config/
    env.ts
  db/
    client.ts
    schema.ts
  providers/
    providerService.ts
    modelService.ts
  adapters/
    types.ts
    openaiCompatible.ts
    openaiImage.ts
  workflows/
    types.ts
    registry.ts
    runner.ts
    modules/
      chatCompletion.ts
      imageGeneration.ts
      modelTest.ts
  usage/
    usageService.ts
  routes/
    providers.ts
    models.ts
    sessions.ts
    workflows.ts
    usage.ts
```

关键边界：

1. Provider/Model 管理只负责配置和状态。
2. Adapter 负责把统一请求转换为具体 provider 请求。
3. Workflow runner 负责编排模块、创建 run/run_step、写入 session。
4. Usage service 负责统计 token、成本、延迟和错误。

## Adapter 接口

所有模型调用实现统一 adapter 接口。

```ts
type ModelCapability = "chat" | "image" | "multimodal";

interface ModelAdapter {
  testModel(input: ModelTestInput): Promise<ModelTestResult>;
  runChat(input: ChatRunInput): Promise<ChatRunResult>;
  runImage?(input: ImageRunInput): Promise<ImageRunResult>;
}
```

### OpenAI-compatible adapter

用于 DeepSeek、OpenAI-compatible proxy、本地兼容端点等。

支持：

- `POST /chat/completions`
- `modelId`
- `messages`
- `temperature`
- `maxTokens`
- usage 解析
- provider 错误标准化

### OpenAI image adapter

用于 GPT image2 最小入口。

支持：

- prompt
- size / quality 等最小参数
- 返回图片 URL 或 base64
- 保存生成结果引用
- 记录失败原因

图像 adapter 独立于文本 adapter，避免图像 API 差异影响基础聊天。

## API 路由

### Provider

```http
GET    /api/providers
POST   /api/providers
PATCH  /api/providers/:id
DELETE /api/providers/:id
POST   /api/providers/:id/test
```

### Model

```http
GET    /api/models
POST   /api/models
PATCH  /api/models/:id
DELETE /api/models/:id
POST   /api/models/:id/test
```

### Session

```http
GET    /api/sessions
POST   /api/sessions
GET    /api/sessions/:id
DELETE /api/sessions/:id
```

### Workflow

```http
GET  /api/workflows
POST /api/workflows/:id/run
```

第一版核心运行接口：

```http
POST /api/workflows/basic-chat/run
POST /api/workflows/image-minimal/run
POST /api/workflows/model-test/run
```

### Usage

```http
GET /api/usage/summary
GET /api/usage/by-model
GET /api/usage/by-provider
GET /api/usage/runs/:runId
```

## 错误标准化

所有 adapter 错误统一转换为：

```ts
{
  code:
    | "missing_api_key"
    | "invalid_api_key"
    | "invalid_base_url"
    | "model_not_found"
    | "rate_limited"
    | "quota_exceeded"
    | "unsupported_capability"
    | "provider_error"
    | "network_error";
  message: string;
  providerMessage?: string;
  statusCode?: number;
  suggestion?: string;
}
```

前端显示：

- 简短错误标题。
- Provider 原始错误。
- 建议操作。
- 关联 provider/model 配置入口。

## 用量检测

每次 run/run_step 记录：

- provider
- model
- workflow
- latency
- token usage
- image count
- estimated cost
- status
- error code

用量检测页面第一版支持：

- 今日 / 本周 / 本月。
- 按 provider 汇总。
- 按 model 汇总。
- 错误次数和错误率。
- 平均延迟。
- 成本估算。

成本估算不承诺绝对准确。若 provider 未返回 usage，则显示“未返回”。

## 安全边界

- API Key 只从 `.env` 读取。
- 前端只能看到 env 变量名和是否存在，不能看到值。
- 请求外部 API 只从 Express 发出。
- 不把完整 API Key 写入日志、SQLite 或错误信息。
- `.env` 和本地数据库默认加入 `.gitignore`。
- 本地个人版不做用户系统，但后端接口仍按最小暴露原则设计。

## 验证标准

第一版完成后应满足：

1. 在 `.env` 添加至少一个 API Key。
2. 在 API接入添加 OpenAI-compatible provider。
3. 在模型管理添加一个 chat 模型。
4. 点击测试模型，能看到成功/失败状态、延迟、provider 原始错误和建议修复方式。
5. 在工作台创建基础聊天会话。
6. 选择 provider/model 后能完成一轮对话。
7. `runs` 和 `run_steps` 能记录这次调用。
8. 用量检测能看到请求数、token、估算成本、错误次数。
9. 添加 image-capability 模型后，能通过 image2 最小入口提交 prompt 并显示结果。
10. 前端不会暴露完整 API Key。

## 测试策略

### 后端单元测试

- Provider/model 配置校验。
- `.env` key 读取逻辑。
- Adapter 错误标准化。
- 成本估算。
- Workflow runner 创建 run/run_step。
- Usage 汇总。

### 后端集成测试

使用 mock adapter 测试：

- basic-chat workflow。
- image-minimal workflow。
- model-test workflow。
- 缺失 API Key。
- baseUrl 错误。
- model 不存在。
- provider 返回 401、429、500。

### 前端测试

- 顶部模块导航切换。
- Provider/model 表单。
- 模型测试结果展示。
- 聊天发送和 loading 状态。
- 运行详情面板。
- 用量检测数据展示。
- image2 最小入口结果展示。

### 手动验证

必须手动跑通：

- 本地启动前端和后端。
- 添加真实 provider。
- 添加真实 model。
- 测试模型。
- 发起基础聊天。
- 查看 usage。
- 尝试 image2 最小入口。

## 迭代路线

### V0.1：项目骨架

- Vite + React。
- Express。
- SQLite schema。
- 顶部导航和空页面。
- `.env.example`。
- Provider/model 基础类型。

### V0.2：API 接入和模型管理

- Provider CRUD。
- Model CRUD。
- OpenAI-compatible adapter。
- 模型测试。
- 错误标准化。

### V0.3：基础聊天工作台

- Session/message。
- basic-chat workflow。
- run/run_step。
- 工作台三栏 UI。
- 运行详情面板。

### V0.4：用量检测

- Usage 记录。
- Provider/model 汇总。
- 延迟、错误、token、成本估算。
- 用量检测页面。

### V0.5：image2 最小入口

- Image-capability model。
- Image adapter。
- Prompt 输入。
- 图片展示。
- Image run_step 记录。

### V0.6：模块化工作流预留增强

- Workflow template registry。
- Workflow module 类型完善。
- 工作流模板页面显示模块链路。
- 为未来“模型专职分工”预留配置字段。

## 未来扩展

### 模型对比

同一输入并行调用多个模型，生成多个 run_step，并排展示答案。

### 生成 + 审查

一个模型生成，另一个模型审查，最后生成修订稿。

### 图像创作工作流

```text
需求理解模型
  → 提示词优化模型
  → image2 生成
  → 多模态审查模型
  → 修改建议 / 再生成
```

### 模块化工作流编辑器

未来再做可视化编辑器：

- 添加模块。
- 选择模块角色。
- 绑定模型。
- 设置输入输出字段。
- 连接模块输出到下一个模块输入。
- 保存为 workflow template。

## 设计原则

- 先把 provider/model/run/usage 做稳定，不急着做复杂 agent。
- 每个模型调用都必须有 run_step，方便追踪、调试和统计。
- 每个 workflow module 都要有明确输入输出，避免变成不可维护的 prompt 串烧。
- 第一版以 OpenAI-compatible 为主，特殊模型如 image2 用专门 adapter。
- 不把 API Key 交给前端。
- 不追求成本统计绝对准确，先做可解释的估算。
- UI 保持工作台优先，但顶部模块让 API 管理和用量检测有一等入口。
