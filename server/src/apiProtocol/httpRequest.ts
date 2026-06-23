export type HttpRequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpRequestInput {
  method: HttpRequestMethod;
  path: string;
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export type HttpRequestInputParseResult =
  | { ok: true; input: HttpRequestInput }
  | { ok: false; message: string };

const allowedMethods = new Set<HttpRequestMethod>(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export function parseHttpRequestInput(input: Record<string, unknown>): HttpRequestInputParseResult {
  const method = input.method;
  if (typeof method !== "string" || !allowedMethods.has(method as HttpRequestMethod)) {
    return { ok: false, message: "http.request method must be one of GET, POST, PUT, PATCH, DELETE." };
  }

  const path = input.path;
  if (typeof path !== "string" || !path.startsWith("/")) {
    return { ok: false, message: "http.request path must start with '/'." };
  }

  const parsed: HttpRequestInput = {
    method: method as HttpRequestMethod,
    path
  };

  if (input.query !== undefined) {
    if (!isRecord(input.query)) {
      return { ok: false, message: "http.request query must be an object." };
    }

    const query: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(input.query)) {
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        return { ok: false, message: "http.request query values must be string, number, or boolean." };
      }
      query[key] = value;
    }
    parsed.query = query;
  }

  if (input.headers !== undefined) {
    if (!isRecord(input.headers)) {
      return { ok: false, message: "http.request headers must be an object." };
    }

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.headers)) {
      if (typeof value !== "string") {
        return { ok: false, message: "http.request headers must be string values." };
      }
      headers[key] = value;
    }
    parsed.headers = headers;
  }

  if ("body" in input) {
    parsed.body = input.body;
  }

  if (input.timeoutMs !== undefined) {
    if (typeof input.timeoutMs !== "number" || !Number.isInteger(input.timeoutMs) || input.timeoutMs <= 0) {
      return { ok: false, message: "http.request timeoutMs must be a positive integer." };
    }
    parsed.timeoutMs = input.timeoutMs;
  }

  return { ok: true, input: parsed };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
