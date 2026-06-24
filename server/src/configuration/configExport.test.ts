import { describe, expect, it } from "vitest";
import { createEndpointRepository } from "../endpoints/endpointRepository.js";
import { createModelRepository } from "../providers/modelRepository.js";
import { createProviderRepository } from "../providers/providerRepository.js";
import { createTestDatabase } from "../test/testDb.js";
import { buildConfigurationExport, importConfiguration } from "./configExport.js";

describe("configuration export", () => {
  it("exports providers, models, and endpoints without API key values", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);
    const endpoints = createEndpointRepository(db);

    const provider = providers.create({
      id: "provider-1",
      name: "DeepSeek",
      type: "openai-compatible",
      apiFormat: "openai-chat-completions",
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      capabilities: { supportsChat: true, supportsModelListing: true },
      enabled: true
    });
    models.create({
      id: "model-1",
      providerId: provider.id,
      displayName: "deepseek-chat",
      modelId: "deepseek-chat",
      capability: "chat",
      enabled: true,
      defaultParams: { temperature: 0.2 },
      pricing: {}
    });
    endpoints.create({
      id: "endpoint-1",
      providerId: provider.id,
      name: "Chat completion",
      operationId: "http.request",
      method: "POST",
      path: "/chat/completions",
      queryTemplate: {},
      headersTemplate: { "X-Test": "{{input.test}}" },
      bodyTemplate: { model: "deepseek-chat" },
      enabled: true
    });

    const exported = buildConfigurationExport(db, { DEEPSEEK_API_KEY: "real-secret-value" });

    expect(JSON.stringify(exported)).not.toContain("real-secret-value");
    expect(exported).toMatchObject({
      version: 1,
      providers: [
        {
          id: "provider-1",
          name: "DeepSeek",
          apiKeyEnv: "DEEPSEEK_API_KEY"
        }
      ],
      models: [
        {
          id: "model-1",
          providerId: "provider-1",
          modelId: "deepseek-chat"
        }
      ],
      endpoints: [
        {
          id: "endpoint-1",
          providerId: "provider-1",
          path: "/chat/completions"
        }
      ],
      missingApiKeyEnvs: []
    });

    db.close();
  });

  it("reports missing API key env vars", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);

    providers.create({
      id: "provider-1",
      name: "TJU",
      type: "openai-compatible",
      apiFormat: "openai-chat-completions",
      baseUrl: "https://ai.tju.edu.cn/api/v3",
      apiKeyEnv: "TJU_API_KEY",
      enabled: true
    });

    const exported = buildConfigurationExport(db, {});

    expect(exported.missingApiKeyEnvs).toEqual(["TJU_API_KEY"]);

    db.close();
  });

  it("imports configuration by upserting providers, models, and endpoints", () => {
    const db = createTestDatabase();

    const result = importConfiguration(db, {
      version: 1,
      providers: [
        {
          id: "provider-1",
          name: "Imported Provider",
          type: "openai-compatible",
          apiFormat: "openai-chat-completions",
          baseUrl: "https://example.test/v1",
          apiKeyEnv: "EXAMPLE_API_KEY",
          capabilities: { supportsChat: true },
          enabled: true
        }
      ],
      models: [
        {
          id: "model-1",
          providerId: "provider-1",
          displayName: "example-chat",
          modelId: "example-chat",
          capability: "chat",
          enabled: true,
          defaultParams: {},
          pricing: {}
        }
      ],
      endpoints: [
        {
          id: "endpoint-1",
          providerId: "provider-1",
          name: "Example endpoint",
          operationId: "http.request",
          method: "POST",
          path: "/chat/completions",
          queryTemplate: {},
          headersTemplate: {},
          bodyTemplate: { model: "example-chat" },
          enabled: true
        }
      ],
      missingApiKeyEnvs: []
    });

    expect(result).toEqual({ providers: 1, models: 1, endpoints: 1 });
    expect(createProviderRepository(db).getById("provider-1")?.name).toBe("Imported Provider");
    expect(createModelRepository(db).getById("model-1")?.modelId).toBe("example-chat");
    expect(createEndpointRepository(db).getById("endpoint-1")?.path).toBe("/chat/completions");

    db.close();
  });
});
