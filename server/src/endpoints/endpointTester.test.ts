import { describe, expect, it, vi } from "vitest";
import type { Endpoint } from "./endpointRepository.js";
import { testEndpoint } from "./endpointTester.js";
import type { Provider } from "../providers/providerRepository.js";
import { DEFAULT_PROVIDER_CAPABILITIES } from "../providers/providerRepository.js";

const provider: Provider = {
  id: "provider-1",
  name: "Example",
  type: "openai-compatible",
  apiFormat: "openai-chat-completions",
  baseUrl: "https://example.test/v1/",
  apiKeyEnv: "EXAMPLE_KEY",
  capabilities: DEFAULT_PROVIDER_CAPABILITIES,
  enabled: true,
  createdAt: "now",
  updatedAt: "now"
};

const endpoint: Endpoint = {
  id: "endpoint-1",
  providerId: "provider-1",
  name: "Create thing",
  operationId: "http.request",
  method: "POST",
  path: "/things",
  queryTemplate: { q: "{{input.query}}", page: 2 },
  headersTemplate: { "x-trace": "{{input.traceId}}" },
  bodyTemplate: { name: "{{input.name}}" },
  enabled: true,
  createdAt: "now",
  updatedAt: "now"
};

describe("endpoint tester", () => {
  it("builds requests from endpoint templates and parses JSON responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ id: "thing-1" }),
      text: async () => JSON.stringify({ id: "thing-1" })
    });

    const result = await testEndpoint({
      provider,
      endpoint,
      apiKey: "secret",
      input: {
        query: "hello",
        traceId: "trace-1",
        name: "Demo"
      },
      fetch: fetchMock
    });

    expect(fetchMock).toHaveBeenCalledWith("https://example.test/v1/things?q=hello&page=2", {
      method: "POST",
      headers: {
        authorization: "Bearer secret",
        "content-type": "application/json",
        "x-trace": "trace-1"
      },
      body: JSON.stringify({ name: "Demo" }),
      signal: expect.any(AbortSignal)
    });
    expect(result).toMatchObject({
      ok: true,
      status: 201,
      bodyPreview: { id: "thing-1" },
      headers: { "content-type": "application/json" },
      latencyMs: expect.any(Number)
    });
  });

  it("maps provider HTTP errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: { message: "bad key" } }),
      text: async () => JSON.stringify({ error: { message: "bad key" } })
    });

    await expect(testEndpoint({
      provider,
      endpoint,
      apiKey: "secret",
      input: {},
      fetch: fetchMock
    })).rejects.toMatchObject({
      code: "invalid_api_key",
      statusCode: 401,
      providerMessage: "bad key"
    });
  });
});
