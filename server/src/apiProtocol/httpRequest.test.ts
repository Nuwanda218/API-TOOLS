import { describe, expect, it } from "vitest";
import { parseHttpRequestInput } from "./httpRequest.js";

describe("http.request input contract", () => {
  it("accepts method, path, headers, query, body, and timeout", () => {
    expect(parseHttpRequestInput({
      method: "POST",
      path: "/v1/search",
      query: { q: "api tools", page: 2, safe: true },
      headers: { "x-request-id": "run-1" },
      body: { prompt: "hello" },
      timeoutMs: 5000
    })).toEqual({
      ok: true,
      input: {
        method: "POST",
        path: "/v1/search",
        query: { q: "api tools", page: 2, safe: true },
        headers: { "x-request-id": "run-1" },
        body: { prompt: "hello" },
        timeoutMs: 5000
      }
    });
  });

  it("rejects invalid method, path, query, headers, and timeout", () => {
    expect(parseHttpRequestInput({ method: "CONNECT", path: "/v1" })).toEqual({
      ok: false,
      message: "http.request method must be one of GET, POST, PUT, PATCH, DELETE."
    });
    expect(parseHttpRequestInput({ method: "GET", path: "https://example.test/v1" })).toEqual({
      ok: false,
      message: "http.request path must start with '/'."
    });
    expect(parseHttpRequestInput({ method: "GET", path: "/v1", query: { q: null } })).toEqual({
      ok: false,
      message: "http.request query values must be string, number, or boolean."
    });
    expect(parseHttpRequestInput({ method: "GET", path: "/v1", headers: { authorization: 42 } })).toEqual({
      ok: false,
      message: "http.request headers must be string values."
    });
    expect(parseHttpRequestInput({ method: "GET", path: "/v1", timeoutMs: 0 })).toEqual({
      ok: false,
      message: "http.request timeoutMs must be a positive integer."
    });
  });
});
