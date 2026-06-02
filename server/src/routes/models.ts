import { Router } from "express";
import { z } from "zod";
import type { AppDatabase } from "../db/client.js";
import { createModelRepository } from "../providers/modelRepository.js";

const createModelSchema = z.object({
  providerId: z.string().min(1),
  displayName: z.string().min(1),
  modelId: z.string().min(1),
  capability: z.enum(["chat", "image", "multimodal"]),
  enabled: z.boolean().default(true),
  defaultParams: z.record(z.unknown()).default({}),
  pricing: z.record(z.unknown()).default({})
});

const updateModelSchema = createModelSchema.partial();

export function createModelsRouter(db: AppDatabase) {
  const router = Router();
  const models = createModelRepository(db);

  router.get("/", (req, res) => {
    const providerId = typeof req.query.providerId === "string" ? req.query.providerId : undefined;
    res.json(providerId ? models.listByProvider(providerId) : models.list());
  });

  router.post("/", (req, res) => {
    const input = createModelSchema.parse(req.body);
    const created = models.create(input);
    res.status(201).json(created);
  });

  router.patch("/:id", (req, res) => {
    const input = updateModelSchema.parse(req.body);
    const updated = models.update(req.params.id, input);
    if (!updated) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json(updated);
  });

  router.delete("/:id", (req, res) => {
    const deleted = models.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.status(204).send();
  });

  return router;
}
