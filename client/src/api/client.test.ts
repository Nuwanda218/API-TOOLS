import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, apiClient } from "./client";

describe("apiClient errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("throws structured errors with backend code and provider message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          code: "missing_api_key",
          message: "Missing API key env var: DEEPSEEK_API_KEY",
          providerMessage: "env var not found",
          statusCode: 400
        })
      })
    );

    await expect(apiClient.listProviders()).rejects.toMatchObject({
      code: "missing_api_key",
      message: "Missing API key env var: DEEPSEEK_API_KEY",
      providerMessage: "env var not found",
      statusCode: 400,
      log: "missing_api_key: Missing API key env var: DEEPSEEK_API_KEY | env var not found"
    });
  });

  it("falls back to invalid_request for legacy error responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "invalid_request" })
      })
    );

    await expect(apiClient.listProviders()).rejects.toBeInstanceOf(ApiClientError);
    await expect(apiClient.listProviders()).rejects.toMatchObject({
      code: "invalid_request",
      message: "invalid_request",
      statusCode: 400
    });
  });
});
