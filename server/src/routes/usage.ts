import { Router } from "express";
import type { AppDatabase } from "../db/client.js";
import { createUsageService } from "../usage/usageService.js";

export function createUsageRouter(db: AppDatabase) {
  const router = Router();
  const usage = createUsageService(db);

  router.get("/summary", (_req, res) => {
    res.json(usage.getSummary());
  });

  return router;
}
