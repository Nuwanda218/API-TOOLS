import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AdapterRegistry, ModelAdapter } from "../adapters/types.js";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("workflow routes", () => {
  it("runs an llm.chat workflow", async () => {
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

    const response = await request(app).post("/api/workflows/run").send({
      workflowType: "api-workflow",
      input: { message: "Hello" },
      steps: [
        {
          id: "main-response",
          type: "llm.chat",
          modelId: modelResponse.body.id,
          input: { message: "{{input.message}}" }
        }
      ]
    });

    expect(response.status).toBe(200);
    expect(response.body.outputs["main-response"].content).toBe("Model reply");
    expect(response.body.run.status).toBe("succeeded");

    db.close();
  });

  it("runs an endpoint.call workflow", async () => {
    const db = createTestDatabase();
    const endpointFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { prompt?: string };
      return new Response(JSON.stringify({ received: body.prompt }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    const app = createApp({ db, env: { CUSTOM_KEY: "secret" }, endpointFetch });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_KEY",
      enabled: true
    });
    const endpointResponse = await request(app).post("/api/endpoints").send({
      providerId: providerResponse.body.id,
      name: "Echo",
      operationId: "http.request",
      method: "POST",
      path: "/echo",
      bodyTemplate: { prompt: "{{input.prompt}}" },
      enabled: true
    });

    const response = await request(app).post("/api/workflows/run").send({
      workflowType: "api-workflow",
      input: { message: "Hello endpoint" },
      steps: [
        {
          id: "echo",
          type: "endpoint.call",
          endpointId: endpointResponse.body.id,
          input: { prompt: "{{input.message}}" }
        }
      ]
    });

    expect(response.status).toBe(200);
    expect(response.body.outputs.echo).toEqual({
      body: { received: "Hello endpoint" },
      statusCode: 200
    });
    expect(response.body.run.status).toBe("succeeded");
    expect(endpointFetch).toHaveBeenCalledWith("https://example.test/v1/echo", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ prompt: "Hello endpoint" })
    }));

    db.close();
  });
});
