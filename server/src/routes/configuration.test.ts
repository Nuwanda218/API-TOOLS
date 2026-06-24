import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createProviderRepository } from "../providers/providerRepository.js";
import { createTestDatabase } from "../test/testDb.js";

describe("configuration routes", () => {
  it("exports configuration without API key values", async () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    providers.create({
      id: "provider-1",
      name: "DeepSeek",
      type: "openai-compatible",
      apiFormat: "openai-chat-completions",
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      enabled: true
    });
    const app = createApp({ db, env: { DEEPSEEK_API_KEY: "real-secret-value" } });

    const response = await request(app).get("/api/configuration/export");

    expect(response.status).toBe(200);
    expect(response.body.providers[0]).toMatchObject({
      id: "provider-1",
      apiKeyEnv: "DEEPSEEK_API_KEY"
    });
    expect(JSON.stringify(response.body)).not.toContain("real-secret-value");

    db.close();
  });

  it("imports configuration", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const response = await request(app).post("/api/configuration/import").send({
      version: 1,
      providers: [
        {
          id: "provider-1",
          name: "Imported Provider",
          type: "openai-compatible",
          apiFormat: "openai-chat-completions",
          baseUrl: "https://example.test/v1",
          apiKeyEnv: "EXAMPLE_API_KEY",
          enabled: true
        }
      ],
      models: [],
      endpoints: [],
      missingApiKeyEnvs: []
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ imported: { providers: 1, models: 0, endpoints: 0 } });

    const listResponse = await request(app).get("/api/providers");
    expect(listResponse.body[0]).toMatchObject({ id: "provider-1", name: "Imported Provider" });

    db.close();
  });
});
