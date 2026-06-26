import { describe, expect, it, vi } from "vitest";
import type { ApiInvocation } from "../apiProtocol/types.js";
import type { AdapterRegistry, ModelAdapter } from "../adapters/types.js";
import { createEndpointRepository } from "../endpoints/endpointRepository.js";
import { createMcpServerRepository } from "../mcp/mcpServerRepository.js";
import { createModelRepository } from "../providers/modelRepository.js";
import { createProviderRepository } from "../providers/providerRepository.js";
import { createTestDatabase } from "../test/testDb.js";
import { createWorkflowRunner } from "./runner.js";

describe("workflowRunner", () => {
  it("runs an llm.chat workflow step and records messages, run, and step", async () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);
    const provider = providers.create({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_KEY",
      enabled: true
    });
    const model = models.create({
      providerId: provider.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: { inputTokenPrice: 0.1, outputTokenPrice: 0.2 }
    });
    const adapter: ModelAdapter = {
      listModels: async () => [],
      testModel: async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} }),
      runChat: async () => ({
        content: "Hello from model",
        latencyMs: 12,
        usage: { inputTokens: 10, outputTokens: 4 }
      })
    };
    const adapterRegistry: AdapterRegistry = {
      getModelAdapter: vi.fn(() => adapter),
      invoke: vi.fn(async () => ({
        ok: true as const,
        data: { content: "Hello from model" },
        latencyMs: 12,
        usage: { inputTokens: 10, outputTokens: 4 }
      }))
    };
    const runner = createWorkflowRunner(db, {
      adapterRegistry,
      env: { CUSTOM_KEY: "secret" }
    });

    const result = await runner.runWorkflow({
      workflowType: "api-workflow",
      sessionId: undefined,
      input: { message: "Hello" },
      steps: [
        {
          id: "main-response",
          type: "llm.chat",
          modelId: model.id,
          input: { message: "{{input.message}}" }
        }
      ]
    });

    expect(result.outputs["main-response"]).toEqual({ content: "Hello from model" });
    expect(result.run.status).toBe("succeeded");
    expect(result.run.totalInputTokens).toBe(10);
    expect(result.run.totalOutputTokens).toBe(4);
    expect(result.run.totalCostEstimate).toBeCloseTo(0.0000018);
    expect(adapterRegistry.getModelAdapter).not.toHaveBeenCalled();
    expect(adapterRegistry.invoke).toHaveBeenCalledWith({
      operationId: "llm.chat",
      provider: expect.objectContaining({ id: provider.id, apiFormat: "openai-chat-completions" }),
      apiKey: "secret",
      resource: { kind: "model", model: expect.objectContaining({ id: model.id }) },
      input: { messages: [{ role: "user", content: "Hello" }] }
    });

    const messages = db.prepare("select role, content from messages order by created_at asc").all<{
      role: string;
      content: string;
    }>();
    expect(messages).toEqual([
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hello from model" }
    ]);

    const runSteps = db.prepare("select * from run_steps").all<{
      step_type: string;
      provider_id: string;
      model_id: string;
      status: string;
      input_preview: string;
      output_preview: string;
      input_tokens: number;
      output_tokens: number;
    }>();
    expect(runSteps).toEqual([
      expect.objectContaining({
        step_type: "llm.chat",
        provider_id: provider.id,
        model_id: model.id,
        status: "succeeded",
        input_preview: "Hello",
        output_preview: "Hello from model",
        input_tokens: 10,
        output_tokens: 4
      })
    ]);

    db.close();
  });

  it("resolves workflow input and previous step outputs in later step inputs", async () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);
    const provider = providers.create({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_KEY",
      enabled: true
    });
    const model = models.create({
      providerId: provider.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: {}
    });
    const invoke = vi.fn(async (request: ApiInvocation) => {
      const messages = request.input.messages as Array<{ content: string }> | undefined;
      const message = messages?.[0]?.content ?? "";
      return {
        ok: true as const,
        data: { content: message === "Find weather" ? "weather keyword" : `final: ${message}` },
        latencyMs: 12,
        usage: {}
      };
    });
    const adapterRegistry: AdapterRegistry = {
      getModelAdapter: vi.fn(() => ({
        listModels: async () => [],
        testModel: async () => ({ ok: true as const, latencyMs: 1, message: "ok", usage: {} }),
        runChat: async () => ({ content: "unused", latencyMs: 1, usage: {} })
      })),
      invoke
    };
    const runner = createWorkflowRunner(db, {
      adapterRegistry,
      env: { CUSTOM_KEY: "secret" }
    });

    const result = await runner.runWorkflow({
      workflowType: "api-workflow",
      input: { message: "Find weather", locale: "English" },
      steps: [
        {
          id: "extract",
          type: "llm.chat",
          modelId: model.id,
          input: { message: "{{input.message}}" }
        },
        {
          id: "summarize",
          type: "llm.chat",
          modelId: model.id,
          input: { message: "Summarize {{steps.extract.outputs.content}} in {{input.locale}}" }
        }
      ]
    });

    expect(result.outputs.extract).toEqual({ content: "weather keyword" });
    expect(result.outputs.summarize).toEqual({ content: "final: Summarize weather keyword in English" });
    expect(invoke).toHaveBeenNthCalledWith(2, expect.objectContaining({
      input: { messages: [{ role: "user", content: "Summarize weather keyword in English" }] }
    }));

    const runSteps = db.prepare("select step_index, input_preview, output_preview from run_steps order by step_index asc").all<{
      step_index: number;
      input_preview: string;
      output_preview: string;
    }>();
    expect(runSteps).toEqual([
      expect.objectContaining({ step_index: 0, input_preview: "Find weather", output_preview: "weather keyword" }),
      expect.objectContaining({
        step_index: 1,
        input_preview: "Summarize weather keyword in English",
        output_preview: "final: Summarize weather keyword in English"
      })
    ]);

    db.close();
  });

  it("runs an endpoint.call workflow step and records endpoint output", async () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const endpoints = createEndpointRepository(db);
    const provider = providers.create({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_KEY",
      enabled: true
    });
    const endpoint = endpoints.create({
      providerId: provider.id,
      name: "Echo",
      operationId: "http.request",
      method: "POST",
      path: "/echo",
      bodyTemplate: { prompt: "{{input.prompt}}" }
    });
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { prompt?: string };
      return new Response(JSON.stringify({ received: body.prompt }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    const adapterRegistry: AdapterRegistry = {
      getModelAdapter: vi.fn(() => ({
        listModels: async () => [],
        testModel: async () => ({ ok: true as const, latencyMs: 1, message: "ok", usage: {} }),
        runChat: async () => ({ content: "unused", latencyMs: 1, usage: {} })
      })),
      invoke: vi.fn()
    };
    const runner = createWorkflowRunner(db, {
      adapterRegistry,
      env: { CUSTOM_KEY: "secret" },
      endpointFetch: fetchMock
    });

    const result = await runner.runWorkflow({
      workflowType: "api-workflow",
      input: { message: "Hello endpoint" },
      steps: [
        {
          id: "echo",
          type: "endpoint.call",
          endpointId: endpoint.id,
          input: { prompt: "{{input.message}}" }
        }
      ]
    });

    expect(result.outputs.echo).toEqual({
      body: { received: "Hello endpoint" },
      statusCode: 200
    });
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/v1/echo", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ authorization: "Bearer secret" }),
      body: JSON.stringify({ prompt: "Hello endpoint" })
    }));

    const runSteps = db.prepare("select * from run_steps").all<{
      step_type: string;
      provider_id: string | null;
      model_id: string | null;
      endpoint_id: string | null;
      status: string;
      input_preview: string;
      output_preview: string;
    }>();
    expect(runSteps).toEqual([
      expect.objectContaining({
        step_type: "endpoint.call",
        provider_id: provider.id,
        model_id: null,
        endpoint_id: endpoint.id,
        status: "succeeded",
        input_preview: "{\"prompt\":\"Hello endpoint\"}",
        output_preview: "{\"statusCode\":200,\"bodyPreview\":{\"received\":\"Hello endpoint\"}}"
      })
    ]);

    db.close();
  });

  it("runs an mcp.call workflow step and records MCP trace fields", async () => {
    const db = createTestDatabase();
    const mcpServers = createMcpServerRepository(db);
    const mcpServer = mcpServers.create({
      name: "Filesystem",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "F:\\tmp"],
      env: { ROOT: "F:\\tmp" }
    });
    const mcpManager = {
      connect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue([]),
      callTool: vi.fn().mockResolvedValue({
        ok: true,
        content: [{ type: "text", text: "file content" }],
        isError: false,
        latencyMs: 9
      }),
      disconnect: vi.fn().mockResolvedValue(true)
    };
    const runner = createWorkflowRunner(db, {
      adapterRegistry: createNoopAdapterRegistry(),
      env: {},
      mcpManager
    });

    const result = await runner.runWorkflow({
      workflowType: "api-workflow",
      input: { message: "Read package", path: "package.json" },
      steps: [
        {
          id: "read",
          type: "mcp.call",
          mcpServerId: mcpServer.id,
          toolName: "read_file",
          input: { path: "{{input.path}}" }
        }
      ]
    });

    expect(mcpManager.connect).toHaveBeenCalledWith(expect.objectContaining({ id: mcpServer.id }));
    expect(mcpManager.callTool).toHaveBeenCalledWith(mcpServer.id, "read_file", { path: "package.json" });
    expect(result.outputs.read).toEqual({
      content: [{ type: "text", text: "file content" }],
      isError: false
    });
    expect(result.run.status).toBe("succeeded");

    const runSteps = db.prepare("select * from run_steps").all<{
      step_type: string;
      mcp_server_id: string | null;
      mcp_tool_name: string | null;
      status: string;
      input_preview: string;
      output_preview: string;
      latency_ms: number;
    }>();
    expect(runSteps).toEqual([
      expect.objectContaining({
        step_type: "mcp.call",
        mcp_server_id: mcpServer.id,
        mcp_tool_name: "read_file",
        status: "succeeded",
        input_preview: "{\"path\":\"package.json\"}",
        output_preview: "[{\"type\":\"text\",\"text\":\"file content\"}]",
        latency_ms: 9
      })
    ]);

    db.close();
  });

  it("records failed run and run_step when adapter invocation fails", async () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);
    const provider = providers.create({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_KEY",
      enabled: true
    });
    const model = models.create({
      providerId: provider.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: {}
    });
    const adapterRegistry: AdapterRegistry = {
      getModelAdapter: vi.fn(() => ({
        listModels: async () => [],
        testModel: async () => ({ ok: true as const, latencyMs: 1, message: "ok", usage: {} }),
        runChat: async () => ({ content: "unused", latencyMs: 1, usage: {} })
      })),
      invoke: vi.fn(async () => ({
        ok: false as const,
        code: "rate_limited" as const,
        message: "Provider request failed",
        providerMessage: "Too many requests",
        statusCode: 429,
        suggestion: "Retry later",
        latencyMs: 15
      }))
    };
    const runner = createWorkflowRunner(db, {
      adapterRegistry,
      env: { CUSTOM_KEY: "secret" }
    });

    await expect(runner.runWorkflow({
      workflowType: "api-workflow",
      input: { message: "Hello" },
      steps: [
        {
          id: "main-response",
          type: "llm.chat",
          modelId: model.id,
          input: { message: "{{input.message}}" }
        }
      ]
    })).rejects.toMatchObject({
      code: "rate_limited",
      message: "Provider request failed",
      providerMessage: "Too many requests",
      statusCode: 429,
      suggestion: "Retry later"
    });

    const runs = db.prepare("select * from runs").all<{
      status: string;
      total_input_tokens: number | null;
      total_output_tokens: number | null;
      total_cost_estimate: number | null;
    }>();
    expect(runs).toEqual([
      expect.objectContaining({
        status: "failed",
        total_input_tokens: null,
        total_output_tokens: null,
        total_cost_estimate: null
      })
    ]);

    const runSteps = db.prepare("select * from run_steps").all<{
      step_type: string;
      provider_id: string;
      model_id: string;
      status: string;
      input_preview: string;
      output_preview: string | null;
      error_code: string | null;
      error_message: string | null;
      latency_ms: number | null;
    }>();
    expect(runSteps).toEqual([
      expect.objectContaining({
        step_type: "llm.chat",
        provider_id: provider.id,
        model_id: model.id,
        status: "failed",
        input_preview: "Hello",
        output_preview: null,
        error_code: "rate_limited",
        error_message: "Provider request failed",
        latency_ms: 15
      })
    ]);

    const messages = db.prepare("select role, content from messages order by created_at asc").all<{
      role: string;
      content: string;
    }>();
    expect(messages).toEqual([{ role: "user", content: "Hello" }]);

    db.close();
  });
});

function createNoopAdapterRegistry(): AdapterRegistry {
  return {
    getModelAdapter: vi.fn(() => ({
      listModels: async () => [],
      testModel: async () => ({ ok: true as const, latencyMs: 1, message: "ok", usage: {} }),
      runChat: async () => ({ content: "unused", latencyMs: 1, usage: {} })
    })),
    invoke: vi.fn()
  };
}
