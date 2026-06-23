import type { ProviderErrorCode } from "../errors/providerError.js";
import { ProviderError } from "../errors/providerError.js";
import type { Provider } from "../providers/providerRepository.js";
import type { Endpoint } from "./endpointRepository.js";

interface EndpointTesterInput {
  provider: Provider;
  endpoint: Endpoint;
  apiKey: string;
  input: Record<string, unknown>;
  fetch?: typeof fetch;
}

export interface EndpointTestResult {
  ok: true;
  status: number;
  headers: Record<string, string>;
  bodyPreview: unknown;
  latencyMs: number;
}

interface ErrorBody {
  error?: {
    message?: string;
  };
  message?: string;
}

export async function testEndpoint(input: EndpointTesterInput): Promise<EndpointTestResult> {
  const fetchImpl = input.fetch ?? fetch;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutMs = readTimeout(input.input) ?? 30_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = renderTemplate(input.endpoint.bodyTemplate, input.input);
    const hasBody = body !== null && body !== undefined;
    const headers = {
      authorization: `Bearer ${input.apiKey}`,
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...renderHeaders(input.endpoint.headersTemplate, input.input)
    };

    const response = await fetchImpl(buildUrl(input.provider.baseUrl, input.endpoint.path, input.endpoint.queryTemplate, input.input), {
      method: input.endpoint.method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const headersObject = responseHeadersToObject(response.headers);
    const bodyPreview = await readBodyPreview(response, headersObject);

    if (!response.ok) {
      const providerMessage = extractProviderMessage(bodyPreview) ?? `HTTP ${response.status}`;
      throw new ProviderError(mapStatusToCode(response.status), "Provider request failed", {
        providerMessage,
        statusCode: response.status
      });
    }

    return {
      ok: true,
      status: response.status,
      headers: headersObject,
      bodyPreview,
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError("network_error", "Could not reach provider API", {
      providerMessage: error instanceof Error ? error.message : String(error),
      suggestion: "Check the provider base URL, endpoint path, and network connection."
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildUrl(baseUrl: string, path: string, queryTemplate: Record<string, unknown>, input: Record<string, unknown>) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}${path}`);
  const query = renderTemplate(queryTemplate, input);

  if (query && typeof query === "object" && !Array.isArray(query)) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function renderHeaders(template: Record<string, unknown>, input: Record<string, unknown>) {
  const rendered = renderTemplate(template, input);
  const headers: Record<string, string> = {};

  if (!rendered || typeof rendered !== "object" || Array.isArray(rendered)) return headers;

  for (const [key, value] of Object.entries(rendered)) {
    if (value === undefined || value === null) continue;
    headers[key] = String(value);
  }

  return headers;
}

function renderTemplate(value: unknown, input: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const exact = value.match(/^\{\{input\.([A-Za-z0-9_]+)\}\}$/);
    if (exact) return input[exact[1]] ?? "";

    return value.replace(/\{\{input\.([A-Za-z0-9_]+)\}\}/g, (_match, key: string) => String(input[key] ?? ""));
  }

  if (Array.isArray(value)) return value.map((entry) => renderTemplate(entry, input));

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, renderTemplate(entry, input)]));
  }

  return value;
}

function readTimeout(input: Record<string, unknown>) {
  return typeof input.timeoutMs === "number" && Number.isInteger(input.timeoutMs) && input.timeoutMs > 0
    ? input.timeoutMs
    : undefined;
}

function responseHeadersToObject(headers: Headers) {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key] = value;
  });
  return output;
}

async function readBodyPreview(response: Response, headers: Record<string, string>) {
  const contentType = headers["content-type"] ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return "";
  }
}

function extractProviderMessage(body: unknown) {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const errorBody = body as ErrorBody;
    return errorBody.error?.message ?? errorBody.message;
  }

  return undefined;
}

function mapStatusToCode(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "invalid_api_key";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  return "provider_error";
}
