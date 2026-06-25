import { describe, expect, it, vi } from "vitest";
import type { Model } from "../providers/modelRepository.js";
import { DEFAULT_PROVIDER_CAPABILITIES, type Provider } from "../providers/providerRepository.js";
import type { ModelAdapter } from "./types.js";
import { createModelApiBridge } from "./modelApiBridge.js";

const provider: Provider = {
  id: "provider-1",
  name: "Provider",
  type: "openai-compatible",
  apiFormat: "openai-chat-completions",
  baseUrl: "https://example.test/v1",
  apiKeyEnv: "CUSTOM_KEY",
  capabilities: DEFAULT_PROVIDER_CAPABILITIES,
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

describe("model API bridge", () => {
  it("invokes llm.chat through an existing ModelAdapter", async () => {
    const modelAdapter: ModelAdapter = {
      listModels: vi.fn(),
      testModel: vi.fn(),
      runChat: vi.fn().mockResolvedValue({
        content: "Bridge reply",
        latencyMs: 9,
        usage: { inputTokens: 2, outputTokens: 3 }
      })
    };
    const bridge = createModelApiBridge("openai-chat-completions", modelAdapter);

    const result = await bridge.invoke({
      operationId: "llm.chat",
      provider,
      apiKey: "secret",
      resource: { kind: "model", model },
      input: { messages: [{ role: "user", content: "Hello" }] }
    });

    expect(result).toEqual({
      ok: true,
      data: { content: "Bridge reply" },
      usage: { inputTokens: 2, outputTokens: 3 },
      latencyMs: 9,
      raw: undefined
    });
    expect(modelAdapter.runChat).toHaveBeenCalledWith({
      provider,
      model,
      apiKey: "secret",
      messages: [{ role: "user", content: "Hello" }]
    });
  });

  it("rejects llm.chat without a model resource", async () => {
    const bridge = createModelApiBridge("openai-chat-completions", {
      listModels: vi.fn(),
      testModel: vi.fn(),
      runChat: vi.fn()
    });

    const result = await bridge.invoke({
      operationId: "llm.chat",
      provider,
      apiKey: "secret",
      resource: { kind: "none" },
      input: { messages: [{ role: "user", content: "Hello" }] }
    });

    expect(result).toMatchObject({
      ok: false,
      code: "invalid_api_resource"
    });
  });

  it("rejects llm.chat input with invalid message role before calling the model adapter", async () => {
    const modelAdapter: ModelAdapter = {
      listModels: vi.fn(async () => []),
      testModel: vi.fn(async () => ({ ok: true as const, latencyMs: 1, message: "ok", usage: {} })),
      runChat: vi.fn(async () => ({ content: "unused", latencyMs: 1, usage: {} }))
    };
    const bridge = createModelApiBridge("bridge", modelAdapter);

    const result = await bridge.invoke({
      operationId: "llm.chat",
      provider,
      apiKey: "secret",
      resource: { kind: "model", model },
      input: { messages: [{ role: "tool", content: "bad" }] }
    });

    expect(result).toEqual({
      ok: false,
      code: "invalid_workflow_step",
      message: "llm.chat message at index 0 has invalid role."
    });
    expect(modelAdapter.runChat).not.toHaveBeenCalled();
  });

  it("rejects llm.chat input with empty messages before calling the model adapter", async () => {
    const modelAdapter: ModelAdapter = {
      listModels: vi.fn(async () => []),
      testModel: vi.fn(async () => ({ ok: true as const, latencyMs: 1, message: "ok", usage: {} })),
      runChat: vi.fn(async () => ({ content: "unused", latencyMs: 1, usage: {} }))
    };
    const bridge = createModelApiBridge("bridge", modelAdapter);

    const result = await bridge.invoke({
      operationId: "llm.chat",
      provider,
      apiKey: "secret",
      resource: { kind: "model", model },
      input: { messages: [] }
    });

    expect(result).toEqual({
      ok: false,
      code: "invalid_workflow_step",
      message: "llm.chat requires at least one message."
    });
    expect(modelAdapter.runChat).not.toHaveBeenCalled();
  });
});
