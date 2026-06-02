import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("provider routes", () => {
  it("creates and lists providers", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const createResponse = await request(app).post("/api/providers").send({
      name: "DeepSeek",
      type: "openai-compatible",
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      enabled: true
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      id: expect.any(String),
      name: "DeepSeek",
      type: "openai-compatible",
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      enabled: true
    });

    const listResponse = await request(app).get("/api/providers");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([createResponse.body]);

    db.close();
  });

  it("updates and deletes providers", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const createResponse = await request(app).post("/api/providers").send({
      name: "OpenAI",
      type: "openai-official",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      enabled: true
    });

    const updateResponse = await request(app)
      .patch(`/api/providers/${createResponse.body.id}`)
      .send({ name: "OpenAI disabled", enabled: false });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      id: createResponse.body.id,
      name: "OpenAI disabled",
      enabled: false
    });

    const deleteResponse = await request(app).delete(`/api/providers/${createResponse.body.id}`);

    expect(deleteResponse.status).toBe(204);
    expect(await request(app).get("/api/providers")).toMatchObject({
      status: 200,
      body: []
    });

    db.close();
  });

  it("returns 400 for invalid provider input", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const response = await request(app).post("/api/providers").send({
      name: "",
      type: "not-real",
      baseUrl: "not-a-url",
      apiKeyEnv: "",
      enabled: true
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_request");

    db.close();
  });
});
