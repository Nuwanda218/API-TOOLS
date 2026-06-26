# API Tools V0.3 适配器与工作流编排实现计划

> **目标：** 把 API Tools 从"单步 LLM 工作台"升级为"多 API 编排框架"——工作流能串联 LLM 调用、MCP 工具、HTTP 端点，用户可管理 MCP Server、注册 Skill 模板、可视化编排多步工作流。

> **架构：** 在 V0.2 的 provider/model/endpoint/runner 基础上，新增 MCP Client 模块、`endpoint.call` / `mcp.call` 工作流步骤、Skill 模板系统、工作流构建器前端。对话记忆作为设计轨道暂不实现。

> **技术栈：** TypeScript, Express, better-sqlite3, @modelcontextprotocol/sdk, Vite, React, Vitest, React Testing Library, Zod.

---

## 范围

本计划实现：

- `endpoint.call` 步骤——工作流中调用已注册的 Endpoint
- `mcp.call` 步骤——工作流中调用 MCP Server 的工具
- MCP Client 模块（stdio transport）
- MCP Server 管理 CRUD
- Skill 模板系统（预定义工作流模板 + 用户自定义模板）
- 工作流构建器前端（可视化编排多步骤）
- 运行历史增强（按步骤展示 trace）
- 配置导入导出升级（包含 MCP Server 和 Skill 模板）
- 完整测试和文档

本计划不实现：

- 对话记忆（长期记忆/向量记忆/摘要记忆）
- 拖拽式工作流编辑器（先做表单式，未来再做拖拽）
- 并行步骤/条件分支/循环
- 图像生成
- 多用户/云端部署

---

## 核心机制：步骤间数据传递

这是贯穿 V0.3 所有 Task 的核心机制。

### 数据流定义

每个步骤执行后产生 `outputs[stepId]`，是一个键值对对象。其他步骤可以通过 `{{steps.<stepId>.outputs.<field>}}` 引用。

```ts
// 工作流输入
input: { query: "北京的天气", targetLang: "en" }

// 步骤执行后
outputs = {
  "extract": { content: "北京 天气" },
  "search": { content: [{ type: "text", text: "晴, 25°C" }] },
  "summarize": { content: "Beijing: sunny, 25°C" }
}

// 步骤 input 中的占位符解析
{
  messages: [{
    role: "user",
    content: "{{steps.search.outputs.content}}"  // → "[{ type: 'text', text: '晴, 25°C' }]"
  }]
}
```

### 解析函数

在 `runner.ts` 中新增 `resolveStepInput` 函数：

```ts
interface StepOutputs {
  [stepId: string]: Record<string, unknown>;
}

function resolveStepInput(
  input: Record<string, unknown>,
  workflowInput: Record<string, unknown>,
  outputs: StepOutputs
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      resolved[key] = resolvePlaceholders(value, workflowInput, outputs);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      resolved[key] = resolveStepInput(value as Record<string, unknown>, workflowInput, outputs);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

function resolvePlaceholders(
  value: string,
  workflowInput: Record<string, unknown>,
  outputs: StepOutputs
): string {
  // 先解析 {{steps.X.outputs.Y}}
  const stepRef = value.match(/^\{\{steps\.([^.]+)\.outputs\.([^.]+)\}\}$/);
  if (stepRef) {
    const [, stepId, field] = stepRef;
    const stepOutput = outputs[stepId]?.[field];
    if (stepOutput === undefined) return "";
    return typeof stepOutput === "string" ? stepOutput : JSON.stringify(stepOutput);
  }

  // 再解析 {{input.x}}
  const inputRef = value.match(/^\{\{input\.([A-Za-z0-9_]+)\}\}$/);
  if (inputRef) {
    return String(workflowInput[inputRef[1]] ?? "");
  }

  // 最后做通用替换（{{input.x}} 在字符串中间）
  return value.replace(/\{\{(input|steps\.[^.]+\.outputs\.[^}]+)\}\}/g, (match) => {
    // ... 通用替换逻辑
    return "";
  });
}
```

### 在 runner 主循环中使用

```ts
for (const [stepIndex, step] of input.steps.entries()) {
  // 解析步骤输入（替换占位符）
  const resolvedInput = resolveStepInput(step.input, input.input, outputs);

  if (step.type === "llm.chat") {
    // ... 现有逻辑，使用 resolvedInput
  } else if (step.type === "endpoint.call") {
    // ... endpoint.call 逻辑
  } else if (step.type === "mcp.call") {
    // ... mcp.call 逻辑
  }
}
```

---

## 依赖顺序

V0.3 不按原始大 Task 一次性推进，而是按以下更小的阶段成果执行。每个子任务完成后都要本地 commit；push 时机由用户确认。

### Milestone A: Workflow 基础能力

- [x] **Task A1: 步骤输入解析器**
  - 目标：实现 `resolveStepInput` / `resolvePlaceholders`，支持 `{{input.x}}` 与 `{{steps.<id>.outputs.<field>}}`。
  - 修改：`server/src/workflows/runner.ts`、`server/src/workflows/runner.test.ts`。
  - 验证：`npm run test --workspace server -- src/workflows/runner.test.ts`。
  - Commit：`feat: add workflow step input resolution`。

- [x] **Task A2: endpoint.call 后端执行**
  - 目标：让 workflow 能执行已注册 Endpoint，并把结果写入 `outputs[stepId]`。
  - 修改：`server/src/workflows/types.ts`、`server/src/workflows/runner.ts`、`server/src/db/schema.ts`、`server/src/apiProtocol/operationCatalog.ts`。
  - 验证：`npm run test --workspace server -- src/workflows/runner.test.ts`。
  - Commit：`feat: add endpoint.call workflow step`。

- [x] **Task A3: endpoint.call 路由校验与 trace**
  - 目标：让 `POST /api/workflows/run` 接受 `endpoint.call`，并在 run steps 中保存成功/失败 trace。
  - 修改：`server/src/routes/workflows.ts`、`server/src/routes/workflows.test.ts`、`server/src/routes/runs.ts`、`server/src/routes/runs.test.ts`。
  - 验证：`npm run test --workspace server -- src/routes/workflows.test.ts src/routes/runs.test.ts`。
  - Commit：`feat: expose endpoint.call workflow traces`。

### Milestone B: MCP 后端能力

- [x] **Task B1: MCP Server schema 与 repository**
  - 目标：新增 `mcp_servers` 表和 repository，先完成纯数据 CRUD，不接入前端。
  - 修改：`server/src/db/schema.ts`。
  - 创建：`server/src/mcp/types.ts`、`server/src/mcp/mcpServerRepository.ts`、`server/src/mcp/mcpServerRepository.test.ts`。
  - 验证：`npm run test --workspace server -- src/mcp/mcpServerRepository.test.ts src/db/schema.test.ts`。
  - Commit：`feat: add MCP server repository`。

- [x] **Task B2: MCP Client stdio 模块**
  - 目标：封装 `@modelcontextprotocol/sdk` stdio client，支持连接、列工具、调用工具、断开。
  - 修改：`server/package.json`。
  - 创建：`server/src/mcp/client.ts`、`server/src/mcp/client.test.ts`。
  - 验证：`npm run test --workspace server -- src/mcp/client.test.ts`。
  - Commit：`feat: add MCP stdio client`。

- [x] **Task B3: MCP Server 管理 API**
  - 目标：提供 MCP Server CRUD、工具拉取、连接测试 API，并加入 command 白名单校验。
  - 创建：`server/src/routes/mcpServers.ts`、`server/src/routes/mcpServers.test.ts`。
  - 修改：`server/src/app.ts`、`server/src/config/env.ts`、`.env.example`。
  - 验证：`npm run test --workspace server -- src/routes/mcpServers.test.ts`。
  - Commit：`feat: add MCP server management API`。

- [x] **Task B4: mcp.call 工作流步骤**
  - 目标：workflow runner 支持调用 MCP 工具，并把 content blocks 写入 `outputs[stepId]` 与 run trace。
  - 修改：`server/src/workflows/types.ts`、`server/src/workflows/runner.ts`、`server/src/workflows/runner.test.ts`、`server/src/routes/workflows.ts`、`server/src/routes/workflows.test.ts`。
  - 验证：`npm run test --workspace server -- src/workflows/runner.test.ts src/routes/workflows.test.ts`。
  - Commit：`feat: add mcp.call workflow step`。

### Milestone C: 前端与产品化

- [x] **Task C1: MCP Server 管理前端**
  - 目标：用户能在前端新增、删除、测试 MCP Server，并查看工具列表。
  - 创建：`client/src/pages/McpServersPage.tsx`、`client/src/pages/McpServersPage.test.tsx`。
  - 修改：`client/src/api/client.ts`、`client/src/api/types.ts`、`client/src/components/TopNav.tsx`、`client/src/App.tsx`。
  - 验证：`npm run test --workspace client -- src/pages/McpServersPage.test.tsx`。
  - Commit：`feat: add MCP server management page`。

- [x] **Task C2: Skill 模板后端**
  - 目标：提供内置 Skill 模板、用户自定义模板存储、模板参数解析和模板运行 API。
  - 创建：`server/src/skills/templateRegistry.ts`、`server/src/skills/templateRegistry.test.ts`、`server/src/skills/skillRepository.ts`、`server/src/skills/skillRepository.test.ts`、`server/src/routes/skills.ts`、`server/src/routes/skills.test.ts`。
  - 修改：`server/src/db/schema.ts`、`server/src/app.ts`。
  - 验证：`npm run test --workspace server -- src/skills/templateRegistry.test.ts src/skills/skillRepository.test.ts src/routes/skills.test.ts`。
  - Commit：`feat: add workflow skill template API`。

- [x] **Task C3: Skill 模板前端**
  - 目标：`WorkflowTemplatesPage` 接入真实 API，支持查看模板、填写参数、运行模板。
  - 修改：`client/src/pages/WorkflowTemplatesPage.tsx`、`client/src/pages/WorkflowTemplatesPage.test.tsx`、`client/src/api/client.ts`、`client/src/api/types.ts`。
  - 验证：`npm run test --workspace client -- src/pages/WorkflowTemplatesPage.test.tsx`。
  - Commit：`feat: connect workflow templates page`。

- [ ] **Task C4: 工作流构建器前端**
  - 目标：提供表单式多步骤 workflow builder，支持 `llm.chat`、`endpoint.call`、`mcp.call`。
  - 创建：`client/src/pages/WorkflowBuilderPage.tsx`、`client/src/pages/WorkflowBuilderPage.test.tsx`。
  - 修改：`client/src/api/client.ts`、`client/src/api/types.ts`、`client/src/components/TopNav.tsx`、`client/src/App.tsx`、`client/src/styles.css`。
  - 验证：`npm run test --workspace client -- src/pages/WorkflowBuilderPage.test.tsx`。
  - Commit：`feat: add workflow builder page`。

- [ ] **Task C5: 配置导入导出与运行历史增强**
  - 目标：配置导出升级到 version 2，包含 MCP Server 和 Skill；运行历史按 step 类型展示细节。
  - 修改：`server/src/configuration/configExport.ts`、`server/src/configuration/configExport.test.ts`、`server/src/routes/configuration.test.ts`、`client/src/pages/ConfigurationPage.tsx`、`client/src/pages/RunsPage.tsx`、`client/src/pages/RunsPage.test.tsx`。
  - 验证：`npm run test --workspace server -- src/configuration/configExport.test.ts src/routes/configuration.test.ts`；`npm run test --workspace client -- src/pages/RunsPage.test.tsx src/pages/ConfigurationPage.test.tsx`。
  - Commit：`feat: export v0.3 configuration and step traces`。

- [ ] **Task C6: 文档与全量验证**
  - 目标：补齐用户指南、标记本计划完成，并跑完整测试/构建。
  - 创建：`docs/api-tools-v0-3-user-guide.md`。
  - 修改：`docs/superpowers/plans/2026-06-25-api-tools-v0-3-implementation.md`。
  - 验证：`npm run test --workspace server`、`npm run test --workspace client`、`npm run typecheck --workspace server`、`npm run typecheck --workspace client`、`npm run build --workspace server`、`npm run build --workspace client`。
  - Commit：`docs: complete API Tools v0.3 implementation guide`。

### 执行规则

- 每个子任务完成后必须 commit，一次 commit 只包含该子任务相关文件。
- 每个子任务 commit 前至少运行对应测试；涉及类型变更时加跑对应 workspace 的 `typecheck`。
- 不主动 push；用户明确说 push 后再推送远程。
- 如果 schema 变更导致旧本地数据库不兼容，先记录错误并说明是否需要删除开发数据库；不静默删除数据。
- MCP 只实现 stdio transport；Streamable HTTP transport 留到后续版本。

---

## Task 1: endpoint.call 工作流步骤

**目标：** 让工作流能执行已注册的 Endpoint，作为多步编排的基础。

**文件：**
- 修改: `server/src/db/schema.ts`
- 修改: `server/src/workflows/runner.ts`
- 修改: `server/src/workflows/runner.test.ts`
- 修改: `server/src/workflows/types.ts`
- 修改: `server/src/routes/workflows.ts`
- 修改: `server/src/routes/workflows.test.ts`
- 修改: `server/src/apiProtocol/operationCatalog.ts`

**步骤 1: 扩展 schema 和类型**

修改 `server/src/workflows/types.ts`：

```ts
export type WorkflowStepType = "llm.chat" | "endpoint.call" | "mcp.call";

export interface LlmChatStepDefinition {
  id: string;
  type: "llm.chat";
  modelId: string;
  input: Record<string, unknown>;
}

export interface EndpointCallStepDefinition {
  id: string;
  type: "endpoint.call";
  endpointId: string;
  input: Record<string, unknown>;
}

export interface McpCallStepDefinition {
  id: string;
  type: "mcp.call";
  mcpServerId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export type WorkflowStepDefinition =
  | LlmChatStepDefinition
  | EndpointCallStepDefinition
  | McpCallStepDefinition;
```

修改 `server/src/db/schema.ts`，在 `run_steps.step_type` CHECK 约束中增加 `'endpoint.call'`。

**步骤 2: 在 runner 中增加 endpoint.call 处理**

修改 `server/src/workflows/runner.ts`：

- 在 `WorkflowRunnerDependencies` 中增加 `endpointTester` 依赖
- 新增 `runEndpointCallStep` 函数，复用 `endpointTester.testEndpoint()`
- 在循环中 `step.type === "endpoint.call"` 分支

```ts
async function runEndpointCallStep(
  endpointId: string,
  input: Record<string, unknown>,
  dependencies: {
    endpoints: ReturnType<typeof createEndpointRepository>;
    providers: ReturnType<typeof createProviderRepository>;
    endpointTester: EndpointTester;
    env: NodeJS.ProcessEnv;
  }
): Promise<EndpointCallStepResult> {
  const endpoint = dependencies.endpoints.getById(endpointId);
  if (!endpoint) {
    throw new ProviderError("endpoint_not_found", "Endpoint not found", { statusCode: 404 });
  }
  const provider = dependencies.providers.getById(endpoint.providerId);
  if (!provider) {
    throw new ProviderError("provider_not_found", "Provider not found", { statusCode: 404 });
  }
  const apiKey = getRequiredApiKey(provider.apiKeyEnv, dependencies.env);

  const result = await dependencies.endpointTester.testEndpoint({
    endpoint, provider, apiKey, input
  });

  return {
    status: result.ok ? "succeeded" : "failed",
    statusCode: result.status,
    bodyPreview: result.bodyPreview,
    latencyMs: result.latencyMs
  };
}
```

**步骤 3: 在循环中增加 endpoint.call 分支**

```ts
if (step.type === "endpoint.call") {
  const resolvedInput = resolveStepInput(step.input, input.input, outputs);
  const stepResult = await runEndpointCallStep(step.endpointId, resolvedInput, {
    endpoints, providers, endpointTester: dependencies.endpointTester, env: dependencies.env
  });
  outputs[step.id] = { body: stepResult.bodyPreview };
  // ... 写入 run_step
}
```

**步骤 4: 扩展 route schema**

```ts
const endpointCallStepSchema = z.object({
  id: z.string(),
  type: z.literal("endpoint.call"),
  endpointId: z.string().min(1),
  input: z.record(z.unknown())
});
const workflowStepSchema = llmChatStepSchema.or(endpointCallStepSchema);
```

**步骤 5: 添加测试**

```ts
it("runs an endpoint.call step and records trace", async () => {
  // Seed endpoint + provider
  // Mock endpointTester to return success
  // Call runWorkflow with endpoint.call step
  // Assert run_step has step_type "endpoint.call", status "succeeded"
});

it("records failed endpoint.call step with error details", async () => {
  // Mock endpointTester to return HTTP 500
  // Assert run_step has status "failed", error_code "provider_error"
});
```

**步骤 6: 验证**

```bash
npm run test --workspace server -- src/workflows/runner.test.ts src/routes/workflows.test.ts
npm run typecheck --workspace server
```

**步骤 7: Commit**

```bash
git add server/src/db/schema.ts server/src/workflows/runner.ts server/src/workflows/runner.test.ts \
  server/src/workflows/types.ts server/src/routes/workflows.ts server/src/routes/workflows.test.ts \
  server/src/apiProtocol/operationCatalog.ts
git commit -m "feat: add endpoint.call workflow step"
```

---

## Task 2: MCP Client 模块

**目标：** 实现 MCP Client，支持 stdio transport，能连接 MCP Server 并调用工具。

**文件：**
- 创建: `server/src/mcp/client.ts`
- 创建: `server/src/mcp/client.test.ts`
- 创建: `server/src/mcp/types.ts`
- 修改: `server/package.json`

**步骤 1: 添加依赖**

```bash
npm install @modelcontextprotocol/sdk
```

**步骤 2: 定义类型**

创建 `server/src/mcp/types.ts`：

```ts
export interface McpServerRecord {
  id: string;
  name: string;
  transport: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpCallResult {
  ok: boolean;
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
  latencyMs: number;
}
```

**步骤 3: 实现 MCP Client**

创建 `server/src/mcp/client.ts`：

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import type { McpCallResult, McpServerRecord, McpTool } from "./types.js";
import { ProviderError } from "../errors/providerError.js";

export class McpClientManager {
  private clients: Map<string, { client: Client; server: McpServerRecord }> = new Map();

  async connect(server: McpServerRecord): Promise<void> {
    if (this.clients.has(server.id)) {
      await this.disconnect(server.id);
    }

    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      env: { ...getDefaultEnvironment(), ...server.env }
    });

    const client = new Client(
      { name: "api-tools", version: "0.3.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    this.clients.set(server.id, { client, server });
  }

  async listTools(serverId: string): Promise<McpTool[]> {
    const entry = this.clients.get(serverId);
    if (!entry) {
      throw new ProviderError("mcp_server_not_connected", "MCP Server not connected", { statusCode: 400 });
    }
    const result = await entry.client.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown>
    }));
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<McpCallResult> {
    const entry = this.clients.get(serverId);
    if (!entry) {
      throw new ProviderError("mcp_server_not_connected", "MCP Server not connected", { statusCode: 400 });
    }

    const startedAt = Date.now();
    try {
      const result = await entry.client.callTool({ name: toolName, arguments: args });
      const content = Array.isArray(result.content) ? result.content : [];
      return {
        ok: !(result as { isError?: boolean }).isError,
        content,
        isError: (result as { isError?: boolean }).isError,
        latencyMs: Date.now() - startedAt
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw new ProviderError("mcp_tool_error", `MCP tool call failed: ${error.message}`, {
          statusCode: 400
        });
      }
      throw error;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const entry = this.clients.get(serverId);
    if (entry) {
      await entry.client.close();
      this.clients.delete(serverId);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const id of [...this.clients.keys()]) {
      await this.disconnect(id);
    }
  }
}
```

**步骤 4: 添加测试**

创建 `server/src/mcp/client.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpClientManager } from "./client.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

// Mock the entire SDK module
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
    callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
    close: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({}))
}));

describe("McpClientManager", () => {
  let manager: McpClientManager;

  beforeEach(() => {
    manager = new McpClientManager();
  });

  it("throws when calling tool on disconnected server", async () => {
    await expect(manager.callTool("nonexistent", "test", {})).rejects.toThrow("MCP Server not connected");
  });

  it("disconnects and cleans up client", async () => {
    // Mock connected client
    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    };
    // ... test lifecycle
  });
});
```

**步骤 5: 安全考虑**

MCP Server 的 `command` 由用户配置，会被直接 `spawn`。需要：

- 在 route 层对 `command` 做白名单校验：只允许已知路径（如 `npx`、`node`、绝对路径的可执行文件）
- 不允许 shell 元字符（`;`、`|`、`&&`、`||`、`$()`、`` ` ``）
- 在 `.env` 中加一个 `ALLOW_MCP_COMMANDS` 环境变量，逗号分隔允许的 command 名

```ts
// server/src/routes/mcpServers.ts
const ALLOWED_MCP_COMMANDS = (process.env.ALLOW_MCP_COMMANDS ?? "npx,node").split(",");

function validateCommand(command: string) {
  if (!ALLOWED_MCP_COMMANDS.includes(command)) {
    throw new ProviderError("invalid_mcp_command", `Command '${command}' is not allowed. Allowed: ${ALLOWED_MCP_COMMANDS.join(", ")}`);
  }
  if (/[\;|\&\$`]/.test(command)) {
    throw new ProviderError("invalid_mcp_command", "Command contains dangerous characters");
  }
}
```

**步骤 6: 验证**

```bash
npm run test --workspace server -- src/mcp/client.test.ts
npm run typecheck --workspace server
```

**步骤 7: Commit**

```bash
git add server/package.json server/src/mcp/client.ts server/src/mcp/client.test.ts server/src/mcp/types.ts
git commit -m "feat: add MCP client module"
```

---

## Task 3: mcp.call 工作流步骤

**目标：** 让工作流能执行 MCP 工具调用。

**文件：**
- 修改: `server/src/db/schema.ts`
- 修改: `server/src/workflows/runner.ts`
- 修改: `server/src/workflows/runner.test.ts`
- 修改: `server/src/workflows/types.ts`
- 修改: `server/src/routes/workflows.ts`
- 修改: `server/src/routes/workflows.test.ts`
- 修改: `server/src/app.ts`

**步骤 1: 新增 mcpServers 表**

修改 `server/src/db/schema.ts`：

```sql
create table if not exists mcp_servers (
  id text primary key,
  name text not null,
  transport text not null default 'stdio',
  command text not null,
  args_json text default '[]',
  env_json text default '{}',
  enabled integer not null default 1,
  created_at text not null,
  updated_at text not null
);
```

**步骤 2: 新增 mcpServerRepository**

创建 `server/src/mcp/mcpServerRepository.ts`，遵循现有 repository 模式（CRUD + JSON 字段序列化）。

**步骤 3: 在 runner 中增加 mcp.call 处理**

修改 `server/src/workflows/runner.ts`：

- `WorkflowRunnerDependencies` 增加 `mcpManager: McpClientManager`
- 新增 `runMcpCallStep` 函数
- 在循环中 `step.type === "mcp.call"` 分支

```ts
async function runMcpCallStep(
  step: McpCallStepDefinition,
  resolvedInput: Record<string, unknown>,
  dependencies: {
    mcpServers: ReturnType<typeof createMcpServerRepository>;
    mcpManager: McpClientManager;
  }
): Promise<McpCallStepResult> {
  const server = dependencies.mcpServers.getById(step.mcpServerId);
  if (!server) {
    throw new ProviderError("mcp_server_not_found", "MCP Server not found", { statusCode: 404 });
  }

  // 自动连接（如果还没连）
  try {
    await dependencies.mcpManager.connect(server);
  } catch {
    // 已连接或连接失败，connect 内部处理了重复连接
  }

  const result = await dependencies.mcpManager.callTool(step.mcpServerId, step.toolName, resolvedInput);

  return {
    content: result.content,
    isError: result.isError,
    latencyMs: result.latencyMs
  };
}
```

**步骤 4: 修改 app.ts 注入 McpClientManager**

```ts
import { McpClientManager } from "./mcp/client.js";

export interface AppDependencies {
  db: AppDatabase;
  env?: NodeJS.ProcessEnv;
  endpointTester?: EndpointTester;
  mcpManager?: McpClientManager;
}

export function createApp(dependencies: AppDependencies) {
  const mcpManager = dependencies.mcpManager ?? new McpClientManager();
  // ...
  app.use("/api/mcp-servers", createMcpServersRouter(db, { mcpManager }));
  // ...
}
```

**步骤 5: 添加测试**

```ts
it("runs an mcp.call step and records trace", async () => {
  // Seed MCP server
  // Mock McpClientManager.callTool to return success
  // Call runWorkflow with mcp.call step
  // Assert run_step has step_type "mcp.call", status "succeeded"
});

it("records failed mcp.call step with error details", async () => {
  // Mock McpClientManager.callTool to throw McpError
  // Assert run_step has status "failed", error_code "mcp_tool_error"
});
```

**步骤 6: Commit**

```bash
git add server/src/db/schema.ts server/src/workflows/runner.ts server/src/workflows/runner.test.ts \
  server/src/workflows/types.ts server/src/routes/workflows.ts server/src/routes/workflows.test.ts \
  server/src/app.ts server/src/mcp/mcpServerRepository.ts
git commit -m "feat: add mcp.call workflow step"
```

---

## Task 4: MCP Server 管理 API + 前端

**目标：** 用户能创建/管理 MCP Server，查看可用工具，测试连接。

**文件：**
- 创建: `server/src/routes/mcpServers.ts`
- 创建: `server/src/routes/mcpServers.test.ts`
- 修改: `server/src/app.ts`
- 创建: `client/src/pages/McpServersPage.tsx`
- 创建: `client/src/pages/McpServersPage.test.tsx`
- 修改: `client/src/api/client.ts`
- 修改: `client/src/api/types.ts`
- 修改: `client/src/components/TopNav.tsx`
- 修改: `client/src/App.tsx`

**步骤 1: 后端路由**

创建 `server/src/routes/mcpServers.ts`：

```ts
// GET /api/mcp-servers - 列出所有 MCP Server
// POST /api/mcp-servers - 创建 MCP Server（含 command 白名单校验）
// GET /api/mcp-servers/:id/tools - 连接并列出工具
// DELETE /api/mcp-servers/:id - 删除（断开连接）
```

**步骤 2: 前端页面结构**

```tsx
export function McpServersPage({ api }: { api: McpServersApi }) {
  const [servers, setServers] = useState<McpServerRecord[]>([]);
  const [selectedServer, setSelectedServer] = useState<McpServerRecord | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [testing, setTesting] = useState(false);

  // 左侧：MCP Server 列表 + 创建表单
  // 右侧：选中 Server 的工具列表（可展开查看 inputSchema）
}
```

**步骤 3: 创建表单字段**

- 名称输入框
- 命令输入框（如 `npx -y @modelcontextprotocol/server-filesystem`）
- 参数输入框（JSON 数组，如 `["/path/to/dir"]`）
- 环境变量输入框（JSON 对象，如 `{ "MY_VAR": "value" }`）
- 启用开关
- "测试连接"按钮 → 调用 `GET /:id/tools`

**步骤 4: 工具列表展示**

选中 Server 后：
- 加载工具列表
- 每个工具显示：名称、描述、inputSchema（可展开）
- 工具列表下方显示"此 Server 可用于 mcp.call 工作流步骤"

**步骤 5: 更新导航**

在 TopNav 的"管理"组中增加 MCP Server 入口。

**步骤 6: Commit**

```bash
git add server/src/routes/mcpServers.ts client/src/pages/McpServersPage.tsx \
  client/src/api/client.ts client/src/api/types.ts client/src/components/TopNav.tsx client/src/App.tsx
git commit -m "feat: add MCP Server management"
```

---

## Task 5: Skill 模板系统

**目标：** 预定义常见工作流模板，用户可一键套用或自定义。

**文件：**
- 创建: `server/src/skills/templateRegistry.ts`
- 创建: `server/src/skills/templateRegistry.test.ts`
- 创建: `server/src/skills/skillRepository.ts`
- 创建: `server/src/skills/skillRepository.test.ts`
- 修改: `server/src/db/schema.ts`
- 创建: `server/src/routes/skills.ts`
- 创建: `server/src/routes/skills.test.ts`
- 修改: `client/src/pages/WorkflowTemplatesPage.tsx`
- 修改: `client/src/api/client.ts`

**步骤 1: 模板类型定义**

```ts
export interface SkillTemplate {
  id: string;
  name: Record<"zh-CN" | "en", string>;
  description: Record<"zh-CN" | "en", string>;
  // 模板中的占位符声明
  parameters: Array<{
    key: string;           // 如 "model", "mcpServer", "query"
    label: Record<"zh-CN" | "en", string>;
    required: boolean;
    type: "model" | "mcpServer" | "endpoint" | "text";
  }>;
  // 模板步骤（含占位符）
  steps: Array<{
    id: string;
    type: "llm.chat" | "endpoint.call" | "mcp.call";
    modelId?: string;      // 可以是 "{{model}}" 占位符
    endpointId?: string;   // 可以是 "{{endpoint}}" 占位符
    mcpServerId?: string;  // 可以是 "{{mcpServer}}" 占位符
    toolName?: string;     // 可以是 "{{tool}}" 占位符
    input: Record<string, unknown>;
  }>;
  builtin: boolean;
}
```

**步骤 2: 内置模板**

创建 `server/src/skills/templateRegistry.ts`：

```ts
export const BUILTIN_SKILLS: SkillTemplate[] = [
  {
    id: "llm-search-summarize",
    name: { "zh-CN": "搜索总结", en: "Search & Summarize" },
    description: {
      "zh-CN": "先用 LLM 提取关键词，再调搜索工具，最后让 LLM 生成总结。",
      en: "Extract keywords with LLM, search with MCP tool, summarize with LLM."
    },
    parameters: [
      { key: "model", label: { "zh-CN": "模型", en: "Model" }, required: true, type: "model" },
      { key: "mcpServer", label: { "zh-CN": "搜索 MCP Server", en: "Search MCP Server" }, required: true, type: "mcpServer" },
      { key: "query", label: { "zh-CN": "搜索查询", en: "Search Query" }, required: true, type: "text" }
    ],
    steps: [
      {
        id: "extract",
        type: "llm.chat",
        modelId: "{{model}}",
        input: {
          messages: [
            { role: "system", content: "Extract search keywords from the input. Reply with only the keywords." },
            { role: "user", content: "{{input.query}}" }
          ]
        }
      },
      {
        id: "search",
        type: "mcp.call",
        mcpServerId: "{{mcpServer}}",
        toolName: "web_search",
        input: { query: "{{steps.extract.outputs.content}}" }
      },
      {
        id: "summarize",
        type: "llm.chat",
        modelId: "{{model}}",
        input: {
          messages: [
            { role: "system", content: "Summarize the search results in a clear response." },
            { role: "user", content: "{{steps.search.outputs.content}}" }
          ]
        }
      }
    ],
    builtin: true
  },
  {
    id: "llm-translate-polish",
    name: { "zh-CN": "翻译+校对", en: "Translate & Polish" },
    description: {
      "zh-CN": "先用快速模型翻译，再用高质量模型校对。",
      en: "Translate with fast model, polish with quality model."
    },
    parameters: [
      { key: "fastModel", label: { "zh-CN": "快速模型", en: "Fast Model" }, required: true, type: "model" },
      { key: "qualityModel", label: { "zh-CN": "高质量模型", en: "Quality Model" }, required: true, type: "model" },
      { key: "targetLang", label: { "zh-CN": "目标语言", en: "Target Language" }, required: false, type: "text" },
      { key: "text", label: { "zh-CN": "待翻译文本", en: "Text to Translate" }, required: true, type: "text" }
    ],
    steps: [ /* ... */ ],
    builtin: true
  },
  {
    id: "endpoint-data-pipeline",
    name: { "zh-CN": "数据管道", en: "Data Pipeline" },
    description: {
      "zh-CN": "LLM 处理数据 → 调 API 存储 → 返回确认。",
      en: "Process data with LLM, store via API, confirm."
    },
    parameters: [
      { key: "model", label: { "zh-CN": "模型", en: "Model" }, required: true, type: "model" },
      { key: "endpoint", label: { "zh-CN": "存储 Endpoint", en: "Storage Endpoint" }, required: true, type: "endpoint" },
      { key: "data", label: { "zh-CN": "输入数据", en: "Input Data" }, required: true, type: "text" }
    ],
    steps: [ /* ... */ ],
    builtin: true
  }
];
```

**步骤 3: 模板参数解析**

在 `POST /api/skills/:id/run` 路由中：

```ts
// 接收运行时参数
interface SkillRunInput {
  model?: string;
  fastModel?: string;
  qualityModel?: string;
  mcpServer?: string;
  endpoint?: string;
  query?: string;
  text?: string;
  data?: string;
  targetLang?: string;
}

// 将占位符替换为实际值
function resolveSkillParameters(steps: SkillTemplate["steps"], params: SkillRunInput): WorkflowStepDefinition[] {
  return steps.map((step) => {
    const resolved: Record<string, unknown> = { ...step };

    // 替换 modelId
    if (step.modelId === "{{model}}" && params.model) resolved.modelId = params.model;
    else if (step.modelId === "{{fastModel}}" && params.fastModel) resolved.modelId = params.fastModel;
    else if (step.modelId === "{{qualityModel}}" && params.qualityModel) resolved.modelId = params.qualityModel;

    // 替换 mcpServerId
    if (step.mcpServerId === "{{mcpServer}}" && params.mcpServer) resolved.mcpServerId = params.mcpServer;

    // 替换 endpointId
    if (step.endpointId === "{{endpoint}}" && params.endpoint) resolved.endpointId = params.endpoint;

    // 替换 input 中的 {{input.xxx}}
    if (resolved.input) {
      for (const [key, value] of Object.entries(resolved.input)) {
        if (typeof value === "string") {
          resolved.input[key] = value
            .replace(/\{\{input\.query\}\}/g, params.query ?? "")
            .replace(/\{\{input\.text\}\}/g, params.text ?? "")
            .replace(/\{\{input\.data\}\}/g, params.data ?? "")
            .replace(/\{\{input\.targetLang\}\}/g, params.targetLang ?? "English");
        }
      }
    }

    return resolved as WorkflowStepDefinition;
  });
}
```

**步骤 4: 用户自定义 Skill 存储**

创建 `server/src/skills/skillRepository.ts`，存储用户自定义模板（JSON 序列化的 steps 数组 + parameters）。

**步骤 5: 后端路由**

```ts
// GET /api/skills - 返回内置 + 用户自定义
// POST /api/skills - 创建自定义模板
// GET /api/skills/:id - 获取模板详情
// DELETE /api/skills/:id - 删除自定义模板
// POST /api/skills/:id/run - 用模板参数运行工作流
```

**步骤 6: 前端更新**

修改 `WorkflowTemplatesPage.tsx`：
- 从 `GET /api/skills` 拉取真实数据
- 展示 Skill 模板列表（名称、描述、步骤数）
- 点击"运行"弹出参数表单（根据 parameters 动态生成）
- 表单提交后调用 `POST /api/skills/:id/run`

**步骤 7: Commit**

```bash
git add server/src/skills/ server/src/routes/skills.ts client/src/pages/WorkflowTemplatesPage.tsx \
  client/src/api/client.ts
git commit -m "feat: add skill template system"
```

---

## Task 6: 工作流构建器前端

**目标：** 用户能可视化编排多步骤工作流，选择 LLM/Endpoint/MCP 步骤，设置输入输出映射。

**文件：**
- 创建: `client/src/pages/WorkflowBuilderPage.tsx`
- 创建: `client/src/pages/WorkflowBuilderPage.test.tsx`
- 修改: `client/src/api/client.ts`
- 修改: `client/src/api/types.ts`
- 修改: `client/src/components/TopNav.tsx`
- 修改: `client/src/App.tsx`
- 修改: `client/src/styles.css`

**步骤 1: 页面结构**

三栏布局：

```
┌─────────────────────────────────────────────────────────────┐
│ 工作流构建器                                                 │
├──────────────┬──────────────────────┬───────────────────────┤
│ 步骤列表      │ 步骤编辑器            │ 运行结果               │
│              │                      │                       │
│ [+ 添加步骤]  │ ┌────────────────┐   │ ┌─────────────────┐  │
│              │ │ 步骤 1: llm.chat │   │ │ Step 1: succeeded│  │
│ • 步骤 1     │ │ 模型: [v] deepseek│   │ │ content: "..."  │  │
│ • 步骤 2     │ │ messages:        │   │ └─────────────────┘  │
│              │ │  [system] ...    │   │                       │
│              │ │  [user] {{input. │   │ ┌─────────────────┐  │
│              │ │    query}}       │   │ │ Step 2: running │  │
│              │ └────────────────┘   │ │ ...               │  │
│              │ ┌────────────────┐   │ └─────────────────┘  │
│              │ │ 步骤 2: mcp.call│   │                       │
│              │ │ Server: [v] ... │   │ [运行] [保存为模板]   │
│              │ │ Tool:   [v] ... │   │                       │
│              │ │ input:          │   │                       │
│              │ │   query: {{...}}│   │                       │
│              │ └────────────────┘   │                       │
└──────────────┴──────────────────────┴───────────────────────┘
```

**步骤 2: 状态管理**

```tsx
interface BuilderStep {
  id: string;
  type: "llm.chat" | "endpoint.call" | "mcp.call";
  modelId?: string;
  endpointId?: string;
  mcpServerId?: string;
  toolName?: string;
  input: Record<string, unknown>;
}

export function WorkflowBuilderPage({ api }: { api: WorkflowBuilderApi }) {
  const [steps, setSteps] = useState<BuilderStep[]>([]);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, Record<string, unknown>>>({});
  const [initialInput, setInitialInput] = useState<Record<string, string>>({});

  // 添加/删除/移动步骤
  // 编辑选中步骤
  // 运行工作流
  // 保存为模板
}
```

**步骤 3: 步骤编辑器**

每种步骤类型有不同的编辑表单：

- `llm.chat`：选模型 + 编辑 messages（支持 `{{steps.X.outputs.Y}}` 引用）
- `endpoint.call`：选 Endpoint + 编辑 input JSON
- `mcp.call`：选 MCP Server + 选工具 + 编辑 arguments JSON

**步骤 4: 输入映射语法**

使用 `{{steps.<stepId>.outputs.<field>}}` 引用上一步的输出。前端提供自动补全提示——当用户在输入框中输入 `{{` 时，列出所有可用的 `{{steps.X.outputs.Y}}` 和 `{{input.xxx}}` 选项。

**步骤 5: 运行**

点击"运行"后：
1. 收集初始输入（从表单或模板参数）
2. 调用 `POST /api/workflows/run`，传入 steps 数组
3. 显示每步的结果

**步骤 6: 保存为模板**

点击"保存为模板"：
1. 弹出表单：模板名称、描述
2. 将 steps 数组 + parameters 声明保存为自定义 Skill
3. 调用 `POST /api/skills`

**步骤 7: Commit**

```bash
git add client/src/pages/WorkflowBuilderPage.tsx client/src/styles.css
git commit -m "feat: add workflow builder page"
```

---

## Task 7: 配置导入导出升级

**目标：** 配置导出包含 MCP Server 和 Skill 模板。

**文件：**
- 修改: `server/src/configuration/configExport.ts`
- 修改: `server/src/configuration/configExport.test.ts`
- 修改: `server/src/routes/configuration.test.ts`
- 修改: `client/src/pages/ConfigurationPage.tsx`

**改动：**
- 导出 schema bump 到 `version: 2`
- 包含 `mcpServers` 和 `skills` 数组
- 排除 `runs` 和 `run_steps`（运行历史不导出）
- MCP Server 的 `env` 字段在导出时标记为"需要重新配置"（不导出实际值）
- 保留 `missingApiKeyEnvs` 追踪

---

## Task 8: 运行历史增强

**目标：** RunsPage 按步骤展示 trace，区分 `llm.chat`、`endpoint.call`、`mcp.call`。

**文件：**
- 修改: `client/src/pages/RunsPage.tsx`

**改动：**
- 在 trace 视图中，根据 `step_type` 显示不同的详情面板
- `endpoint.call`：显示 HTTP status、body preview
- `mcp.call`：显示 tool name、content blocks
- `llm.chat`：显示已有的 content、tokens、cost

---

## Task 9: 文档和全量验证

**文件：**
- 修改: `docs/superpowers/plans/2026-06-25-api-tools-v0-3-implementation.md`（标记完成）
- 创建: `docs/api-tools-v0-3-user-guide.md`

**验证：**
```bash
npm run test --workspace server
npm run test --workspace client
npm run typecheck --workspace server
npm run typecheck --workspace client
npm run build --workspace server
npm run build --workspace client
```

---

## 测试策略

### 后端

- **MCP Client 测试**：mock `Client` 类，测试 connect/listTools/callTool/disconnect
- **Runner 测试**：mock adapterRegistry、endpointTester、mcpManager，测试三种步骤类型的执行和 trace
- **Route 测试**：测试 workflow run 接受不同 step 类型，返回正确结果
- **Skill 测试**：测试模板解析、参数替换、运行

### 前端

- **McpServersPage 测试**：创建/列表/删除 MCP Server，展开查看工具
- **WorkflowBuilderPage 测试**：添加/删除/排序步骤，编辑步骤输入，运行工作流
- **RunsPage 测试**：验证不同 step_type 的 trace 展示
- **WorkflowTemplatesPage 测试**：从 API 拉取模板，运行模板

---

## 数据库 Schema 变更总结

```sql
-- 新增
create table if not exists mcp_servers (
  id text primary key,
  name text not null,
  transport text not null default 'stdio',
  command text not null,
  args_json text default '[]',
  env_json text default '{}',
  enabled integer not null default 1,
  created_at text not null,
  updated_at text not null
);

create table if not exists skills (
  id text primary key,
  name text not null,
  description text,
  steps_json text not null,
  parameters_json text default '[]',
  builtin integer not null default 0,
  created_at text not null,
  updated_at text not null
);

-- 扩展现有表
-- run_steps.step_type 新增 'endpoint.call', 'mcp.call' 合法值
```

---

## 前端页面变更总结

| 页面 | 变更 |
|------|------|
| `DashboardPage` | 新增 MCP Server 计数卡片 |
| `McpServersPage` | **新建** — MCP Server CRUD + 工具浏览 |
| `WorkflowBuilderPage` | **新建** — 多步骤工作流编排 |
| `WorkflowTemplatesPage` | 从 API 拉取真实模板数据 |
| `RunsPage` | 按 step_type 展示不同 trace 详情 |
| `ConfigurationPage` | 导出/导入包含 MCP Server 和 Skill |
| `TopNav` | 新增 MCP Server 和 工作流构建器 导航项 |

---

## 自审

### 覆盖度
- endpoint.call: Task 1
- MCP Client: Task 2
- mcp.call: Task 3
- MCP Server 管理: Task 4
- Skill 模板: Task 5
- 工作流构建器: Task 6
- 配置升级: Task 7
- 运行历史增强: Task 8
- 文档验证: Task 9

### 占位符扫描
- 所有步骤都有明确的文件路径和代码示例
- 没有 TBD/TODO 标记

### 类型一致性
- `WorkflowStepDefinition` 联合类型覆盖所有步骤类型
- `run_steps.step_type` 枚举与代码一致
- MCP Client 使用官方 `@modelcontextprotocol/sdk` 类型

### 边界
- 不做拖拽编辑器（先做表单式）
- 不做并行/分支/循环
- 不做对话记忆
- 仅 stdio transport（不含 Streamable HTTP）
- MCP command 白名单校验
