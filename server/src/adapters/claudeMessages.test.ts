import { describe, expect, it, vi } from "vitest";
import type { Model } from "../providers/modelRepository.js";
import { DEFAULT_PROVIDER_CAPABILITIES, type Provider } from "../providers/providerRepository.js";
import { createClaudeMessagesAdapter } from "./claudeMessages.js";

const provider: Provider = {
  id: "provider-1",
  name: "Claude",
  type: "openai-compatible",
  apiFormat: "claude-messages",
  baseUrl: "https://api.anthropic.com/v1",
  apiKeyEnv: "ANTHROPIC_API_KEY",
  capabilities: DEFAULT_PROVIDER_CAPABILITIES,
  enabled: true,
  createdAt: "now",
  updatedAt: "now"
};

const model: Model = {
  id: "model-1",
  providerId: "provider-1",
  displayName: "Claude Sonnet",
  modelId: "claude-3-5-sonnet-latest",
  capability: "chat",
  enabled: true,
  defaultParams: {},
  pricing: {},
  createdAt: "now",
  updatedAt: "now"
};

describe("claudeMessagesAdapter", () => {
  it("runs chat through Claude Messages API shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: "text", text: "Claude reply" }],
        usage: { input_tokens: 9, output_tokens: 3 }
      })
    });
    const adapter = createClaudeMessagesAdapter({ fetch: fetchMock });

    const result = await adapter.runChat({
      provider,
      model: {
        ...model,
        defaultParams: {
          temperature: 0.3,
          maxTokens: 512
        }
      },
      apiKey: "secret",
      messages: [
        { role: "system", content: "Use concise language." },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" }
      ]
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "secret",
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        }),
        body: expect.any(String)
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 512,
      temperature: 0.3,
      system: "Use concise language.",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" }
      ]
    });
    expect(result).toMatchObject({
      content: "Claude reply",
      usage: { inputTokens: 9, outputTokens: 3 }
    });
  });

  it("maps Claude provider errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "rate limit" } })
    });
    const adapter = createClaudeMessagesAdapter({ fetch: fetchMock });

    await expect(adapter.runChat({
      provider,
      model,
      apiKey: "secret",
      messages: [{ role: "user", content: "Hello" }]
    })).rejects.toMatchObject({
      code: "rate_limited",
      statusCode: 429,
      providerMessage: "rate limit"
    });
  });
});
