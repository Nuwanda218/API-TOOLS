import { describe, expect, it, vi } from "vitest";
import type { Model } from "../providers/modelRepository.js";
import { DEFAULT_PROVIDER_CAPABILITIES, type Provider } from "../providers/providerRepository.js";
import { createOpenAIChatCompletionsAdapter } from "./openaiChatCompletions.js";

const provider: Provider = {
  id: "provider-1",
  name: "Custom",
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

describe("openaiChatCompletionsAdapter", () => {
  it("tests a model using chat completions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 4, completion_tokens: 1 }
      })
    });
    const adapter = createOpenAIChatCompletionsAdapter({ fetch: fetchMock });

    const result = await adapter.testModel({
      provider,
      model,
      apiKey: "secret"
    });

    expect(result).toEqual({
      ok: true,
      latencyMs: expect.any(Number),
      message: "ok",
      usage: { inputTokens: 4, outputTokens: 1 }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer secret",
          "content-type": "application/json"
        }),
        body: expect.any(String)
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: "fast-chat",
      messages: [{ role: "user", content: "Reply with ok." }]
    });
  });

  it("runs chat with model default params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "hello" } }],
        usage: { prompt_tokens: 6, completion_tokens: 2 }
      })
    });
    const adapter = createOpenAIChatCompletionsAdapter({ fetch: fetchMock });

    const result = await adapter.runChat({
      provider,
      model: {
        ...model,
        defaultParams: {
          temperature: 0.2,
          maxTokens: 512
        }
      },
      apiKey: "secret",
      messages: [{ role: "user", content: "Hi" }]
    });

    expect(result).toEqual({
      content: "hello",
      latencyMs: expect.any(Number),
      usage: { inputTokens: 6, outputTokens: 2 }
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      temperature: 0.2,
      max_tokens: 512
    });
  });

  it("standardizes provider errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "invalid key" } })
    });
    const adapter = createOpenAIChatCompletionsAdapter({ fetch: fetchMock });

    await expect(adapter.testModel({
      provider,
      model,
      apiKey: "secret"
    })).rejects.toMatchObject({
      code: "invalid_api_key",
      statusCode: 401,
      providerMessage: "invalid key"
    });
  });

  it("standardizes network errors", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNRESET"));
    const adapter = createOpenAIChatCompletionsAdapter({ fetch: fetchMock });

    await expect(adapter.testModel({
      provider,
      model,
      apiKey: "secret"
    })).rejects.toMatchObject({
      code: "network_error",
      providerMessage: "ECONNRESET"
    });
  });

  it("lists remote models", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: "gpt-4.1-mini", owned_by: "openai" },
          { id: "gpt-4.1-nano" }
        ]
      })
    });
    const adapter = createOpenAIChatCompletionsAdapter({ fetch: fetchMock });

    const result = await adapter.listModels({
      provider,
      apiKey: "secret"
    });

    expect(result).toEqual([
      { id: "gpt-4.1-mini", ownedBy: "openai" },
      { id: "gpt-4.1-nano" }
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/models",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          authorization: "Bearer secret"
        })
      })
    );
  });

  it("standardizes remote model listing provider errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "invalid key" } })
    });
    const adapter = createOpenAIChatCompletionsAdapter({ fetch: fetchMock });

    await expect(adapter.listModels({
      provider,
      apiKey: "secret"
    })).rejects.toMatchObject({
      code: "invalid_api_key",
      statusCode: 401,
      providerMessage: "invalid key"
    });
  });
});
