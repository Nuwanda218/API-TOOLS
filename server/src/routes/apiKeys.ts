import { Router } from "express";
import { z } from "zod";
import { writeApiKeyToDotenv } from "../config/dotenvFile.js";

const saveApiKeySchema = z.object({
  apiKeyEnv: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]*$/, "API key env var must be an environment variable name")
    .refine((value) => !looksLikeRawApiKey(value), "API key env var must be an environment variable name"),
  apiKey: z.string().min(1)
});

export function createApiKeysRouter(dependencies: { envPath: string; env: NodeJS.ProcessEnv }) {
  const router = Router();

  router.post("/", (req, res) => {
    const input = saveApiKeySchema.parse(req.body);
    writeApiKeyToDotenv(dependencies.envPath, input.apiKeyEnv, input.apiKey);
    dependencies.env[input.apiKeyEnv] = input.apiKey;
    process.env[input.apiKeyEnv] = input.apiKey;
    res.status(204).send();
  });

  return router;
}

function looksLikeRawApiKey(value: string) {
  return /^(sk|tk)-/i.test(value) || /[A-Z0-9]{32,}/.test(value);
}
