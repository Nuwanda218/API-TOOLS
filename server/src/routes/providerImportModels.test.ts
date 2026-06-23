import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

async function createProvider(app: ReturnType<typeof createApp>) {
  const response = await request(app).post("/api/providers").send({
    name: "Horizon",
    type: "openai-compatible",
    baseUrl: "https://api.honglin.asia/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    enabled: true
  });

  return response.body;
}

describe("provider model import routes", () => {
  it("imports multiple remote models into the local model registry", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });
    const provider = await createProvider(app);

    const response = await request(app).post(`/api/providers/${provider.id}/import-models`).send({
      models: [
        {
          modelId: "gpt-5.2-chat-latest",
          displayName: "GPT-5.2 Chat Latest",
          capability: "chat"
        },
        {
          modelId: "gpt-5.4-mini",
          displayName: "GPT-5.4 Mini",
          capability: "chat",
          enabled: false,
          defaultParams: { temperature: 0.2 },
          pricing: { inputTokenPrice: 0.1 }
        }
      ]
    });

    expect(response.status).toBe(201);
    expect(response.body.skipped).toEqual([]);
    expect(response.body.created).toHaveLength(2);
    expect(response.body.created).toEqual([
      expect.objectContaining({
        providerId: provider.id,
        modelId: "gpt-5.2-chat-latest",
        displayName: "GPT-5.2 Chat Latest",
        capability: "chat"
      }),
      expect.objectContaining({
        providerId: provider.id,
        modelId: "gpt-5.4-mini",
        displayName: "GPT-5.4 Mini",
        enabled: false,
        defaultParams: { temperature: 0.2 },
        pricing: { inputTokenPrice: 0.1 }
      })
    ]);

    const listResponse = await request(app).get(`/api/models?providerId=${provider.id}`);

    expect(listResponse.body.map((model: { modelId: string }) => model.modelId)).toEqual([
      "gpt-5.2-chat-latest",
      "gpt-5.4-mini"
    ]);

    db.close();
  });

  it("skips duplicate imports for the same provider", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });
    const provider = await createProvider(app);
    const body = {
      models: [
        {
          modelId: "gpt-5.2-chat-latest",
          displayName: "GPT-5.2 Chat Latest",
          capability: "chat"
        }
      ]
    };

    await request(app).post(`/api/providers/${provider.id}/import-models`).send(body);
    const secondResponse = await request(app).post(`/api/providers/${provider.id}/import-models`).send(body);

    expect(secondResponse.status).toBe(201);
    expect(secondResponse.body.created).toEqual([]);
    expect(secondResponse.body.skipped).toEqual([
      { modelId: "gpt-5.2-chat-latest", reason: "already_exists" }
    ]);

    const listResponse = await request(app).get(`/api/models?providerId=${provider.id}`);

    expect(listResponse.body).toHaveLength(1);

    db.close();
  });

  it("returns 404 for missing providers", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const response = await request(app).post("/api/providers/missing-provider/import-models").send({
      models: [
        {
          modelId: "gpt-5.2-chat-latest",
          displayName: "GPT-5.2 Chat Latest",
          capability: "chat"
        }
      ]
    });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      code: "provider_not_found",
      message: "Provider not found"
    });

    db.close();
  });

  it("returns 400 for invalid import payloads", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });
    const provider = await createProvider(app);

    const emptyResponse = await request(app).post(`/api/providers/${provider.id}/import-models`).send({
      models: []
    });
    const invalidCapabilityResponse = await request(app).post(`/api/providers/${provider.id}/import-models`).send({
      models: [
        {
          modelId: "gpt-5.2-chat-latest",
          displayName: "GPT-5.2 Chat Latest",
          capability: "not-real"
        }
      ]
    });

    expect(emptyResponse.status).toBe(400);
    expect(invalidCapabilityResponse.status).toBe(400);

    db.close();
  });
});
