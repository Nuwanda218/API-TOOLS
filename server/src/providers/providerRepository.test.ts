import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../test/testDb.js";
import { createProviderRepository } from "./providerRepository.js";

describe("ProviderRepository", () => {
  it("creates, reads, lists, updates, and deletes providers", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);

    const created = providers.create({
      id: "provider-openai",
      name: "OpenAI",
      type: "openai-official",
      apiFormat: "openai-chat-completions",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      enabled: true
    });

    expect(created).toMatchObject({
      id: "provider-openai",
      name: "OpenAI",
      type: "openai-official",
      apiFormat: "openai-chat-completions",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      enabled: true,
      capabilities: {
        supportsChat: true,
        supportsModelListing: true,
        supportsManualModelImport: true,
        supportsStreaming: false,
        supportsToolCalling: false,
        supportsVision: false,
        supportsRemoteConversation: false,
        requiresManualModelImport: false
      }
    });
    expect(created.createdAt).toEqual(created.updatedAt);

    expect(providers.getById("provider-openai")).toEqual(created);
    expect(providers.list()).toEqual([created]);

    const updated = providers.update("provider-openai", {
      name: "OpenAI compatible",
      apiFormat: "openai-responses",
      enabled: false
    });

    expect(updated).toMatchObject({
      id: "provider-openai",
      name: "OpenAI compatible",
      apiFormat: "openai-responses",
      enabled: false
    });
    expect(updated?.createdAt).toEqual(created.createdAt);
    expect(updated?.updatedAt).not.toEqual(created.updatedAt);

    expect(providers.delete("provider-openai")).toBe(true);
    expect(providers.getById("provider-openai")).toBeUndefined();
    expect(providers.delete("provider-openai")).toBe(false);

    db.close();
  });

  it("generates ids when callers do not provide one", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);

    const created = providers.create({
      name: "DeepSeek",
      type: "openai-compatible",
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      enabled: true
    });

    expect(created.id).toEqual(expect.any(String));
    expect(created.id.length).toBeGreaterThan(0);
    expect(created.apiFormat).toBe("openai-chat-completions");

    db.close();
  });

  it("stores provider capability overrides", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);

    const created = providers.create({
      id: "provider-tju",
      name: "TJU",
      type: "openai-compatible",
      baseUrl: "https://ai.tju.edu.cn/api/v3",
      apiKeyEnv: "TJU_API_KEY",
      capabilities: {
        supportsModelListing: false,
        requiresManualModelImport: true
      }
    });

    expect(created.capabilities).toEqual({
      supportsChat: true,
      supportsModelListing: false,
      supportsManualModelImport: true,
      supportsStreaming: false,
      supportsToolCalling: false,
      supportsVision: false,
      supportsRemoteConversation: false,
      requiresManualModelImport: true
    });
    expect(providers.getById("provider-tju")?.capabilities).toEqual(created.capabilities);

    const updated = providers.update("provider-tju", {
      capabilities: {
        supportsStreaming: true,
        supportsVision: true
      }
    });

    expect(updated?.capabilities).toEqual({
      supportsChat: true,
      supportsModelListing: false,
      supportsManualModelImport: true,
      supportsStreaming: true,
      supportsToolCalling: false,
      supportsVision: true,
      supportsRemoteConversation: false,
      requiresManualModelImport: true
    });

    db.close();
  });
});
