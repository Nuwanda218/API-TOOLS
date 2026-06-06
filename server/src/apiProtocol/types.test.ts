import { describe, expect, it } from "vitest";
import type { Model } from "../providers/modelRepository.js";
import type { Provider } from "../providers/providerRepository.js";
import type { ApiInvocation, ApiInvocationResult, LlmChatData, LlmChatInput } from "./types.js";
import { isCoreOperation } from "./types.js";

const provider: Provider = {
  id: "provider-1",
  name: "Provider",
  type: "openai-compatible",
  apiFormat: "openai-chat-completions",
  baseUrl: "https://example.test/v1",
  apiKeyEnv: "CUSTOM_KEY",
  enabled: true,
  createdAt: "now",
  updatedAt: "now"
};

const model: Model = {
  id: "model-1",
  providerId: "provider-1",
  displayName: "Fast Chat",
  modelId: "fast-chat",
  capability: "chat",
  enabled: true,
  defaultParams: {},
  pricing: {},
  createdAt: "now",
  updatedAt: "now"
};

describe("generic API protocol types", () => {
  it("represents llm.chat as a provider-independent invocation", () => {
    const invocation: ApiInvocation<LlmChatInput> = {
      operationId: "llm.chat",
      provider,
      apiKey: "secret",
      resource: { kind: "model", model },
      input: {
        messages: [{ role: "user", content: "Hello" }]
      }
    };

    const result: ApiInvocationResult<LlmChatData> = {
      ok: true,
      data: { content: "Hi" },
      usage: { inputTokens: 1, outputTokens: 1 },
      latencyMs: 3
    };

    expect(invocation.operationId).toBe("llm.chat");
    expect(isCoreOperation(invocation.operationId)).toBe(true);
    expect(isCoreOperation("weather.current")).toBe(false);
    expect(invocation.resource.kind).toBe("model");
    expect(result.data.content).toBe("Hi");
  });
});
