import { describe, expect, it } from "vitest";
import type { Model } from "../providers/modelRepository.js";
import { DEFAULT_PROVIDER_CAPABILITIES, type Provider } from "../providers/providerRepository.js";
import type { ModelAdapter } from "./types.js";
import { createAdapterRegistry } from "./registry.js";

function fakeAdapter(label: string): ModelAdapter {
  return {
    listModels: async () => [{ id: `${label}-model` }],
    testModel: async () => ({ ok: true, latencyMs: 1, message: label, usage: {} }),
    runChat: async () => ({ content: label, latencyMs: 1, usage: {} })
  };
}

function provider(apiFormat: Provider["apiFormat"]): Provider {
  return {
    id: `provider-${apiFormat}`,
    name: apiFormat,
    type: "openai-compatible",
    apiFormat,
    baseUrl: "https://example.test/v1",
    apiKeyEnv: "CUSTOM_KEY",
    capabilities: DEFAULT_PROVIDER_CAPABILITIES,
    enabled: true,
    createdAt: "now",
    updatedAt: "now"
  };
}

function fakeModel(): Model {
  return {
    id: "model-1",
    providerId: "provider-openai-chat-completions",
    displayName: "Fast Chat",
    modelId: "fast-chat",
    capability: "chat",
    enabled: true,
    defaultParams: {},
    pricing: {},
    createdAt: "now",
    updatedAt: "now"
  };
}

describe("adapter registry", () => {
  it("selects model adapters by provider API format", () => {
    const chatCompletionsAdapter = fakeAdapter("chat");
    const responsesAdapter = fakeAdapter("responses");
    const claudeMessagesAdapter = fakeAdapter("claude");
    const registry = createAdapterRegistry({ chatCompletionsAdapter, responsesAdapter, claudeMessagesAdapter });

    expect(registry.getModelAdapter(provider("openai-chat-completions"))).toBe(chatCompletionsAdapter);
    expect(registry.getModelAdapter(provider("openai-responses"))).toBe(responsesAdapter);
    expect(registry.getModelAdapter(provider("claude-messages"))).toBe(claudeMessagesAdapter);
  });

  it("invokes llm.chat through the generic API adapter path", async () => {
    const chatCompletionsAdapter = fakeAdapter("chat");
    const registry = createAdapterRegistry({ chatCompletionsAdapter });

    const result = await registry.invoke({
      operationId: "llm.chat",
      provider: provider("openai-chat-completions"),
      apiKey: "secret",
      resource: { kind: "model", model: fakeModel() },
      input: { messages: [{ role: "user", content: "Hello" }] }
    });

    expect(result).toEqual({
      ok: true,
      data: { content: "chat" },
      usage: {},
      latencyMs: 1,
      raw: undefined
    });
  });
});
