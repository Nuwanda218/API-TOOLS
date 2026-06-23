import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

async function createProvider(app: ReturnType<typeof createApp>) {
  const response = await request(app).post("/api/providers").send({
    name: "Generic API",
    type: "openai-compatible",
    baseUrl: "https://example.test/v1",
    apiKeyEnv: "EXAMPLE_KEY",
    enabled: true
  });

  return response.body;
}

describe("endpoint routes", () => {
  it("creates, lists, gets, updates, and deletes endpoints", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });
    const provider = await createProvider(app);

    const createResponse = await request(app).post("/api/endpoints").send({
      providerId: provider.id,
      name: "List models",
      operationId: "http.request",
      method: "GET",
      path: "/models",
      queryTemplate: { limit: 20 },
      headersTemplate: { accept: "application/json" },
      enabled: true
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      providerId: provider.id,
      name: "List models",
      operationId: "http.request",
      method: "GET",
      path: "/models",
      queryTemplate: { limit: 20 },
      headersTemplate: { accept: "application/json" },
      bodyTemplate: null,
      enabled: true
    });

    const listResponse = await request(app).get("/api/endpoints");
    const providerListResponse = await request(app).get(`/api/endpoints?providerId=${provider.id}`);
    const getResponse = await request(app).get(`/api/endpoints/${createResponse.body.id}`);
    const updateResponse = await request(app).patch(`/api/endpoints/${createResponse.body.id}`).send({
      name: "Create chat",
      method: "POST",
      path: "/chat/completions",
      bodyTemplate: { model: "{{input.model}}" },
      enabled: false
    });
    const deleteResponse = await request(app).delete(`/api/endpoints/${createResponse.body.id}`);
    const missingAfterDelete = await request(app).get(`/api/endpoints/${createResponse.body.id}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
    expect(providerListResponse.body).toHaveLength(1);
    expect(getResponse.body.id).toBe(createResponse.body.id);
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      name: "Create chat",
      method: "POST",
      path: "/chat/completions",
      bodyTemplate: { model: "{{input.model}}" },
      enabled: false
    });
    expect(deleteResponse.status).toBe(204);
    expect(missingAfterDelete.status).toBe(404);

    db.close();
  });

  it("rejects missing providers and full URL paths", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });
    const provider = await createProvider(app);

    const missingProviderResponse = await request(app).post("/api/endpoints").send({
      providerId: "missing-provider",
      name: "Broken",
      operationId: "http.request",
      method: "GET",
      path: "/models"
    });
    const fullUrlResponse = await request(app).post("/api/endpoints").send({
      providerId: provider.id,
      name: "Unsafe",
      operationId: "http.request",
      method: "GET",
      path: "https://example.test/models"
    });

    expect(missingProviderResponse.status).toBe(404);
    expect(missingProviderResponse.body).toMatchObject({
      code: "provider_not_found",
      message: "Provider not found"
    });
    expect(fullUrlResponse.status).toBe(400);
    expect(fullUrlResponse.body.error).toBe("invalid_request");

    db.close();
  });
});
