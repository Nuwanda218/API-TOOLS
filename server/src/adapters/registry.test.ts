import { describe, expect, it } from "vitest";
import type { Provider } from "../providers/providerRepository.js";
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
    enabled: true,
    createdAt: "now",
    updatedAt: "now"
  };
}

describe("adapter registry", () => {
  it("selects model adapters by provider API format", () => {
    const chatCompletionsAdapter = fakeAdapter("chat");
    const responsesAdapter = fakeAdapter("responses");
    const registry = createAdapterRegistry({ chatCompletionsAdapter, responsesAdapter });

    expect(registry.getModelAdapter(provider("openai-chat-completions"))).toBe(chatCompletionsAdapter);
    expect(registry.getModelAdapter(provider("openai-responses"))).toBe(responsesAdapter);
  });
});
