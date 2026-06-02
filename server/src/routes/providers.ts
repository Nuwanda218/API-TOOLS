import { Router } from "express";
import { z } from "zod";
import type { AppDatabase } from "../db/client.js";
import { createProviderRepository } from "../providers/providerRepository.js";

const createProviderSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["openai-compatible", "openai-official"]),
  baseUrl: z.string().url(),
  apiKeyEnv: z.string().min(1),
  enabled: z.boolean().default(true)
});

const updateProviderSchema = createProviderSchema.partial();

export function createProvidersRouter(db: AppDatabase) {
  const router = Router();
  const providers = createProviderRepository(db);

  router.get("/", (_req, res) => {
    res.json(providers.list());
  });

  router.post("/", (req, res) => {
    const input = createProviderSchema.parse(req.body);
    const created = providers.create(input);
    res.status(201).json(created);
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
