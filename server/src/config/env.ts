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

export function getAllowedMcpCommands(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.MCP_ALLOWED_COMMANDS;
  if (!configured) return DEFAULT_MCP_ALLOWED_COMMANDS;

  const commands = configured
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return commands.length > 0 ? commands : DEFAULT_MCP_ALLOWED_COMMANDS;
}
