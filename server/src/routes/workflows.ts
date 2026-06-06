import { Router } from "express";
import { z } from "zod";
import { createAdapterRegistry } from "../adapters/registry.js";
import type { AdapterRegistry } from "../adapters/types.js";
import type { AppDatabase } from "../db/client.js";
import { createWorkflowRunner } from "../workflows/runner.js";

const workflowStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("llm.chat"),
  modelId: z.string().min(1).optional(),
  input: z.record(z.unknown()).default({})
});

const runWorkflowSchema = z.object({
  sessionId: z.string().optional(),
  workflowType: z.literal("api-workflow").default("api-workflow"),
  input: z.record(z.unknown()).default({}),
  steps: z.array(workflowStepSchema).min(1)
});

interface WorkflowsRouterDependencies {
  adapterRegistry?: AdapterRegistry;
  env: NodeJS.ProcessEnv;
}

export function createWorkflowsRouter(db: AppDatabase, dependencies: WorkflowsRouterDependencies) {
  const router = Router();
  const runner = createWorkflowRunner(db, {
    adapterRegistry: dependencies.adapterRegistry ?? createAdapterRegistry(),
    env: dependencies.env
  });

  router.get("/", (_req, res) => {
    res.json([
      { id: "single-llm-chat", name: "单步 LLM Chat", steps: [{ id: "main-response", type: "llm.chat" }] }
    ]);
  });

  router.post("/run", async (req, res, next) => {
    try {
      const input = runWorkflowSchema.parse(req.body);
      const result = await runner.runWorkflow(input);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
