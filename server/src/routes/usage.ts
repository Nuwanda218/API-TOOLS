import { Router } from "express";
import type { AppDatabase } from "../db/client.js";
import { createUsageService, type UsageRange } from "../usage/usageService.js";

export function createUsageRouter(db: AppDatabase) {
  const router = Router();
  const usage = createUsageService(db);

  router.get("/summary", (_req, res) => {
    const range = normalizeRange(_req.query.range);
    const providerId = normalizeString(_req.query.providerId);
    const modelId = normalizeString(_req.query.modelId);
    res.json(usage.getSummary({ range, providerId, modelId }));
  });

  router.get("/dashboard", (_req, res) => {
    const range = normalizeRange(_req.query.range);
    const providerId = normalizeString(_req.query.providerId);
    const modelId = normalizeString(_req.query.modelId);
    res.json(usage.getDashboard({ range, providerId, modelId }));
  });

  return router;
}

function normalizeRange(value: unknown): UsageRange {
  if (typeof value === "string" && ["today", "7d", "30d", "all"].includes(value)) {
    return value as UsageRange;
  }
  return "all";
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
