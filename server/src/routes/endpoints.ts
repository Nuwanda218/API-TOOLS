import { Router } from "express";
import { z } from "zod";
import { createEndpointRepository } from "../endpoints/endpointRepository.js";
import { ProviderError } from "../errors/providerError.js";
import { createProviderRepository } from "../providers/providerRepository.js";
import type { AppDatabase } from "../db/client.js";

const endpointSchema = z.object({
  providerId: z.string().min(1),
  name: z.string().min(1),
  operationId: z.string().min(1).default("http.request"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1).refine((value) => value.startsWith("/"), {
    message: "Endpoint path must start with / and must not be a full URL"
  }),
  queryTemplate: z.record(z.unknown()).default({}),
  headersTemplate: z.record(z.unknown()).default({}),
  bodyTemplate: z.unknown().optional(),
  enabled: z.boolean().default(true)
});

const updateEndpointSchema = endpointSchema.partial();

export function createEndpointsRouter(db: AppDatabase) {
  const router = Router();
  const endpoints = createEndpointRepository(db);
  const providers = createProviderRepository(db);

  router.get("/", (req, res) => {
    const providerId = typeof req.query.providerId === "string" ? req.query.providerId : undefined;
    res.json(providerId ? endpoints.listByProvider(providerId) : endpoints.list());
  });

  router.post("/", (req, res, next) => {
    try {
      const input = endpointSchema.parse(req.body);
      ensureProviderExists(providers, input.providerId);
      res.status(201).json(endpoints.create(input));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", (req, res) => {
    const endpoint = endpoints.getById(req.params.id);
    if (!endpoint) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json(endpoint);
  });

  router.patch("/:id", (req, res, next) => {
    try {
      const input = updateEndpointSchema.parse(req.body);
      if (input.providerId) ensureProviderExists(providers, input.providerId);
      const updated = endpoints.update(req.params.id, input);
      if (!updated) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", (req, res) => {
    const deleted = endpoints.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.status(204).send();
  });

  return router;
}

function ensureProviderExists(providers: ReturnType<typeof createProviderRepository>, providerId: string) {
  if (!providers.getById(providerId)) {
    throw new ProviderError("provider_not_found", "Provider not found", { statusCode: 404 });
  }
}
