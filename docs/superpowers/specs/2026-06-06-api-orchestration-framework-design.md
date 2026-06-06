# API Tools 本地通用 API 编排框架设计

## 状态

本设计覆盖旧的 `docs/superpowers/specs/2026-05-28-api-tools-design.md`。

旧文档仍作为历史背景保留，但项目主线不再是“本地多模型工作台”。新的主线是：先建立稳定的本地 API 编排内核，再在此基础上发展模型工作台、调试界面、更多 operation 和更复杂 workflow。

## 背景

项目最初被设计为本地个人多模型 Web 工具，目标包括模型 API 管理、基础聊天、GPT image2 最小入口、用量检测和未来多模型协作 workflow。

当前实现已经发生方向变化：代码不再只围绕 OpenAI-compatible 聊天工作台展开，而是引入了更底层的 API 协议层、adapter registry、provider `apiFormat`、workflow step 和 run trace。这个变化是正确的，应被正式确认为新的项目方向。

新的目标是设计一个本地通用 API 编排框架。第一类支持的 API 是 LLM chat；OpenAI Chat Completions 和 OpenAI Responses 是第一批 adapter。它们不是系统边界，只是第一组垂直用例。

## 新项目定位

API Tools 是一个本地通用 API 编排框架。

它负责用统一方式描述、调用、记录和扩展外部 API：

```text
Provider
  → Adapter / API Format
    → Internal Operation
      → Workflow Step
        → Run / Run Step Trace
```

核心原则：

- Workflow 表达“要做什么”，不表达“外部 API 怎么调用”。
- Adapter 吸收外部 API 差异，把外部 request/response 转成内部标准结构。
- Provider 保存连接配置和 adapter 选择信息，不保存 API Key 明文。
- 每次 operation invocation 都必须产生可追踪的 run step。
- 第一阶段优先稳定协议、边界、错误模型、trace 和测试，而不是完整前端工作台。

## 旧方向如何被覆盖

旧设计中的以下内容被降级为未来产品层：

- 多模型聊天工作台。
- API 接入页面。
- 模型管理页面。
- 用量检测页面。
- image2 最小入口。
- 工作流模板页面。

这些能力不是被取消，而是不再驱动第一阶段架构。第一阶段先保证内核正确：

- operation contract 稳定。
- adapter contract 稳定。
- workflow step contract 稳定。
- run/run_step trace 稳定。
- 错误模型稳定。
- 扩展规则稳定。

前端 UI 后续应围绕这些内核抽象重新设计，而不是继续直接按旧“聊天工作台”结构推进。

## 第一阶段不包含

第一阶段明确不做：

- 完整前端工作台。
- 可视化 workflow builder。
- GPT image2 或通用 image generation UI。
- 任意 HTTP API step 执行。
- 多 step dependency wiring。
- 条件分支、循环、重试策略。
- plugin marketplace 或第三方 adapter 分发。
- 云端部署、多用户权限或团队协作。
- 复杂 usage dashboard。

第一阶段只聚焦：

```text
定义协议
  → 固化 adapter 边界
    → 固化 workflow step/run trace
      → 补齐文档和测试
        → 为下一阶段实现计划提供稳定基础
```

## 第一阶段成功标准

阶段完成后，开发者或 agent 应能明确回答：

1. 新增一个外部 API 时，应该从哪里开始。
2. 新增 operation 时，如何定义 input/output。
3. Adapter 应该负责哪些事情，不应该负责哪些事情。
4. Workflow step 如何引用 operation。
5. Run/run_step 需要记录哪些信息。
6. Provider-specific 细节为什么不能泄露到 workflow 层。
7. 当前只支持 `llm.chat` 的原因是什么。
8. 下一阶段扩展 `image.generate` 或 `http.request` 时，应遵循什么规则。

## 核心抽象

### Provider

Provider 表示一个外部 API 服务入口。

它回答：请求发到哪里、使用哪种 API 格式、API Key 从哪个环境变量读取。

核心字段：

```ts
interface Provider {
  id: string;
  name: string;
  type: "openai-compatible" | "openai-official" | string;
  apiFormat: "openai-chat-completions" | "openai-responses" | string;
  baseUrl: string;
  apiKeyEnv: string;
  enabled: boolean;
}
```

职责：

- 保存外部 API 的连接配置。
- 选择 adapter 或 API format。
- 只保存 API Key 环境变量名，不保存 key 值。
- 不定义业务 workflow。
- 不知道具体 workflow 如何使用它。

边界：

- Provider 不保存 provider-specific 请求 body 模板。
- Provider 不保存 workflow step 配置。
- Provider 不把 API Key 暴露给前端、日志或 SQLite。

### Resource / Model

Model 是当前最重要的一类 resource，但未来不应把所有外部 API 都强行塞进 model 概念。

当前阶段：

```text
Model = llm.chat operation 的 resource
```

未来可扩展：

```text
Resource =
  | model
  | endpoint
  | file
  | image
  | tool
  | none
```

职责：

- 描述 operation 需要绑定的外部资源。
- `llm.chat` 需要 `model`。
- 未来 `http.request` 可能不需要 model，而只需要 provider 和 endpoint config。

边界：

- Model 不知道 adapter 的具体 request mapping。
- Model 不直接保存 provider API 返回的完整原始结构，只保存项目需要的标准字段。

### Internal Operation

Internal Operation 是系统最关键的抽象。

它回答：workflow 想做什么，而不是 provider 要怎么调用。

示例：

```text
llm.chat
models.list
image.generate
embedding.create
http.request
audio.transcribe
```

第一阶段只稳定 `llm.chat`，并保留 `models.list` 作为 provider/model 管理所需的内部能力。

每个 operation 都必须定义：

- operation id。
- input schema。
- output schema。
- usage schema。
- error expectations。
- required resource kind。
- 是否可作为 workflow step 使用。

边界：

- Workflow 只引用 internal operation。
- Adapter 才知道 external endpoint。
- Provider-specific endpoint path 不进入 workflow definition。
- Operation contract 先稳定，adapter 再实现。

### Adapter

Adapter 负责把 internal operation 映射到某种外部 API 格式。

它回答：给定 provider、apiKey、resource、operation 和 input，如何调用真实外部 API，并把结果变成本项目标准格式。

职责：

- 判断是否支持某个 operation。
- 构造外部 request。
- 调用外部 API。
- 解析外部 response。
- 归一化 output。
- 归一化 usage。
- 归一化错误。
- 保留必要 raw 信息供调试，但不能泄漏 secret。

当前 adapter 方向：

```text
openai-chat-completions
openai-responses
```

边界：

- Adapter 不创建 run/run_step。
- Adapter 不管理 session/message。
- Adapter 不决定 workflow 下一步。
- Adapter 不把 provider-specific response 作为主数据结构直接返回给上层。

### Adapter Registry

Adapter Registry 是 provider 到 adapter 的选择层。

它回答：这个 provider 的 `apiFormat` 应由哪个 adapter 处理。

职责：

- 根据 `provider.apiFormat` 选择 adapter。
- 暴露统一 `invoke()` 入口。
- 检查 adapter 是否支持 operation。
- 返回标准 `ApiInvocationOutcome`。

边界：

- Registry 不包含具体 request mapping。
- Registry 不知道 workflow 业务。
- Registry 是 route/runner 与 adapter 之间的分发层。

### Workflow Step

Workflow Step 是 operation 在 workflow 中的一个实例。

它回答：这一步要执行哪个 operation、使用哪个 resource、输入来自哪里。

第一阶段保持最小结构：

```ts
interface WorkflowStep {
  id: string;
  type: "llm.chat";
  modelId?: string;
  input: Record<string, unknown>;
}
```

未来扩展再加入：

- input mapping。
- output mapping。
- dependency references。
- retry policy。
- timeout。
- condition。
- parallel group。

边界：

- Step 不直接写 provider endpoint。
- Step 不直接写 adapter id，除非未来有明确 override 机制。
- Step 引用 operation 和 resource，而不是外部 API 细节。

### Workflow Runner

Workflow Runner 负责执行 workflow step，并写入 trace。

职责：

- 校验 workflow step。
- 根据 step 找到 resource/model。
- 调用 adapter registry。
- 创建 session/message/run/run_step。
- 聚合 usage 和 cost。
- 记录成功或失败状态。
- 生成最终 output。

边界：

- Runner 不构造 provider-specific request。
- Runner 不解析 provider-specific response。
- Runner 不直接知道 OpenAI Responses 和 Chat Completions 的差异。
- Runner 不把 adapter raw response 当作业务 output。

### Run / Run Step Trace

Run 和 Run Step 是框架可观测性的核心。

它们回答：这次执行发生了什么、每一步调用了谁、耗时多少、花费多少、哪里失败。

第一阶段必须稳定记录：

- run id。
- session id。
- workflow type。
- status。
- started/ended time。
- total input/output tokens。
- total estimated cost。
- step index。
- step type / operation id。
- provider id。
- resource/model id。
- input preview。
- output preview。
- latency。
- error code。
- error message。

边界：

- 不保存完整 API Key。
- 不默认保存完整原始 request/response。
- raw debug 数据如果未来保存，必须可关闭、脱敏、受大小限制。

### Error Model

错误必须在 adapter 层标准化，上层只处理统一错误码。

基础错误码：

```text
missing_api_key
invalid_api_key
invalid_base_url
provider_not_found
model_not_found
unsupported_operation
unsupported_capability
unsupported_workflow_step
invalid_workflow_step
rate_limited
quota_exceeded
provider_error
network_error
```

职责边界：

- Adapter 负责把 provider status/body 转成标准错误。
- Registry 负责 `unsupported_operation`。
- Runner 负责 workflow/resource 校验错误。
- Route 层只负责 HTTP status 和 JSON 输出。

## 依赖方向

稳定依赖方向：

```text
routes
  → workflow runner / repositories
    → adapter registry
      → adapters
        → external APIs

repositories
  → database

apiProtocol/types
  ← adapters / runner / routes 共同依赖
```

禁止反向依赖：

- Adapter 不能依赖 route。
- Adapter 不能依赖 workflow runner。
- Repository 不能依赖 adapter。
- `apiProtocol/types` 不能依赖具体 adapter 实现。

## 标准执行数据流

标准执行链路：

```text
HTTP Route
  → Workflow Runner
    → Repository 查 Provider / Resource
      → Adapter Registry
        → Adapter
          → External API
        ← 标准 ApiInvocationOutcome
    → 写入 Run / RunStep / Message
  ← 返回标准 Workflow Result
```

以 `llm.chat` 为例：

```text
POST /api/workflows/run
  input:
    workflowType: "api-workflow"
    steps:
      - id: "main-response"
        type: "llm.chat"
        modelId: "..."
        input:
          message: "..."

Runner:
  1. 创建 session / run
  2. 读取 model
  3. 读取 provider
  4. 读取 provider.apiKeyEnv 对应的 API key
  5. 调用 adapterRegistry.invoke({
       operationId: "llm.chat",
       provider,
       apiKey,
       resource: { kind: "model", model },
       input: { messages: [...] }
     })
  6. 接收标准 outcome
  7. 写 run_step
  8. 更新 run usage/cost/status
  9. 写 assistant message
  10. 返回 result
```

关键原则：

- Route 不直接调用 adapter。
- Runner 不知道具体外部 API endpoint。
- Adapter 不写数据库。
- Workflow step 永远表达“我要做什么”，不表达“我要请求哪个外部 URL”。

## Operation-first 扩展规则

未来新增能力时，必须按这个顺序：

```text
1. 定义 internal operation
2. 定义 input/output/usage/error contract
3. 定义需要的 resource kind
4. 写 protocol-level tests
5. 实现 adapter mapping
6. 写 adapter tests
7. 接入 registry
8. 写 runner/route tests
9. 最后再考虑 UI
```

这条规则防止项目退回到：

```text
先为某个 provider 写一个 endpoint 调用
  → 再把 provider response 原样塞进 workflow
  → 最后每个 API 都变成一次特殊处理
```

新方向必须反过来：

```text
先稳定内部语义
  → 再适配不同外部 API
```

## 新增 Operation 的规范

每个 operation 必须有一份最小定义。

未来 `image.generate` 示例：

```ts
interface ImageGenerateOperation {
  id: "image.generate";
  resourceKind: "model";
  input: {
    prompt: string;
    size?: string;
    quality?: string;
  };
  output: {
    images: Array<{
      url?: string;
      base64?: string;
      mimeType?: string;
    }>;
  };
  usage: {
    imageCount?: number;
    estimatedCost?: number;
  };
}
```

未来 `http.request` 示例：

```ts
interface HttpRequestOperation {
  id: "http.request";
  resourceKind: "none" | "endpoint";
  input: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  output: {
    status: number;
    headers: Record<string, string>;
    body: unknown;
  };
}
```

第一阶段不实现这些 operation，只定义新增 operation 时必须遵守的要求。

## Adapter 扩展规则

Adapter 分为两类。

### Dedicated Adapter

适合 API 语义复杂、response 差异大、需要专门错误映射的场景。

例如：

- OpenAI Chat Completions。
- OpenAI Responses。
- Anthropic Messages。
- Gemini Generate Content。
- Image generation API。

优点：

- 映射清晰。
- 错误处理可靠。
- 测试粒度好。

缺点：

- 每接一个 API 都要写代码。

### Config-driven HTTP Adapter

适合结构简单、通用 HTTP 调用。

例如：

- 普通 REST API。
- 内部 webhook。
- 简单 JSON endpoint。

优点：

- 扩展快。
- 可以配置化。

缺点：

- 类型安全弱。
- 错误归一化难。
- 容易把 provider-specific 细节泄漏到 workflow。

第一阶段只定义这个分类，不实现 config-driven HTTP adapter。

推荐规则：

- LLM、image、multimodal 这类高价值 operation 使用 dedicated adapter。
- 普通 REST 自动化将来再引入 config-driven adapter。
- 即使是 config-driven，也必须输出标准 `ApiInvocationOutcome`。

## Workflow 扩展规则

第一阶段 workflow 只支持顺序单步或极简多步 `llm.chat`。

未来扩展按顺序推进：

### 阶段 1：单步 operation

```text
input → llm.chat → output
```

### 阶段 2：多步顺序执行

```text
input → step A → step B → output
```

### 阶段 3：step output mapping

```text
step A output.content → step B input.message
```

### 阶段 4：并行与聚合

```text
input
  → model A
  → model B
  → model C
  → aggregate
```

### 阶段 5：条件、循环、重试

```text
if review failed → regenerate
retry on rate_limited
loop until pass
```

这个顺序不能跳。否则 workflow runner 会过早复杂化。

## Trace 与可观测性规则

每一次 operation invocation 都必须对应一个 run_step。

即使 workflow 未来支持并行，也必须能回答：

- 哪一步执行了。
- operation id 是什么。
- 用了哪个 provider。
- 用了哪个 resource/model。
- 输入摘要是什么。
- 输出摘要是什么。
- 延迟多少。
- usage 是多少。
- 成本估算是多少。
- 失败原因是什么。

原则：

```text
No invocation without trace.
No trace with secret.
No workflow result without run id.
```

含义：

- 没有 trace 的调用不允许存在。
- trace 中不能出现 API Key。
- 用户拿到结果时，必须能回查 run id。

## 错误处理数据流

错误处理链路：

```text
External API error
  → Adapter maps provider error
    → ApiInvocationError
      → Registry returns outcome
        → Runner writes failed run_step / failed run
          → Route returns standard JSON error
```

错误分三类。

### 配置错误

例如：

- `missing_api_key`
- `invalid_base_url`
- `provider_not_found`
- `model_not_found`
- `unsupported_capability`

这些通常返回 400 或 404。

### Provider 错误

例如：

- `invalid_api_key`
- `rate_limited`
- `quota_exceeded`
- `provider_error`

这些来自外部 API，但对本地用户应显示可诊断信息。

### 系统错误

例如：

- database failure。
- unexpected exception。
- adapter bug。

这些返回内部错误，但不暴露 secret 或完整 stack。

第一阶段重点是保证 provider/config 错误可诊断。

## 测试策略

测试按层次组织。

### Protocol tests

验证 internal operation 与类型规则。

应覆盖：

- operation id 是否属于已知集合。
- operation 的 input/output contract 是否清晰。
- unsupported operation 是否被拒绝。
- provider-specific path 不进入 workflow contract。

### Adapter tests

每个 adapter 必须 mock fetch，覆盖：

- request URL。
- request body mapping。
- response mapping。
- usage mapping。
- 401 / 404 / 429 / 500 错误映射。
- network error。
- 不泄漏 API Key。

### Registry tests

覆盖：

- provider.apiFormat 到 adapter 的选择。
- unsupported apiFormat。
- adapter 不支持 operation。
- invoke 返回标准 outcome。

### Runner tests

覆盖：

- 创建 session/run/run_step。
- 成功执行 `llm.chat`。
- adapter error 时写 failed run_step / failed run。
- unsupported workflow step。
- missing model/provider/api key。
- usage/cost 聚合。

### Route tests

覆盖：

- `/api/providers`。
- `/api/models`。
- `/api/workflows`。
- `/api/usage`。
- 错误 HTTP status 和 response shape。

### Integration verification

后端每阶段至少运行：

```bash
npm run test --workspace server
npm run typecheck --workspace server
```

当 client 重新启动后，再恢复：

```bash
npm test
npm run typecheck
npm run build
```

## 文档策略

规范优先阶段至少需要三类文档。

### 总方向 spec

当前文档负责定义：

- 项目新定位。
- 旧方向覆盖关系。
- 核心抽象。
- 执行流。
- 扩展规则。
- 测试策略。
- 阶段路线。

### Operation contract docs

后续为每个 operation 单独记录：

- `llm.chat`。
- `models.list`。
- 未来 `image.generate`。
- 未来 `http.request`。

### Adapter implementation notes

后续为每类 adapter 记录：

- OpenAI Chat Completions mapping。
- OpenAI Responses mapping。
- 未来 Anthropic / Gemini / HTTP mapping。

第一阶段先写总方向 spec。operation docs 和 adapter notes 在后续 implementation plan 中安排。

## 阶段路线

### Phase 0：方向重置

当前阶段。

产物：

- 新总方向 spec。
- 明确 supersedes 旧工作台 spec。
- 明确第一阶段不做前端大 UI。

### Phase 1：协议固化

目标：

- 固化 `ApiInvocation`。
- 固化 `ApiInvocationOutcome`。
- 固化 `ApiAdapter`。
- 固化 `AdapterRegistry`。
- 固化 `WorkflowStep`。
- 固化错误码。
- 补足失败 trace 测试。

### Phase 2：operation 文档化

目标：

- 为 `llm.chat` 写 operation contract。
- 为 `models.list` 写 operation contract。
- 定义但不实现 `image.generate`。
- 定义但不实现 `http.request`。

### Phase 3：最小调试 UI

目标：

- Provider 管理。
- Model 管理。
- Operation test panel。
- Run trace viewer。

这不是完整工作台，而是内核调试界面。

### Phase 4：更多 operation / adapter

目标：

- `image.generate`。
- `http.request`。
- 更多 provider adapter。
- 多步 workflow。

## 设计原则

- 先稳定内部语义，再适配外部 API。
- 先写 operation contract，再写 adapter。
- 每次调用必须有 trace。
- Trace 不能包含 secret。
- Workflow 层不能泄露 provider-specific endpoint。
- Route 层只做 HTTP 输入输出，不承载业务编排。
- Adapter 层只做外部 API 映射，不管理数据库状态。
- 前端 UI 服从内核抽象，而不是反过来驱动内核。 
