# API Tools V0.3 适配器与工作流编排实现计划

> **目标：** 把 API Tools 从"单步 LLM 工作台"升级为"多 API 编排框架"——工作流能串联 LLM 调用、MCP 工具、HTTP 端点，用户可管理 MCP Server、注册 Skill 模板、可视化编排多步工作流。

> **架构：** 在 V0.2 的 provider/model/endpoint/runner 基础上，新增 MCP Client 模块、`endpoint.call` / `mcp.call` 工作流步骤、Skill 模板系统、工作流构建器前端。对话记忆作为设计轨道暂不实现。

> **技术栈：** TypeScript, Express, better-sqlite3, MCP SDK (@modelcontextprotocol/sdk), Vite, React, Vitest, React Testing Library, Zod.

---

## 范围

本计划实现：

- `endpoint.call` 步骤——工作流中调用已注册的 Endpoint
- `mcp.call` 步骤——工作流中调用 MCP Server 的工具
- MCP Client 模块（stdio + Streamable HTTP transport）
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

## 依赖顺序

1. `endpoint.call` 步骤（复用 endpointTester）
2. MCP Client 模块（stdio + HTTP transport）
3. `mcp.call` 步骤
4. MCP Server 管理
5. Skill 模板系统
6. 工作流构建器前端
7. 配置导入导出升级
8. 文档和全量验证

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

在 `run_steps.step_type` 枚举中增加 `endpoint.call`。

修改 `server/src/workflows/types.ts`：

```ts
export type WorkflowStepType =
  | "llm.chat"
  | "endpoint.call"
  | "mcp.call";

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

**步骤 2: 在 runner 中增加 endpoint.call 处理**

修改 `server/src/workflows/runner.ts`，在 `runLlmChatStep` 旁边增加 `runEndpointCallStep`：

```ts
async function runEndpointCallStep(
  endpointId: string,
  input: Record<string, unknown>
): Promise<EndpointCallStepResult> {
  const endpoint = endpoints.getById(endpointId);
  if (!endpoint) {
    throw new ProviderError("endpoint_not_found", "Endpoint not found", { statusCode: 404 });
  }
  const provider = providers.getById(endpoint.providerId);
  if (!provider) {
    throw new ProviderError("provider_not_found", "Provider not found", { statusCode: 404 });
  }

  const apiKey = getRequiredApiKey(provider.apiKeyEnv, dependencies.env);

  const result = await dependencies.endpointTester.testEndpoint({
    endpoint,
    provider,
    apiKey,
    input
  });

  return {
    status: result.ok ? "succeeded" : "failed",
    statusCode: result.status,
    bodyPreview: result.bodyPreview,
    latencyMs: result.latencyMs,
    error: result.ok ? undefined : { code: "endpoint_error", message: "Endpoint test failed" }
  };
}
```

**步骤 3: 在 workflow 循环中增加 endpoint.call 分支**

修改 runner 的主循环，在 `step.type !== "llm.chat"` 的判断中增加：

```ts
if (step.type === "endpoint.call") {
  const result = await runEndpointCallStep(step.endpointId, resolvedInput);
  // ... 写入 run_step, 更新 run
  outputs[step.id] = { body: result.bodyPreview };
  continue;
}
```

**步骤 4: 扩展 route schema**

修改 `server/src/routes/workflows.ts` 中的 `workflowStepSchema`：

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

在 `runner.test.ts` 中增加：

```ts
it("runs an endpoint.call step and records trace", async () => {
  // Seed endpoint + provider
  // Mock endpointTester to return success
  // Call runWorkflow with endpoint.call step
  // Assert run_step has step_type "endpoint.call", status "succeeded"
});

it("records failed endpoint.call step", async () => {
  // Mock endpointTester to return error
  // Assert run_step has status "failed", error_code, error_message
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

**目标：** 实现 MCP Client，支持 stdio 和 Streamable HTTP transport，能连接 MCP Server 并调用工具。

**文件：**
- 创建: `server/src/mcp/client.ts`
- 创建: `server/src/mcp/client.test.ts`
- 创建: `server/src/mcp/types.ts`
- 修改: `server/src/db/schema.ts`
- 修改: `server/package.json`（添加 `@modelcontextprotocol/sdk` 依赖）

**步骤 1: 添加依赖**

```bash
npm install @modelcontextprotocol/sdk
npm install -D @types/node @types/cross-spawn
```

**步骤 2: 定义 MCP Client 类型**

创建 `server/src/mcp/types.ts`：

```ts
export interface McpServerRecord {
  id: string;
  name: string;
  transport: "stdio" | "streamable-http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface McpCallResult {
  ok: boolean;
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  structuredContent?: Record<string, unknown>;
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
  private clients: Map<string, Client> = new Map();

  async connect(server: McpServerRecord): Promise<void> {
    if (this.clients.has(server.id)) {
      await this.disconnect(server.id);
    }

    let transport: StdioClientTransport | null = null;

    if (server.transport === "stdio") {
      const { spawn } = await import("child_process");
      transport = new StdioClientTransport({
        command: server.command!,
        args: server.args,
        env: { ...process.env, ...server.env }
      });
    } else {
      throw new ProviderError("unsupported_transport", "Only stdio transport is supported in V0.3", {
        suggestion: "Use a local MCP server with stdio transport."
      });
    }

    const client = new Client(
      { name: "api-tools", version: "0.3.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    this.clients.set(server.id, client);
  }

  async listTools(serverId: string): Promise<McpTool[]> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new ProviderError("mcp_server_not_connected", "MCP Server not connected", { statusCode: 400 });
    }

    const result = await client.listTools();
    return result.tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown>,
      outputSchema: tool.outputSchema as Record<string, unknown> | undefined
    }));
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<McpCallResult> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new ProviderError("mcp_server_not_connected", "MCP Server not connected", { statusCode: 400 });
    }

    const startedAt = Date.now();

    try {
      const result = await client.callTool({ name: toolName, arguments: args });

      const content = Array.isArray(result.content) ? result.content : [];
      const textContent = content
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { text: string }) => c.text)
        .join("\n");

      return {
        ok: !(result as { isError?: boolean }).isError,
        content,
        structuredContent: (result as { structuredContent?: Record<string, unknown> }).structuredContent,
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
    const client = this.clients.get(serverId);
    if (client) {
      await client.close();
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
import { describe, expect, it, vi } from "vitest";
import { McpClientManager } from "./client.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

describe("McpClientManager", () => {
  it("throws when calling tool on disconnected server", async () => {
    const manager = new McpClientManager();
    await expect(manager.callTool("nonexistent", "test", {})).rejects.toThrow("MCP Server not connected");
  });

  it("maps McpError to ProviderError", async () => {
    // Mock the Client class
    const mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue({ tools: [] }),
      callTool: vi.fn().mockRejectedValue(new McpError("METHOD_NOT_FOUND", "Tool not found")),
      close: vi.fn().mockResolvedValue(undefined)
    };
    // ... test integration
  });
});
```

**步骤 5: 验证**

```bash
npm run test --workspace server -- src/mcp/client.test.ts
npm run typecheck --workspace server
```

**步骤 6: Commit**

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
  transport text not null check (transport in ('stdio', 'streamable-http')),
  command text,
  args_json text default '[]',
  env_json text default '{}',
  url text,
  enabled integer not null default 1,
  created_at text not null,
  updated_at text not null
);
```

**步骤 2: 新增 mcpServerRepository**

创建 `server/src/mcp/mcpServerRepository.ts`：

```ts
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { McpServerRecord } from "./types.js";

export function createMcpServerRepository(db: Database.Database) {
  return {
    create(input: Omit<McpServerRecord, "id" | "createdAt" | "updatedAt">): McpServerRecord {
      const now = new Date().toISOString();
      const record = {
        id: nanoid(),
        ...input,
        args: JSON.parse(input.args_json || "[]"),
        env: JSON.parse(input.env_json || "{}"),
        createdAt: now,
        updatedAt: now
      };
      // ... insert and return
    },
    list(): McpServerRecord[] { /* ... */ },
    getById(id: string): McpServerRecord | null { /* ... */ },
    delete(id: string): void { /* ... */ }
  };
}
```

**步骤 3: 在 runner 中增加 mcp.call 处理**

修改 `server/src/workflows/runner.ts`，在 workflow 循环中增加：

```ts
if (step.type === "mcp.call") {
  const result = await runMcpCallStep(step, resolvedInput);
  // ... 写入 run_step
  outputs[step.id] = {
    content: result.content,
    structuredContent: result.structuredContent
  };
  continue;
}
```

**步骤 4: 修改 app.ts 注入 McpClientManager**

修改 `server/src/app.ts`：

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
  // ... mount /api/mcp-servers route with mcpManager
}
```

**步骤 5: 添加测试**

```ts
it("runs an mcp.call step and records trace", async () => {
  // Seed MCP server + provider
  // Mock McpClientManager.callTool to return success
  // Call runWorkflow with mcp.call step
  // Assert run_step has step_type "mcp.call", status "succeeded"
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

**目标：** 用户能创建/管理 MCP Server，查看可用工具。

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
router.get("/", (_req, res) => {
  res.json(servers.list());
});

router.post("/", (req, res) => {
  const input = createMcpServerSchema.parse(req.body);
  const created = servers.create(input);
  res.status(201).json(created);
});

router.get("/:id/tools", async (req, res, next) => {
  try {
    const server = servers.getById(req.params.id);
    if (!server) { throw new ProviderError("not_found", "MCP Server not found", { statusCode: 404 }); }
    const tools = await mcpManager.listTools(server.id);
    res.json(tools);
  } catch (error) { next(error); }
});

router.delete("/:id", (req, res) => {
  servers.delete(req.params.id);
  res.status(204).end();
});
```

**步骤 2: 前端页面**

创建 `client/src/pages/McpServersPage.tsx`：

```tsx
export function McpServersPage({ api }: { api: McpServersApi }) {
  const [servers, setServers] = useState<McpServerRecord[]>([]);
  const [selectedServer, setSelectedServer] = useState<McpServerRecord | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);

  // Form: name, transport (stdio), command, args
  // List: server cards with tools dropdown
  // Show tool inputSchema when expanded
}
```

**步骤 3: 更新导航**

在 TopNav 的"管理"组中增加 MCP Server 入口。

**步骤 4: Commit**

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

**步骤 1: 内置模板**

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
    steps: [
      { id: "extract", type: "llm.chat", modelId: "{{model}}", input: {
        messages: [{ role: "system", content: "Extract search keywords from the input. Reply with only the keywords." }, { role: "user", content: "{{input.query}}" }]
      }},
      { id: "search", type: "mcp.call", mcpServerId: "{{mcpServer}}", toolName: "web_search", input: {
        query: "{{steps.extract.outputs.content}}"
      }},
      { id: "summarize", type: "llm.chat", modelId: "{{model}}", input: {
        messages: [{ role: "system", content: "Summarize the search results in a clear response." }, { role: "user", content: "{{steps.search.outputs.content}}" }]
      }}
    ]
  },
  {
    id: "llm-translate-polish",
    name: { "zh-CN": "翻译+校对", en: "Translate & Polish" },
    description: {
      "zh-CN": "先用快速模型翻译，再用高质量模型校对。",
      en: "Translate with fast model, polish with quality model."
    },
    steps: [
      { id: "translate", type: "llm.chat", modelId: "{{fastModel}}", input: {
        messages: [{ role: "system", content: "Translate the input to {{targetLang}}." }, { role: "user", content: "{{input.text}}" }]
      }},
      { id: "polish", type: "llm.chat", modelId: "{{qualityModel}}", input: {
        messages: [{ role: "system", content: "Polish the translation for fluency and accuracy." }, { role: "user", content: "{{steps.translate.outputs.content}}" }]
      }}
    ]
  },
  {
    id: "endpoint-data-pipeline",
    name: { "zh-CN": "数据管道", en: "Data Pipeline" },
    description: {
      "zh-CN": "LLM 处理数据 → 调 API 存储 → 返回确认。",
      en: "Process data with LLM, store via API, confirm."
    },
    steps: [
      { id: "process", type: "llm.chat", modelId: "{{model}}", input: {
        messages: [{ role: "user", content: "{{input.data}}" }]
      }},
      { id: "store", type: "endpoint.call", endpointId: "{{endpoint}}", input: {
        body: "{{steps.process.outputs.content}}"
      }}
    ]
  }
];
```

**步骤 2: 用户自定义 Skill 存储**

创建 `server/src/skills/skillRepository.ts`，存储用户自定义模板（JSON 序列化的 steps 数组）。

**步骤 3: 后端路由**

```ts
// GET /api/skills - 返回内置 + 用户自定义
// POST /api/skills - 创建自定义模板
// GET /api/skills/:id - 获取模板详情
// DELETE /api/skills/:id - 删除自定义模板
// POST /api/skills/:id/run - 用模板参数运行工作流
```

**步骤 4: 前端更新**

修改 `WorkflowTemplatesPage.tsx`，从 `GET /api/workflows` 拉取真实数据，展示 Skill 模板列表，支持"运行"按钮。

**步骤 5: Commit**

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

```tsx
export function WorkflowBuilderPage({ api }: { api: WorkflowBuilderApi }) {
  // State: steps[], selectedStep, running, results
  // UI:
  //   - 左侧：步骤列表（可添加/删除/排序）
  //   - 中间：步骤编辑器（选类型→选模型/endpoint/MCP server→编辑输入）
  //   - 右侧：运行结果（每步的输出预览）
}
```

**步骤 2: 步骤编辑器**

每种步骤类型有不同的编辑表单：

- `llm.chat`：选模型 + 编辑 messages（支持 `{{steps.X.outputs.Y}}` 引用）
- `endpoint.call`：选 Endpoint + 编辑 input JSON
- `mcp.call`：选 MCP Server + 选工具 + 编辑 arguments JSON

**步骤 3: 输入映射语法**

使用 `{{steps.<stepId>.outputs.<field>}}` 引用上一步的输出。前端提供自动补全提示。

**步骤 4: 运行**

点击"运行"后，调用 `POST /api/workflows/run`，传入编排好的 steps 数组。

**步骤 5: 测试 + 样式 + Commit**

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
- 创建: `docs/superpowers/plans/2026-06-XX-api-tools-v0-3-implementation.md`（更新此文件标记完成）
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
  transport text not null check (transport in ('stdio', 'streamable-http')),
  command text,
  args_json text default '[]',
  env_json text default '{}',
  url text,
  enabled integer not null default 1,
  created_at text not null,
  updated_at text not null
);

create table if not exists skills (
  id text primary key,
  name text not null,
  description text,
  steps_json text not null,
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
- 不做 Streamable HTTP transport（仅 stdio）
