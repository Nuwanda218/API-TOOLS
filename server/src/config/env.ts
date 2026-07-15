import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import { ProviderError } from "../errors/providerError.js";

const DEFAULT_MCP_ALLOWED_COMMANDS = ["npx", "node"];

export function findLocalEnvPath(startDirectory = process.cwd()) {
  let current = startDirectory;

  while (true) {
    const candidate = join(current, ".env");
    if (existsSync(candidate)) return candidate;

    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export function loadLocalEnv(startDirectory = process.cwd()) {
  const path = findLocalEnvPath(startDirectory);
  return dotenv.config(path ? { path } : undefined);
}

export function getRequiredApiKey(apiKeyEnv: string, env: NodeJS.ProcessEnv = process.env) {
  const value = env[apiKeyEnv];

  if (!value) {
    throw new ProviderError("missing_api_key", `Missing API key env var: ${apiKeyEnv}`, {
      suggestion: `Add ${apiKeyEnv}=... to your local .env file and restart the server.`
    });
  }

  return value;
}

// ── Provider auto-discovery ──

/** Configuration for a single provider discovered from environment variables. */
export interface DiscoveredProviderConfig {
  name: string;
  type: "openai-compatible" | "openai-official";
  apiFormat: "openai-chat-completions" | "openai-responses" | "claude-messages";
  baseUrl: string;
  apiKeyEnv: string;
  defaultModel: string;
  /** Comma-separated model IDs for APIs without a /v1/models endpoint. */
  manualModels: string[];
  /** Override display name (LLM_{NAME}_NAME). */
  displayName?: string;
}

/**
 * Scan process.env for `LLM_{NAME}_BASE_URL` patterns and return a list of
 * discovered provider configurations.
 *
 * Convention (matching the Python bibliometrics project):
 *   LLM_{NAME}_BASE_URL        (required)
 *   LLM_{NAME}_API_KEY         (required)
 *   LLM_{NAME}_DEFAULT_MODEL   (required)
 *   LLM_{NAME}_PROTOCOL        (optional — inferred from name if omitted)
 *   LLM_{NAME}_MODELS          (optional — comma-separated manual model list)
 *   LLM_{NAME}_NAME            (optional — override display name)
 *
 * Protocol inference:
 *   - Name contains "ANTHROPIC" → "claude-messages"
 *   - Otherwise → "openai-chat-completions"
 */
export function discoverProviderConfigs(
  env: NodeJS.ProcessEnv = process.env
): DiscoveredProviderConfig[] {
  const pattern = /^LLM_([A-Z][A-Z0-9_]*)_BASE_URL$/;
  const seen = new Set<string>();
  const configs: DiscoveredProviderConfig[] = [];

  for (const key of Object.keys(env)) {
    const match = pattern.exec(key);
    if (!match) continue;

    const label = match[1]; // e.g. "DEEPSEEK", "ANTHROPIC", "OPENAI"
    const baseUrl = (env[key] ?? "").trim().replace(/\/+$/, "");
    const apiKey = (env[`LLM_${label}_API_KEY`] ?? "").trim();
    const defaultModel = (env[`LLM_${label}_DEFAULT_MODEL`] ?? "").trim();

    if (!baseUrl || !apiKey || !defaultModel) continue;

    // Provider name: explicit NAME override, otherwise label lowercase
    const name = (env[`LLM_${label}_NAME`] ?? label).toLowerCase().replace(/_/g, "-");

    if (seen.has(name)) continue;
    seen.add(name);

    // Protocol: explicit or inferred
    let apiFormat: DiscoveredProviderConfig["apiFormat"] = "openai-chat-completions";
    const explicitProtocol = (env[`LLM_${label}_PROTOCOL`] ?? "").trim().toLowerCase();
    if (explicitProtocol === "anthropic_compatible" || explicitProtocol === "claude-messages") {
      apiFormat = "claude-messages";
    } else if (explicitProtocol === "openai-responses") {
      apiFormat = "openai-responses";
    } else if (explicitProtocol === "openai-chat-completions" || explicitProtocol === "openai_compatible") {
      apiFormat = "openai-chat-completions";
    } else if (/anthropic/i.test(label)) {
      // Auto-infer: label contains "ANTHROPIC" → Claude Messages format
      apiFormat = "claude-messages";
    }

    // Manual model list (for APIs without /v1/models)
    const manualModelsRaw = (env[`LLM_${label}_MODELS`] ?? "").trim();
    const manualModels = manualModelsRaw
      ? manualModelsRaw.split(",").map((m) => m.trim()).filter(Boolean)
      : [];

    const displayName = (env[`LLM_${label}_NAME`] ?? undefined);

    configs.push({
      name,
      type: "openai-compatible" as const,
      apiFormat,
      baseUrl,
      apiKeyEnv: `LLM_${label}_API_KEY`,
      defaultModel,
      manualModels,
      displayName,
    });
  }

  return configs;
}

export function getAllowedMcpCommands(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.MCP_ALLOWED_COMMANDS;
  if (!configured) return DEFAULT_MCP_ALLOWED_COMMANDS;

  const commands = configured
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return commands.length > 0 ? commands : DEFAULT_MCP_ALLOWED_COMMANDS;
}
