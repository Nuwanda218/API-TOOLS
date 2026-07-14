/**
 * Agent system type definitions.
 *
 * Provides shared types for the agent layer, including LLM call options,
 * call records, and session-level statistics.
 */

import type { Model } from "../providers/modelRepository.js";
import type { Provider } from "../providers/providerRepository.js";

// ── LLM Call Options ──

export interface LlmCallOptions {
  /** Provider name (matches Provider.name in the database). */
  provider?: string;
  /** Model identifier (matches Model.modelId in the database). */
  model?: string;
  /** Temperature override. Uses model default if omitted. */
  temperature?: number;
  /** Maximum output tokens. Uses model default if omitted. */
  maxTokens?: number;
  /** Human-readable label for progress display. */
  label?: string;
}

// ── LLM Call Result ──

export interface LlmCallResult {
  /** The response text content. */
  content: string;
  /** The model that actually served the request. */
  model: string;
  /** The provider that served the request. */
  provider: string;
  /** Wall-clock latency in milliseconds. */
  latencyMs: number;
  /** Token usage breakdown. */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ── Call Record ──

export interface CallRecord {
  timestamp: string;
  provider: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  parameters: {
    temperature?: number;
    maxTokens?: number;
  };
  response: string;
  latencyMs: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  error?: string;
}

// ── Resolved Target ──

export interface ResolvedLlmTarget {
  provider: Provider;
  model: Model;
  apiKey: string;
}

// ── Session Stats ──

export interface SessionStats {
  /** Total LLM calls made in this session. */
  totalCalls: number;
  /** Cumulative token usage. */
  totalTokens: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Cumulative latency in milliseconds. */
  totalLatencyMs: number;
}
