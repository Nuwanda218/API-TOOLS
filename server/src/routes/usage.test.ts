import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AdapterRegistry, ModelAdapter } from "../adapters/types.js";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("usage routes", () => {
  it("summarizes workflow runs", async () => {
    const db = createTestDatabase();
    const adapter: ModelAdapter = {
      listModels: async () => [],
      testModel: async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} }),
      runChat: async () => ({ content: "Model reply", latencyMs: 8, usage: { inputTokens: 6, outputTokens: 3 } })
    };
    const adapterRegistry: AdapterRegistry = {
      getModelAdapter: () => adapter
    };
    const app = createApp({ db, env: { CUSTOM_KEY: "secret" }, adapterRegistry });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_KEY",
      enabled: true
    });
    const modelResponse = await request(app).post("/api/models").send({
      providerId: providerResponse.body.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: {}
    });
    await request(app).post("/api/workflows/run").send({
      workflowType: "api-workflow",
      input: { message: "Hello" },
      steps: [{ id: "main-response", type: "llm.chat", modelId: modelResponse.body.id, input: { message: "{{input.message}}" } }]
    });

    const response = await request(app).get("/api/usage/summary");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      requestCount: 1,
      inputTokens: 6,
      outputTokens: 3,
      estimatedCost: 0,
      errorCount: 0
    });

    db.close();
  });
});
