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
      getModelAdapter: () => adapter,
      invoke: async () => ({
        ok: true,
        data: { content: "Model reply" },
        latencyMs: 8,
        usage: { inputTokens: 6, outputTokens: 3 }
      })
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
    expect(response.body.requestCount).toBe(1);
    expect(response.body.inputTokens).toBe(6);
    expect(response.body.outputTokens).toBe(3);
    expect(response.body.estimatedCost).toBe(0);
    expect(response.body.errorCount).toBe(0);
    expect(response.body.averageLatencyMs).toBe(8);

    db.close();
  });

  it("returns full dashboard data", async () => {
    const db = createTestDatabase();
    const adapterRegistry: AdapterRegistry = {
      getModelAdapter: () => ({
        listModels: async () => [],
        testModel: async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} }),
        runChat: async () => ({ content: "ok", latencyMs: 5, usage: { inputTokens: 4, outputTokens: 2 } })
      }),
      invoke: async () => ({
        ok: true,
        data: { content: "ok" },
        latencyMs: 5,
        usage: { inputTokens: 4, outputTokens: 2 }
      })
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

    const response = await request(app).get("/api/usage/dashboard");

    expect(response.status).toBe(200);
    const body = response.body;
    expect(body.summary).toBeDefined();
    expect(body.summary.requestCount).toBe(1);
    expect(body.filters.range).toBe("all");
    expect(body.byProvider.length).toBe(1);
    expect(body.byProvider[0].name).toBe("Custom");
    expect(body.byModel.length).toBe(1);
    expect(body.byModel[0].name).toBe("Fast Chat");
    expect(body.trend.length).toBe(1);
    expect(body.recentSteps.length).toBe(1);

    db.close();
  });

  it("filters by time range", async () => {
    const db = createTestDatabase();
    const adapterRegistry: AdapterRegistry = {
      getModelAdapter: () => ({
        listModels: async () => [],
        testModel: async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} }),
        runChat: async () => ({ content: "ok", latencyMs: 5, usage: { inputTokens: 1, outputTokens: 1 } })
      }),
      invoke: async () => ({
        ok: true,
        data: { content: "ok" },
        latencyMs: 5,
        usage: { inputTokens: 1, outputTokens: 1 }
      })
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

    // "today" range: step was just created, so it should appear
    const today = await request(app).get("/api/usage/dashboard?range=today");
    expect(today.status).toBe(200);
    expect(today.body.summary.requestCount).toBe(1);

    // "7d" range should also include it
    const week = await request(app).get("/api/usage/dashboard?range=7d");
    expect(week.body.summary.requestCount).toBe(1);

    db.close();
  });

  it("filters by provider and model", async () => {
    const db = createTestDatabase();
    const adapterRegistry: AdapterRegistry = {
      getModelAdapter: () => ({
        listModels: async () => [],
        testModel: async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} }),
        runChat: async () => ({ content: "ok", latencyMs: 5, usage: { inputTokens: 1, outputTokens: 1 } })
      }),
      invoke: async () => ({
        ok: true,
        data: { content: "ok" },
        latencyMs: 5,
        usage: { inputTokens: 1, outputTokens: 1 }
      })
    };
    const app = createApp({ db, env: { CUSTOM_KEY: "secret" }, adapterRegistry });

    const p1 = await request(app).post("/api/providers").send({
      name: "Alpha", type: "openai-compatible", baseUrl: "https://a.test", apiKeyEnv: "CUSTOM_KEY", enabled: true
    });
    const p2 = await request(app).post("/api/providers").send({
      name: "Beta", type: "openai-compatible", baseUrl: "https://b.test", apiKeyEnv: "CUSTOM_KEY", enabled: true
    });
    const m1 = await request(app).post("/api/models").send({
      providerId: p1.body.id, displayName: "Model A", modelId: "ma", capability: "chat", enabled: true, defaultParams: {}, pricing: {}
    });
    const m2 = await request(app).post("/api/models").send({
      providerId: p2.body.id, displayName: "Model B", modelId: "mb", capability: "chat", enabled: true, defaultParams: {}, pricing: {}
    });
    await request(app).post("/api/workflows/run").send({
      workflowType: "api-workflow", input: { message: "A" },
      steps: [{ id: "s1", type: "llm.chat", modelId: m1.body.id, input: { message: "{{input.message}}" } }]
    });
    await request(app).post("/api/workflows/run").send({
      workflowType: "api-workflow", input: { message: "B" },
      steps: [{ id: "s2", type: "llm.chat", modelId: m2.body.id, input: { message: "{{input.message}}" } }]
    });

    const byProvider = await request(app).get(`/api/usage/dashboard?providerId=${p1.body.id}`);
    expect(byProvider.body.summary.requestCount).toBe(1);

    const byModel = await request(app).get(`/api/usage/dashboard?modelId=${m2.body.id}`);
    expect(byModel.body.summary.requestCount).toBe(1);

    const both = await request(app).get(`/api/usage/dashboard?providerId=${p1.body.id}&modelId=${m2.body.id}`);
    expect(both.body.summary.requestCount).toBe(0);

    db.close();
  });
});
