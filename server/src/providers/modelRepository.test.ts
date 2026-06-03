import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../test/testDb.js";
import { createModelRepository } from "./modelRepository.js";
import { createProviderRepository } from "./providerRepository.js";

describe("ModelRepository", () => {
  it("creates, reads, lists, updates, and deletes models", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);

    providers.create({
      id: "provider-deepseek",
      name: "DeepSeek",
      type: "openai-compatible",
      baseUrl: "https://api.deepseek.com",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      enabled: true
    });

    const created = models.create({
      id: "model-deepseek-chat",
      providerId: "provider-deepseek",
      displayName: "DeepSeek Chat",
      modelId: "deepseek-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {
        temperature: 0.4,
        maxTokens: 1000
      },
      pricing: {
        inputTokenPrice: 0.14,
        outputTokenPrice: 0.28
      }
    });

    expect(created).toMatchObject({
      id: "model-deepseek-chat",
      providerId: "provider-deepseek",
      displayName: "DeepSeek Chat",
      modelId: "deepseek-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {
        temperature: 0.4,
        maxTokens: 1000
      },
      pricing: {
        inputTokenPrice: 0.14,
        outputTokenPrice: 0.28
      }
    });

    expect(models.getById("model-deepseek-chat")).toEqual(created);
    expect(models.list()).toEqual([created]);
    expect(models.listByProvider("provider-deepseek")).toEqual([created]);

    const updated = models.update("model-deepseek-chat", {
      displayName: "DeepSeek Chat Fast",
      enabled: false,
      defaultParams: {
        temperature: 0.2
      }
    });

    expect(updated).toMatchObject({
      id: "model-deepseek-chat",
      displayName: "DeepSeek Chat Fast",
      enabled: false,
      defaultParams: {
        temperature: 0.2
      },
      pricing: {
        inputTokenPrice: 0.14,
        outputTokenPrice: 0.28
      }
    });

    expect(models.delete("model-deepseek-chat")).toBe(true);
    expect(models.getById("model-deepseek-chat")).toBeUndefined();
    expect(models.delete("model-deepseek-chat")).toBe(false);

    db.close();
  });

  it("deletes models when the provider is deleted", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);

    providers.create({
      id: "provider-openai",
      name: "OpenAI",
      type: "openai-official",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      enabled: true
    });
    models.create({
      id: "model-gpt-4o-mini",
      providerId: "provider-openai",
      displayName: "GPT-4o mini",
      modelId: "gpt-4o-mini",
      capability: "chat",
      enabled: true
    });

    providers.delete("provider-openai");

    expect(models.list()).toEqual([]);

    db.close();
  });

  it("generates ids when callers do not provide one", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);

    const provider = providers.create({
      name: "OpenAI",
      type: "openai-official",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      enabled: true
    });
    const created = models.create({
      providerId: provider.id,
      displayName: "GPT-4o mini",
      modelId: "gpt-4o-mini",
      capability: "chat",
      enabled: true
    });

    expect(created.id).toEqual(expect.any(String));
    expect(created.id.length).toBeGreaterThan(0);

    db.close();
  });

  it("finds models by provider id and model id", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);

    const firstProvider = providers.create({
      id: "provider-first",
      name: "First",
      type: "openai-compatible",
      baseUrl: "https://first.example/v1",
      apiKeyEnv: "FIRST_KEY",
      enabled: true
    });
    const secondProvider = providers.create({
      id: "provider-second",
      name: "Second",
      type: "openai-compatible",
      baseUrl: "https://second.example/v1",
      apiKeyEnv: "SECOND_KEY",
      enabled: true
    });
    const created = models.create({
      providerId: firstProvider.id,
      displayName: "Shared model",
      modelId: "shared-model",
      capability: "chat",
      enabled: true
    });

    expect(models.findByProviderAndModelId(firstProvider.id, "shared-model")).toEqual(created);
    expect(models.findByProviderAndModelId(secondProvider.id, "shared-model")).toBeUndefined();

    db.close();
  });
});
