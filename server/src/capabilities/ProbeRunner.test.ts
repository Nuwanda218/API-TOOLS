/**
 * Tests for ProbeRunner — model capability probing.
 */

import { describe, expect, it } from "vitest";
import type { ModelAdapter, ChatRunInput, ChatRunResult } from "../adapters/types.js";
import { DEFAULT_PROVIDER_CAPABILITIES, type Provider } from "../providers/providerRepository.js";
import type { Model } from "../providers/modelRepository.js";
import { runCapabilityProbes, quickProbe, type ProbeTarget } from "./ProbeRunner.js";
import type { CapabilityResult } from "./types.js";

// ── Helpers ──

function fakeProvider(): Provider {
  return {
    id: "provider-test",
    name: "test-provider",
    type: "openai-compatible",
    apiFormat: "openai-chat-completions",
    baseUrl: "https://test.example/v1",
    apiKeyEnv: "TEST_KEY",
    capabilities: DEFAULT_PROVIDER_CAPABILITIES,
    enabled: true,
    createdAt: "now",
    updatedAt: "now",
  };
}

function fakeModel(): Model {
  return {
    id: "model-test",
    providerId: "provider-test",
    displayName: "Test Model",
    modelId: "test-model-v1",
    capability: "chat",
    enabled: true,
    defaultParams: {},
    pricing: {},
    createdAt: "now",
    updatedAt: "now",
  };
}

function fakeTarget(): ProbeTarget {
  return {
    provider: fakeProvider(),
    model: fakeModel(),
    apiKey: "sk-test",
  };
}

/**
 * Creates a fake ModelAdapter that echoes back a predictable response.
 * `responseFor` is called with the user message; return the chat result.
 */
function fakeAdapter(
  responseFor?: (input: ChatRunInput) => ChatRunResult | Error
): ModelAdapter {
  return {
    listModels: async () => [{ id: "test-model" }],
    testModel: async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} }),
    runChat: async (input: ChatRunInput): Promise<ChatRunResult> => {
      const result = responseFor?.(input);
      if (result instanceof Error) throw result;
      return (
        result ?? {
          content: '{"name":"test","count":42,"valid":true}',
          latencyMs: 10,
          usage: { inputTokens: 5, outputTokens: 15 },
        }
      );
    },
  };
}

// ── Tests ──

describe("runCapabilityProbes", () => {
  it("runs all 4 core probes and returns structured result", async () => {
    const adapter = fakeAdapter();
    const result = await runCapabilityProbes(adapter, fakeTarget());

    expect(result.modelId).toBe("test-model-v1");
    expect(result.providerName).toBe("test-provider");
    expect(result.probedAt).toBeTruthy();

    // All 4 probes should have results
    expect(result.textInput.state).toBe("pass");
    expect(result.jsonOutput.state).toBe("pass");
    expect(result.stream.state).toBe("pass");
    expect(result.tools.state).toBe("pass");

    // No concurrency probe by default
    expect(result.concurrency).toBeUndefined();
  });

  it("detects JSON output failure", async () => {
    const adapter = fakeAdapter(() => ({
      content: "This is not JSON at all.",
      latencyMs: 10,
      usage: {},
    }));

    const result = await runCapabilityProbes(adapter, fakeTarget());

    expect(result.jsonOutput.state).toBe("partial");
    expect(result.jsonOutput.note).toContain("Not valid JSON");
  });

  it("handles adapter errors gracefully", async () => {
    const adapter = fakeAdapter(() => {
      throw new Error("Network timeout");
    });

    const result = await runCapabilityProbes(adapter, fakeTarget());

    // All probes should fail
    expect(result.textInput.state).toBe("fail");
    expect(result.textInput.note).toContain("Network timeout");
    expect(result.jsonOutput.state).toBe("fail");
    expect(result.stream.state).toBe("fail");
    expect(result.tools.state).toBe("fail");
  });

  it("collects notes from all probes", async () => {
    const adapter = fakeAdapter();
    const result = await runCapabilityProbes(adapter, fakeTarget());

    expect(result.notes.length).toBeGreaterThanOrEqual(4);
    expect(result.notes.some((n) => n.includes("chars"))).toBe(true);
  });

  it("runs concurrency probe when options.concurrency is true", async () => {
    const adapter = fakeAdapter();
    const result = await runCapabilityProbes(adapter, fakeTarget(), {
      concurrency: true,
      maxConcurrency: 4,
    });

    expect(result.concurrency).toBeDefined();
    // With maxConcurrency=4, safeConcurrency=4 → "partial" (needs >= 32 for "pass")
    expect(result.concurrency!.state).toBe("partial");
    expect(result.concurrency!.safeConcurrency).toBeGreaterThanOrEqual(1);
    expect(result.concurrency!.details).toHaveLength(3); // levels [1, 2, 4]
  });
});

describe("quickProbe", () => {
  it("returns true when model responds", async () => {
    const adapter = fakeAdapter();
    const ok = await quickProbe(adapter, fakeTarget());
    expect(ok).toBe(true);
  });

  it("returns false when model fails", async () => {
    const adapter = fakeAdapter(() => {
      throw new Error("Service unavailable");
    });
    const ok = await quickProbe(adapter, fakeTarget());
    expect(ok).toBe(false);
  });

  it("returns false when model returns empty content", async () => {
    const adapter = fakeAdapter(() => ({
      content: "",
      latencyMs: 10,
      usage: {},
    }));
    const ok = await quickProbe(adapter, fakeTarget());
    expect(ok).toBe(false);
  });
});

describe("concurrency probe details", () => {
  it("computes latency stats across concurrent calls", async () => {
    let callCount = 0;
    const adapter = fakeAdapter(() => {
      callCount++;
      return {
        content: "ok",
        latencyMs: 20 + callCount * 2, // slight variance
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    });

    const result = await runCapabilityProbes(adapter, fakeTarget(), {
      concurrency: true,
      maxConcurrency: 2,
    });

    expect(result.concurrency).toBeDefined();
    // Level 1: 1 call, Level 2: 2 calls
    expect(result.concurrency!.details).toHaveLength(2);
    expect(result.concurrency!.details[0].concurrency).toBe(1);
    expect(result.concurrency!.details[0].success).toBe(1);
    expect(result.concurrency!.details[1].concurrency).toBe(2);
    expect(result.concurrency!.details[1].success).toBe(2);

    // Latency stats populated (near-zero for fake adapters since wall-clock is instant)
    const level1 = result.concurrency!.details[0].latencyStats;
    expect(level1.mean).toBeGreaterThanOrEqual(0);
    expect(level1.max).toBeGreaterThanOrEqual(0);
  });

  it("tracks error types when some calls fail", async () => {
    let callIndex = 0;
    const adapter = fakeAdapter(() => {
      callIndex++;
      if (callIndex % 2 === 0) {
        throw new Error("429 Too Many Requests");
      }
      return { content: "ok", latencyMs: 10, usage: {} };
    });

    const result = await runCapabilityProbes(adapter, fakeTarget(), {
      concurrency: true,
      maxConcurrency: 4,
    });

    // At concurrency=4 with ~50% failure, should stop early
    const lastLevel = result.concurrency!.details[result.concurrency!.details.length - 1];
    expect(lastLevel.failure).toBeGreaterThan(0);
    expect(lastLevel.errorTypes).toBeDefined();
    expect(Object.keys(lastLevel.errorTypes).length).toBeGreaterThan(0);
  });
});
