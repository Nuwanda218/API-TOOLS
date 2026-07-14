/**
 * Tests for LlmClient — the lightweight LLM calling layer for agents.
 */

import { describe, expect, it } from "vitest";
import type { ModelAdapter } from "../adapters/types.js";
import { createAdapterRegistry } from "../adapters/registry.js";
import { createProviderRepository, DEFAULT_PROVIDER_CAPABILITIES } from "../providers/providerRepository.js";
import { createModelRepository } from "../providers/modelRepository.js";
import { createLlmClient, type LlmClient } from "./LlmClient.js";
import { createTestDatabase } from "../test/testDb.js";

// ── Helpers ──

function fakeModelAdapter(label: string = "fake"): ModelAdapter {
  return {
    listModels: async () => [{ id: `${label}-model` }],
    testModel: async () => ({ ok: true, latencyMs: 1, message: label, usage: {} }),
    runChat: async (input) => ({
      content: `[${label}] ${input.messages[input.messages.length - 1]?.content ?? ""}`,
      latencyMs: 42,
      usage: { inputTokens: 10, outputTokens: 20 },
    }),
  };
}

function setupEnv() {
  return { FAKE_KEY: "sk-test-123" };
}

function setupTestDb() {
  const db = createTestDatabase();
  const providers = createProviderRepository(db);
  const models = createModelRepository(db);

  const provider = providers.create({
    id: "provider-test",
    name: "test-provider",
    type: "openai-compatible",
    apiFormat: "openai-chat-completions",
    baseUrl: "https://test.example/v1",
    apiKeyEnv: "FAKE_KEY",
    enabled: true,
  });

  const model = models.create({
    id: "model-test",
    providerId: provider.id,
    displayName: "Test Model",
    modelId: "test-model-v1",
    capability: "chat",
    enabled: true,
    defaultParams: { temperature: 0.5, maxTokens: 2048 },
    pricing: { inputTokenPrice: 1, outputTokenPrice: 2 },
  });

  return { db, provider, model };
}

function createTestClient(overrides?: { adapter?: ModelAdapter }): LlmClient {
  const { db } = setupTestDb();
  const adapter = overrides?.adapter ?? fakeModelAdapter();
  const registry = createAdapterRegistry({ chatCompletionsAdapter: adapter });

  return createLlmClient({
    db,
    adapterRegistry: registry,
    env: setupEnv(),
  });
}

// ── Tests ──

describe("LlmClient", () => {
  describe("ask()", () => {
    it("returns plain text from a simple prompt", async () => {
      const client = createTestClient();
      const response = await client.ask("Hello");

      expect(response).toMatch(/^\[fake\] Hello$/);
    });

    it("passes system prompt through the adapter", async () => {
      const client = createTestClient();
      const response = await client.ask("User message", "System instruction");

      // The adapter prepends its label, so the content comes back
      expect(response).toContain("User message");
    });
  });

  describe("call()", () => {
    it("returns structured LlmCallResult with usage data", async () => {
      const client = createTestClient();
      const result = await client.call({
        systemPrompt: "Sys",
        userMessage: "Msg",
      });

      expect(result).toMatchObject({
        content: expect.stringContaining("Msg") as string,
        model: "test-model-v1",
        provider: "test-provider",
        latencyMs: expect.any(Number) as number,
        usage: { inputTokens: 10, outputTokens: 20 },
      });
    });
  });

  describe("statistics", () => {
    it("tracks total calls and tokens across ask and call", async () => {
      const client = createTestClient();

      await client.ask("Q1");
      await client.call({ systemPrompt: "S", userMessage: "Q2" });

      expect(client.stats.totalCalls).toBe(2);
      expect(client.stats.totalTokens.inputTokens).toBe(20);  // 10 + 10
      expect(client.stats.totalTokens.outputTokens).toBe(40); // 20 + 20
    });

    it("starts with zero stats before any calls", () => {
      const client = createTestClient();

      expect(client.stats.totalCalls).toBe(0);
      expect(client.stats.totalTokens).toEqual({ inputTokens: 0, outputTokens: 0 });
      expect(client.stats.totalLatencyMs).toBe(0);
    });

    it("clearHistory() resets statistics", async () => {
      const client = createTestClient();
      await client.ask("Q1");
      expect(client.stats.totalCalls).toBe(1);

      client.clearHistory();
      expect(client.stats.totalCalls).toBe(0);
      expect(client.stats.totalTokens).toEqual({ inputTokens: 0, outputTokens: 0 });
    });
  });

  describe("callHistory", () => {
    it("records every call with full details", async () => {
      const client = createTestClient();
      await client.ask("Hello");

      const history = client.callHistory;
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        provider: "test-provider",
        model: "test-model-v1",
        userMessage: "Hello",
        response: expect.stringContaining("Hello") as string,
        latencyMs: expect.any(Number) as number,
        usage: { inputTokens: 10, outputTokens: 20 },
      });
      expect(history[0].timestamp).toBeTruthy();
    });

    it("returns a defensive copy of callHistory", async () => {
      const client = createTestClient();
      await client.ask("Q1");

      const copy1 = client.callHistory;
      const copy2 = client.callHistory;
      expect(copy1).toHaveLength(1);
      expect(copy2).toHaveLength(1);
      expect(copy1).not.toBe(copy2); // different array instances
    });

    it("records error details when a call fails", async () => {
      const failingAdapter: ModelAdapter = {
        listModels: async () => [],
        testModel: async () => ({ ok: true, latencyMs: 1, message: "", usage: {} }),
        runChat: async () => {
          throw Object.assign(new Error("Boom"), { code: "provider_error" });
        },
      };
      const client = createTestClient({ adapter: failingAdapter });

      await expect(client.ask("Q1")).rejects.toThrow();

      // Error still recorded in call history
      expect(client.callHistory).toHaveLength(1);
      expect(client.callHistory[0]).toMatchObject({
        error: expect.stringContaining("Boom") as string,
        response: "",
        usage: { inputTokens: 0, outputTokens: 0 },
      });
    });
  });

  describe("provider/model resolution", () => {
    it("uses the first enabled provider when none specified", async () => {
      const client = createTestClient();
      const result = await client.call({
        systemPrompt: "S",
        userMessage: "M",
      });

      expect(result.provider).toBe("test-provider");
      expect(result.model).toBe("test-model-v1");
    });

    it("throws provider_not_found for unknown provider name", async () => {
      const client = createTestClient();

      await expect(
        client.call({ systemPrompt: "S", userMessage: "M", provider: "nonexistent" })
      ).rejects.toThrow(/not found/i);
    });

    it("throws model_not_found for unknown model name", async () => {
      const client = createTestClient();

      await expect(
        client.call({ systemPrompt: "S", userMessage: "M", model: "nonexistent-model" })
      ).rejects.toThrow(/not found/i);
    });
  });
});
