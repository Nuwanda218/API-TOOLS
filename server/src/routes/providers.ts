import { Router } from "express";
import { z } from "zod";
import { createOpenAICompatibleAdapter } from "../adapters/openaiCompatible.js";
import type { ModelAdapter } from "../adapters/types.js";
import { getRequiredApiKey } from "../config/env.js";
import type { AppDatabase } from "../db/client.js";
import { ProviderError } from "../errors/providerError.js";
import { createProviderRepository } from "../providers/providerRepository.js";

const createProviderSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["openai-compatible", "openai-official"]),
  baseUrl: z.string().url(),
  apiKeyEnv: z.string().min(1),
  enabled: z.boolean().default(true)
});

const updateProviderSchema = createProviderSchema.partial();

interface ProvidersRouterDependencies {
  env: NodeJS.ProcessEnv;
  adapter?: Pick<ModelAdapter, "listModels">;
}

export function createProvidersRouter(db: AppDatabase, dependencies: ProvidersRouterDependencies) {
  const router = Router();
  const providers = createProviderRepository(db);
  const adapter = dependencies.adapter ?? createOpenAICompatibleAdapter();

  router.get("/", (_req, res) => {
    res.json(providers.list());
  });

  router.post("/", (req, res) => {
    const input = createProviderSchema.parse(req.body);
    const created = providers.create(input);
    res.status(201).json(created);
  });

  router.get("/:id/remote-models", async (req, res, next) => {
    try {
      const provider = providers.getById(req.params.id);
      if (!provider) {
        throw new ProviderError("provider_not_found", "Provider not found", { statusCode: 404 });
      }

      const apiKey = getRequiredApiKey(provider.apiKeyEnv, dependencies.env);
      const models = await adapter.listModels({ provider, apiKey });

      res.json({
        ok: true,
        providerId: provider.id,
        models
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", (req, res) => {
    const input = updateProviderSchema.parse(req.body);
    const updated = providers.update(req.params.id, input);
    if (!updated) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json(updated);
  });

  router.delete("/:id", (req, res) => {
    const deleted = providers.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.status(204).send();
  });

  return router;
}
