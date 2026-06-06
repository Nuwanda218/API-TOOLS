import { Router } from "express";
import { z } from "zod";
import { createAdapterRegistry } from "../adapters/registry.js";
import type { AdapterRegistry } from "../adapters/types.js";
import { getRequiredApiKey } from "../config/env.js";
import type { AppDatabase } from "../db/client.js";
import { ProviderError } from "../errors/providerError.js";
import { createModelRepository } from "../providers/modelRepository.js";
import { createProviderRepository } from "../providers/providerRepository.js";

const createProviderSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["openai-compatible", "openai-official"]),
  apiFormat: z.enum(["openai-chat-completions", "openai-responses"]).default("openai-chat-completions"),
  baseUrl: z.string().url(),
  apiKeyEnv: z.string().min(1),
  enabled: z.boolean().default(true)
});

const updateProviderSchema = createProviderSchema.partial();

const importModelsSchema = z.object({
  models: z.array(z.object({
    modelId: z.string().min(1),
    displayName: z.string().min(1),
    capability: z.enum(["chat", "image", "multimodal"]).default("chat"),
    enabled: z.boolean().default(true),
    defaultParams: z.record(z.unknown()).default({}),
    pricing: z.record(z.unknown()).default({})
  })).min(1)
});

interface ProvidersRouterDependencies {
  env: NodeJS.ProcessEnv;
  adapterRegistry?: Pick<AdapterRegistry, "getModelAdapter">;
}

export function createProvidersRouter(db: AppDatabase, dependencies: ProvidersRouterDependencies) {
  const router = Router();
  const providers = createProviderRepository(db);
  const models = createModelRepository(db);
  const adapterRegistry = dependencies.adapterRegistry ?? createAdapterRegistry();

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
      const adapter = adapterRegistry.getModelAdapter(provider);
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

  router.post("/:id/import-models", (req, res, next) => {
    try {
      const provider = providers.getById(req.params.id);
      if (!provider) {
        throw new ProviderError("provider_not_found", "Provider not found", { statusCode: 404 });
      }

      const input = importModelsSchema.parse(req.body);
      const created = [];
      const skipped = [];

      for (const model of input.models) {
        const existing = models.findByProviderAndModelId(provider.id, model.modelId);

        if (existing) {
          skipped.push({ modelId: model.modelId, reason: "already_exists" });
          continue;
        }

        created.push(models.create({
          providerId: provider.id,
          displayName: model.displayName,
          modelId: model.modelId,
          capability: model.capability,
          enabled: model.enabled,
          defaultParams: model.defaultParams,
          pricing: model.pricing
        }));
      }

      res.status(201).json({ created, skipped });
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
