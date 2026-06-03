import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

async function createProvider(app: ReturnType<typeof createApp>) {
  const response = await request(app).post("/api/providers").send({
    name: "Custom",
    type: "openai-compatible",
    baseUrl: "https://example.test/v1",
    apiKeyEnv: "CUSTOM_OPENAI_COMPATIBLE_KEY",
    enabled: true
  });

  return response.body;
}

describe("model routes", () => {
  it("creates and lists models", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });
    const provider = await createProvider(app);

    const modelResponse = await request(app).post("/api/models").send({
      providerId: provider.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: { temperature: 0.2 },
      pricing: { inputTokenPrice: 0.1, outputTokenPrice: 0.2 }
    });

    expect(modelResponse.status).toBe(201);
    expect(modelResponse.body).toMatchObject({
      id: expect.any(String),
      providerId: provider.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: { temperature: 0.2 },
      pricing: { inputTokenPrice: 0.1, outputTokenPrice: 0.2 }
    });

    const listResponse = await request(app).get("/api/models");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([modelResponse.body]);

    db.close();
  });

  it("filters models by provider", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });
    const firstProvider = await createProvider(app);
    const secondProvider = (await request(app).post("/api/providers").send({
      name: "OpenAI",
      type: "openai-official",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      enabled: true
    })).body;

    const firstModel = (await request(app).post("/api/models").send({
      providerId: firstProvider.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true
    })).body;
    await request(app).post("/api/models").send({
      providerId: secondProvider.id,
      displayName: "GPT-4o mini",
      modelId: "gpt-4o-mini",
      capability: "chat",
      enabled: true
    });

    const listResponse = await request(app).get(`/api/models?providerId=${firstProvider.id}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([firstModel]);

    db.close();
  });

  it("updates and deletes models", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });
    const provider = await createProvider(app);
    const model = (await request(app).post("/api/models").send({
      providerId: provider.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true
    })).body;

    const updateResponse = await request(app)
      .patch(`/api/models/${model.id}`)
      .send({ displayName: "Fast Chat disabled", enabled: false });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      id: model.id,
      displayName: "Fast Chat disabled",
      enabled: false
    });

    const deleteResponse = await request(app).delete(`/api/models/${model.id}`);

    expect(deleteResponse.status).toBe(204);
    expect(await request(app).get("/api/models")).toMatchObject({
      status: 200,
      body: []
    });

    db.close();
  });

  it("returns 400 for invalid model input", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const response = await request(app).post("/api/models").send({
      providerId: "",
      displayName: "",
      modelId: "",
      capability: "not-real",
      enabled: true
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_request");

    db.close();
  });
});
