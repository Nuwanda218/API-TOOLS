import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AdapterRegistry, ModelAdapter } from "../adapters/types.js";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("model test route", () => {
  it("tests a model using the adapter selected by provider API format", async () => {
    const db = createTestDatabase();
    const adapter: ModelAdapter = {
      listModels: vi.fn(),
      testModel: vi.fn().mockResolvedValue({
        ok: true,
        latencyMs: 5,
        message: "ok",
        usage: { inputTokens: 2, outputTokens: 1 }
      }),
      runChat: vi.fn()
    };
    const adapterRegistry: AdapterRegistry = {
      getModelAdapter: vi.fn(() => adapter),
      invoke: vi.fn()
    };
    const app = createApp({
      db,
      env: { RESPONSES_KEY: "secret" },
      adapterRegistry
    });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Responses",
      type: "openai-compatible",
      apiFormat: "openai-responses",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "RESPONSES_KEY",
      enabled: true
    });
    const modelResponse = await request(app).post("/api/models").send({
      providerId: providerResponse.body.id,
      displayName: "Responses Chat",
      modelId: "responses-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: {}
    });

    const testResponse = await request(app).post(`/api/models/${modelResponse.body.id}/test`);

    expect(testResponse.status).toBe(200);
    expect(testResponse.body).toMatchObject({
      ok: true,
      message: "ok",
      usage: { inputTokens: 2, outputTokens: 1 }
    });
    expect(adapterRegistry.getModelAdapter).toHaveBeenCalledWith(
      expect.objectContaining({ id: providerResponse.body.id, apiFormat: "openai-responses" })
    );
    expect(adapter.testModel).toHaveBeenCalledWith({
      provider: expect.objectContaining({ id: providerResponse.body.id, apiFormat: "openai-responses" }),
      model: expect.objectContaining({ id: modelResponse.body.id }),
      apiKey: "secret"
    });

    db.close();
  });

  it("reports missing API key without exposing a secret and records the failed run step", async () => {
    const db = createTestDatabase();
    const app = createApp({ db, env: { OTHER_KEY: "sk-should-not-leak" } });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_OPENAI_COMPATIBLE_KEY",
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

    const testResponse = await request(app).post(`/api/models/${modelResponse.body.id}/test`);

    expect(testResponse.status).toBe(400);
    expect(testResponse.body).toMatchObject({
      code: "missing_api_key",
      message: "Missing API key env var: CUSTOM_OPENAI_COMPATIBLE_KEY"
    });
    expect(JSON.stringify(testResponse.body)).not.toContain("sk-should-not-leak");

    const runs = db.prepare("select * from runs").all<{
      id: string;
      session_id: string;
      workflow_type: string;
      status: string;
      total_input_tokens: number | null;
      total_output_tokens: number | null;
    }>();
    const steps = db.prepare("select * from run_steps").all<{
      run_id: string;
      step_type: string;
      provider_id: string;
      model_id: string;
      status: string;
      input_preview: string;
      error_code: string;
      error_message: string;
      input_tokens: number | null;
      output_tokens: number | null;
    }>();

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      workflow_type: "model-test",
      status: "failed",
      total_input_tokens: null,
      total_output_tokens: null
    });
    expect(steps).toEqual([
      expect.objectContaining({
        run_id: runs[0].id,
        step_type: "model-test",
        provider_id: providerResponse.body.id,
        model_id: modelResponse.body.id,
        status: "failed",
        input_preview: "Reply with ok.",
        error_code: "missing_api_key",
        error_message: "Missing API key env var: CUSTOM_OPENAI_COMPATIBLE_KEY",
        input_tokens: null,
        output_tokens: null
      })
    ]);

    db.close();
  });

  it("tests a model with a custom prompt and runtime params", async () => {
    const db = createTestDatabase();
    const adapter: ModelAdapter = {
      listModels: vi.fn(),
      testModel: vi.fn(),
      runChat: vi.fn().mockResolvedValue({
        content: "ok",
        latencyMs: 7,
        usage: { inputTokens: 8, outputTokens: 1 }
      })
    };
    const app = createApp({
      db,
      env: { CUSTOM_KEY: "secret" },
      adapterRegistry: {
        getModelAdapter: vi.fn(() => adapter),
        invoke: vi.fn()
      }
    });

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
      defaultParams: { temperature: 0.8 },
      pricing: {}
    });

    const testResponse = await request(app)
      .post(`/api/models/${modelResponse.body.id}/test`)
      .send({
        message: "只回复 ok",
        params: {
          temperature: 0,
          maxTokens: 20
        }
      });

    expect(testResponse.status).toBe(200);
    expect(testResponse.body).toMatchObject({
      ok: true,
      latencyMs: 7,
      message: "ok",
      usage: { inputTokens: 8, outputTokens: 1 }
    });
    expect(adapter.runChat).toHaveBeenCalledWith({
      provider: expect.objectContaining({ id: providerResponse.body.id }),
      model: expect.objectContaining({
        id: modelResponse.body.id,
        defaultParams: {
          temperature: 0,
          maxTokens: 20
        }
      }),
      apiKey: "secret",
      messages: [{ role: "user", content: "只回复 ok" }]
    });

    db.close();
  });
});
