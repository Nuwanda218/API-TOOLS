import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { AdapterRegistry, ModelAdapter } from "../adapters/types.js";
import { createApp } from "../app.js";
import { ProviderError } from "../errors/providerError.js";
import { createTestDatabase } from "../test/testDb.js";

describe("provider remote model routes", () => {
  it("lists remote models using the provider key", async () => {
    const db = createTestDatabase();
    const adapter = {
      listModels: vi.fn().mockResolvedValue([
        { id: "gpt-4.1-mini", ownedBy: "openai" },
        { id: "gpt-4.1-nano" }
      ]),
      testModel: vi.fn(),
      runChat: vi.fn()
    } satisfies ModelAdapter;
    const adapterRegistry: AdapterRegistry = {
      getModelAdapter: vi.fn(() => adapter),
      invoke: vi.fn()
    };
    const app = createApp({
      db,
      env: { OPENAI_API_KEY: "sk-test" },
      adapterRegistry
    });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Horizon",
      type: "openai-official",
      apiFormat: "openai-responses",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      enabled: true
    });

    const response = await request(app).get(`/api/providers/${providerResponse.body.id}/remote-models`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      providerId: providerResponse.body.id,
      models: [
        { id: "gpt-4.1-mini", ownedBy: "openai" },
        { id: "gpt-4.1-nano" }
      ]
    });
    expect(adapter.listModels).toHaveBeenCalledWith({
      provider: expect.objectContaining({ id: providerResponse.body.id, apiFormat: "openai-responses" }),
      apiKey: "sk-test"
    });
    expect(adapterRegistry.getModelAdapter).toHaveBeenCalledWith(
      expect.objectContaining({ id: providerResponse.body.id, apiFormat: "openai-responses" })
    );

    db.close();
  });

  it("reports missing API key without exposing other secrets", async () => {
    const db = createTestDatabase();
    const app = createApp({
      db,
      env: { OTHER_KEY: "sk-should-not-leak" }
    });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Horizon",
      type: "openai-official",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      enabled: true
    });

    const response = await request(app).get(`/api/providers/${providerResponse.body.id}/remote-models`);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: "missing_api_key",
      message: "Missing API key env var: OPENAI_API_KEY"
    });
    expect(JSON.stringify(response.body)).not.toContain("sk-should-not-leak");

    db.close();
  });

  it("returns standardized remote model listing shape errors", async () => {
    const db = createTestDatabase();
    const adapter = {
      listModels: vi.fn().mockRejectedValue(
        new ProviderError("unexpected_response_shape", "Remote model list response was not usable", {
          providerMessage: "Remote model list response was not valid JSON",
          statusCode: 502,
          suggestion: "Use manual model import with a known model ID."
        })
      ),
      testModel: vi.fn(),
      runChat: vi.fn()
    } satisfies ModelAdapter;
    const app = createApp({
      db,
      env: { OPENAI_API_KEY: "sk-test" },
      adapterRegistry: {
        getModelAdapter: vi.fn(() => adapter),
        invoke: vi.fn()
      }
    });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Horizon",
      type: "openai-official",
      apiFormat: "openai-responses",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      enabled: true
    });

    const response = await request(app).get(`/api/providers/${providerResponse.body.id}/remote-models`);

    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      code: "unexpected_response_shape",
      message: "Remote model list response was not usable",
      providerMessage: "Remote model list response was not valid JSON",
      suggestion: "Use manual model import with a known model ID."
    });

    db.close();
  });

  it("returns 404 for missing providers", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const response = await request(app).get("/api/providers/missing-provider/remote-models");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      code: "provider_not_found",
      message: "Provider not found"
    });

    db.close();
  });
});
