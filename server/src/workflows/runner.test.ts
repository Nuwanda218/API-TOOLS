import { describe, expect, it } from "vitest";
import type { ModelAdapter } from "../adapters/types.js";
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
    const runner = createWorkflowRunner(db, {
      adapter,
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
});
