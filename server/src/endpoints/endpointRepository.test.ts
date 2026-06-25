import { describe, expect, it } from "vitest";
import { createProviderRepository } from "../providers/providerRepository.js";
import { createTestDatabase } from "../test/testDb.js";
import { createEndpointRepository } from "./endpointRepository.js";

describe("endpoint repository", () => {
  it("creates, lists, gets, updates, and deletes endpoints", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const endpoints = createEndpointRepository(db);
    const provider = providers.create({
      name: "TJU",
      type: "openai-compatible",
      apiFormat: "openai-chat-completions",
      baseUrl: "https://ai.tju.edu.cn/api/v3",
      apiKeyEnv: "TJU_API_KEY",
      enabled: true
    });

    const endpoint = endpoints.create({
      providerId: provider.id,
      name: "Chat completions",
      operationId: "http.request",
      method: "POST",
      path: "/chat/completions",
      queryTemplate: { stream: false },
      headersTemplate: { "content-type": "application/json" },
      bodyTemplate: { model: "{{input.model}}", messages: "{{input.messages}}" },
      enabled: true
    });

    expect(endpoint).toMatchObject({
      providerId: provider.id,
      name: "Chat completions",
      operationId: "http.request",
      method: "POST",
      path: "/chat/completions",
      queryTemplate: { stream: false },
      headersTemplate: { "content-type": "application/json" },
      bodyTemplate: { model: "{{input.model}}", messages: "{{input.messages}}" },
      enabled: true
    });
    expect(endpoints.getById(endpoint.id)).toEqual(endpoint);
    expect(endpoints.list()).toEqual([endpoint]);
    expect(endpoints.listByProvider(provider.id)).toEqual([endpoint]);

    const updated = endpoints.update(endpoint.id, {
      name: "Chat no stream",
      method: "GET",
      path: "/models",
      enabled: false,
      queryTemplate: {},
      headersTemplate: {},
      bodyTemplate: null
    });

    expect(updated).toMatchObject({
      id: endpoint.id,
      name: "Chat no stream",
      method: "GET",
      path: "/models",
      enabled: false,
      queryTemplate: {},
      headersTemplate: {},
      bodyTemplate: null
    });
    expect(endpoints.delete(endpoint.id)).toBe(true);
    expect(endpoints.delete(endpoint.id)).toBe(false);
    expect(endpoints.list()).toEqual([]);

    db.close();
  });

  it("deletes endpoints when the provider is deleted", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const endpoints = createEndpointRepository(db);
    const provider = providers.create({
      name: "Provider",
      type: "openai-compatible",
      apiFormat: "openai-chat-completions",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "EXAMPLE_KEY",
      enabled: true
    });

    endpoints.create({
      providerId: provider.id,
      name: "Models",
      operationId: "http.request",
      method: "GET",
      path: "/models"
    });

    expect(endpoints.list()).toHaveLength(1);
    expect(providers.delete(provider.id)).toBe(true);
    expect(endpoints.list()).toEqual([]);

    db.close();
  });
});
