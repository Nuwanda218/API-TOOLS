import { describe, expect, it, vi } from "vitest";
import type { Model } from "../providers/modelRepository.js";
import { DEFAULT_PROVIDER_CAPABILITIES, type Provider } from "../providers/providerRepository.js";
import { createOpenAIResponsesAdapter } from "./openaiResponses.js";

const provider: Provider = {
  id: "provider-1",
  name: "Responses",
  type: "openai-compatible",
  apiFormat: "openai-responses",
  baseUrl: "https://example.test/v1",
  apiKeyEnv: "RESPONSES_KEY",
  capabilities: DEFAULT_PROVIDER_CAPABILITIES,
  enabled: true,
  createdAt: "now",
  updatedAt: "now"
};

const model: Model = {
  id: "model-1",
  providerId: "provider-1",
  displayName: "Responses Chat",
  modelId: "responses-chat",
  capability: "chat",
  enabled: true,
  defaultParams: {},
  pricing: {},
  createdAt: "now",
  updatedAt: "now"
};

describe("openaiResponsesAdapter", () => {
  it("runs chat through OpenAI Responses API shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output_text: "Responses reply",
        usage: { input_tokens: 7, output_tokens: 4 }
      })
    });
    const adapter = createOpenAIResponsesAdapter({ fetch: fetchMock });

    const result = await adapter.runChat({
      provider,
      model,
      apiKey: "secret",
      messages: [{ role: "user", content: "Hello" }]
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer secret",
          "content-type": "application/json"
        }),
        body: expect.any(String)
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: "responses-chat",
      input: [{ role: "user", content: "Hello" }]
    });
    expect(result).toMatchObject({
      content: "Responses reply",
      usage: { inputTokens: 7, outputTokens: 4 }
    });
  });

  it("extracts nested Responses output text", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output: [
          {
            content: [
              { type: "output_text", text: "Nested reply" }
            ]
          }
        ],
        usage: { input_tokens: 5, output_tokens: 2 }
      })
    });
    const adapter = createOpenAIResponsesAdapter({ fetch: fetchMock });

    const result = await adapter.runChat({
      provider,
      model,
      apiKey: "secret",
      messages: [{ role: "user", content: "Hello" }]
    });

    expect(result.content).toBe("Nested reply");
  });

  it("maps Responses API provider errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "bad key" } })
    });
    const adapter = createOpenAIResponsesAdapter({ fetch: fetchMock });

    await expect(adapter.runChat({
      provider,
      model,
      apiKey: "bad",
      messages: [{ role: "user", content: "Hello" }]
    })).rejects.toMatchObject({
      code: "invalid_api_key",
      statusCode: 401,
      providerMessage: "bad key"
    });
  });
});
