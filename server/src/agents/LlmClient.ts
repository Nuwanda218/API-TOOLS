/**
 * Lightweight LLM client for agent use.
 *
 * Wraps the existing AdapterRegistry + Provider/Model repositories
 * to provide a simple `ask(prompt, system)` interface, analogous to
 * the Python project's `LLMClient` in `04_model_service/llm_gateway/client.py`.
 *
 * All calls are recorded for session-level token/latency tracking.
 */

import { getRequiredApiKey } from "../config/env.js";
import { ProviderError } from "../errors/providerError.js";
import type { AdapterRegistry } from "../adapters/types.js";
import type { AppDatabase } from "../db/client.js";
import { createProviderRepository, type ProviderRepository } from "../providers/providerRepository.js";
import { createModelRepository, type ModelRepository } from "../providers/modelRepository.js";
import type {
  CallRecord,
  LlmCallOptions,
  LlmCallResult,
  ResolvedLlmTarget,
  SessionStats,
} from "./types.js";

// ── Dependencies ──

export interface LlmClientDependencies {
  db: AppDatabase;
  adapterRegistry: AdapterRegistry;
  env?: NodeJS.ProcessEnv;
}

// ── LlmClient ──

export interface LlmClient {
  /**
   * Single-turn chat: send a user prompt with optional system prompt,
   * return the model's text response.
   */
  ask(prompt: string, system?: string, options?: LlmCallOptions): Promise<string>;

  /**
   * Full-featured LLM call returning structured result with usage data.
   */
  call(options: {
    systemPrompt: string;
    userMessage: string;
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    label?: string;
  }): Promise<LlmCallResult>;

  /** All call records from this session. */
  readonly callHistory: CallRecord[];

  /** Session-level statistics. */
  readonly stats: SessionStats;

  /** Clear call history and reset statistics. */
  clearHistory(): void;
}

// ── Factory ──

export function createLlmClient(dependencies: LlmClientDependencies): LlmClient {
  const env = dependencies.env ?? process.env;
  const providers: ProviderRepository = createProviderRepository(dependencies.db);
  const models: ModelRepository = createModelRepository(dependencies.db);
  const callHistory: CallRecord[] = [];

  // ── Resolution ──

  function resolveTarget(providerName?: string, modelName?: string): ResolvedLlmTarget {
    // Find provider: by name, first enabled, or error
    const provider = providerName
      ? providers.list().find((p) => p.name === providerName && p.enabled)
      : providers.list().find((p) => p.enabled);

    if (!provider) {
      if (providerName) {
        throw new ProviderError("provider_not_found", `Provider not found or disabled: ${providerName}`, {
          statusCode: 404,
          suggestion: "Check that the provider exists and is enabled.",
        });
      }
      throw new ProviderError("provider_not_found", "No enabled provider available", {
        suggestion: "Add a provider in Settings → Providers.",
      });
    }

    // Find model: by modelId, provider's first chat-capable, or error
    const model = modelName
      ? models.findByProviderAndModelId(provider.id, modelName)
      : models.listByProvider(provider.id).find(
          (m) => (m.capability === "chat" || m.capability === "multimodal") && m.enabled
        );

    if (!model || !model.enabled) {
      if (modelName) {
        throw new ProviderError("model_not_found", `Model not found or disabled: ${modelName}`, {
          statusCode: 404,
          suggestion: "Check that the model exists and is enabled.",
        });
      }
      throw new ProviderError("model_not_found", `No chat-capable model for provider: ${provider.name}`, {
        suggestion: "Add a chat model in Settings → Models.",
      });
    }

    const apiKey = getRequiredApiKey(provider.apiKeyEnv, env);

    return { provider, model, apiKey };
  }

  // ── Core call ──

  async function call(options: {
    systemPrompt: string;
    userMessage: string;
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    label?: string;
  }): Promise<LlmCallResult> {
    const target = resolveTarget(options.provider, options.model);
    const temperature = options.temperature ?? target.model.defaultParams.temperature ?? 0.3;
    const maxTokens = options.maxTokens ?? target.model.defaultParams.maxTokens ?? 4096;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: options.userMessage });

    const startedAt = Date.now();

    try {
      const invocation = await dependencies.adapterRegistry.invoke({
        operationId: "llm.chat",
        provider: target.provider,
        apiKey: target.apiKey,
        resource: { kind: "model", model: target.model },
        input: { messages },
      });

      const latencyMs = Date.now() - startedAt;

      if (!invocation.ok) {
        const record: CallRecord = {
          timestamp: new Date().toISOString(),
          provider: target.provider.name,
          model: target.model.modelId,
          systemPrompt: options.systemPrompt,
          userMessage: options.userMessage,
          parameters: { temperature, maxTokens },
          response: "",
          latencyMs,
          usage: { inputTokens: 0, outputTokens: 0 },
          error: invocation.message,
        };
        callHistory.push(record);

        throw new ProviderError(invocation.code, invocation.message, {
          providerMessage: invocation.providerMessage,
          statusCode: invocation.statusCode,
          suggestion: invocation.suggestion,
        });
      }

      const usage = invocation.usage as { inputTokens?: number; outputTokens?: number } | undefined;
      const inputTokens = usage?.inputTokens ?? 0;
      const outputTokens = usage?.outputTokens ?? 0;
      const data = invocation.data as { content: string };
      const content = data.content ?? "";

      const record: CallRecord = {
        timestamp: new Date().toISOString(),
        provider: target.provider.name,
        model: target.model.modelId,
        systemPrompt: options.systemPrompt,
        userMessage: options.userMessage,
        parameters: { temperature, maxTokens },
        response: content,
        latencyMs,
        usage: { inputTokens, outputTokens },
      };
      callHistory.push(record);

      return {
        content,
        model: target.model.modelId,
        provider: target.provider.name,
        latencyMs,
        usage: { inputTokens, outputTokens },
      };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;

      const record: CallRecord = {
        timestamp: new Date().toISOString(),
        provider: target.provider.name,
        model: target.model.modelId,
        systemPrompt: options.systemPrompt,
        userMessage: options.userMessage,
        parameters: { temperature, maxTokens },
        response: "",
        latencyMs,
        usage: { inputTokens: 0, outputTokens: 0 },
        error: error instanceof Error ? error.message : String(error),
      };
      callHistory.push(record);

      throw error;
    }
  }

  // ── Convenience: ask ──

  async function ask(
    prompt: string,
    system?: string,
    options?: LlmCallOptions
  ): Promise<string> {
    const result = await call({
      systemPrompt: system ?? "",
      userMessage: prompt,
      provider: options?.provider,
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      label: options?.label,
    });
    return result.content;
  }

  // ── Stats ──

  const stats: SessionStats = {
    get totalCalls() {
      return callHistory.length;
    },
    get totalTokens() {
      return callHistory.reduce(
        (acc, r) => ({
          inputTokens: acc.inputTokens + r.usage.inputTokens,
          outputTokens: acc.outputTokens + r.usage.outputTokens,
        }),
        { inputTokens: 0, outputTokens: 0 }
      );
    },
    get totalLatencyMs() {
      return callHistory.reduce((sum, r) => sum + r.latencyMs, 0);
    },
  };

  function clearHistory(): void {
    callHistory.length = 0;
  }

  return {
    ask,
    call,
    get callHistory() {
      return [...callHistory];
    },
    stats,
    clearHistory,
  };
}
