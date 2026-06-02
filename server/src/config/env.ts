import { ProviderError } from "../errors/providerError.js";

export function getRequiredApiKey(apiKeyEnv: string, env: NodeJS.ProcessEnv = process.env) {
  const value = env[apiKeyEnv];

  if (!value) {
    throw new ProviderError("missing_api_key", `Missing API key env var: ${apiKeyEnv}`, {
      suggestion: `Add ${apiKeyEnv}=... to your local .env file and restart the server.`
    });
  }

  return value;
}
