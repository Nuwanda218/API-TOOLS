import { describe, expect, it, vi } from "vitest";
import type { AdapterRegistry, ModelAdapter } from "../adapters/types.js";
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
