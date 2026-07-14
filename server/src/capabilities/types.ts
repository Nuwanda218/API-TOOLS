/**
 * Capability probing type definitions.
 *
 * Models the results of automated capability tests run against LLM models.
 * Adapted from the Python bibliometrics project:
 *   04_model_service/llm_gateway/schemas.py (CapabilityResult, ConcurrencyResult)
 */

// ── Probe States ──

/** Outcome of a single capability probe. */
export type ProbeState = "pass" | "partial" | "fail" | "unknown";

// ── Individual Probe Results ──

export interface ProbeOutcome {
  state: ProbeState;
  /** Human-readable detail (e.g. "Returned 42 chars", "API rejected stream param"). */
  note: string;
}

// ── Concurrency Probe ──

export interface ConcurrencyLevelResult {
  concurrency: number;
  success: number;
  failure: number;
  successRate: number;
  latencyStats: {
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  };
  errorTypes: Record<string, number>;
  sampleErrors: string[];
}

export interface ConcurrencyProbeResult {
  state: ProbeState;
  /** Highest concurrency level with ≥95% success rate. */
  safeConcurrency: number | null;
  /** Recommended worker count (80% of safe concurrency). */
  recommendedWorkers: number | null;
  /** First concurrency level that triggered rate limiting. */
  firstRateLimitAt: number | null;
  /** Mean latency at concurrency=1 (baseline). */
  baseLatencyMs: number | null;
  /** Highest concurrency level tested. */
  maxTested: number | null;
  /** Per-level detailed results. */
  details: ConcurrencyLevelResult[];
}

// ── Full Capability Result ──

export interface CapabilityResult {
  /** Model ID that was probed. */
  modelId: string;
  /** Provider name. */
  providerName: string;
  /** ISO timestamp of the probe run. */
  probedAt: string;

  /** Basic text input/output. */
  textInput: ProbeOutcome;
  /** Structured JSON output. */
  jsonOutput: ProbeOutcome;
  /** Streaming support. */
  stream: ProbeOutcome;
  /** Tool / function calling support. */
  tools: ProbeOutcome;

  /** Optional concurrency probe (only when explicitly requested). */
  concurrency?: ConcurrencyProbeResult;

  /** Free-form notes from the probe run. */
  notes: string[];
}

// ── Probe Options ──

export interface ProbeOptions {
  /** Whether to run concurrency probing (expensive — many API calls). */
  concurrency?: boolean;
  /** Max concurrency level to test (default 64). */
  maxConcurrency?: number;
  /** Request timeout per call in ms (default 30000). */
  timeoutMs?: number;
}
