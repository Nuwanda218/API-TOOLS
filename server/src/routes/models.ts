import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createAdapterRegistry } from "../adapters/registry.js";
import type { AdapterRegistry } from "../adapters/types.js";
import { getRequiredApiKey } from "../config/env.js";
import type { AppDatabase } from "../db/client.js";
import { ProviderError } from "../errors/providerError.js";
import { createModelRepository, type Model } from "../providers/modelRepository.js";
import { createProviderRepository, type Provider } from "../providers/providerRepository.js";

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

interface ModelsRouterDependencies {
  env: NodeJS.ProcessEnv;
  adapterRegistry?: AdapterRegistry;
}

export function createModelsRouter(db: AppDatabase, dependencies: ModelsRouterDependencies) {
  const router = Router();
  const models = createModelRepository(db);
  const providers = createProviderRepository(db);
  const adapterRegistry = dependencies.adapterRegistry ?? createAdapterRegistry();

  router.get("/", (req, res) => {
    const providerId = typeof req.query.providerId === "string" ? req.query.providerId : undefined;
    res.json(providerId ? models.listByProvider(providerId) : models.list());
  });

  router.post("/", (req, res) => {
    const input = createModelSchema.parse(req.body);
    const created = models.create(input);
    res.status(201).json(created);
  });

  router.post("/:id/test", async (req, res, next) => {
    const model = models.getById(req.params.id);
    if (!model) {
      next(new ProviderError("model_not_found", "Model not found", { statusCode: 404 }));
      return;
    }

    const provider = providers.getById(model.providerId);
    if (!provider) {
      next(new ProviderError("provider_error", "Provider not found", { statusCode: 404 }));
      return;
    }

    if (model.capability !== "chat" && model.capability !== "multimodal") {
      next(new ProviderError("unsupported_capability", "Model cannot run chat completion tests"));
      return;
    }

    const run = createModelTestRun(db, provider, model);

    try {
      const apiKey = getRequiredApiKey(provider.apiKeyEnv, dependencies.env);
      const adapter = adapterRegistry.getModelAdapter(provider);
      const result = await adapter.testModel({ provider, model, apiKey });

      completeModelTestRun(db, {
        runId: run.id,
        stepId: run.stepId,
        status: "succeeded",
        outputPreview: result.message,
        latencyMs: result.latencyMs,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens
      });

      res.json(result);
    } catch (error) {
      const providerError = normalizeProviderError(error);
      completeModelTestRun(db, {
        runId: run.id,
        stepId: run.stepId,
        status: "failed",
        errorCode: providerError.code,
        errorMessage: providerError.message
      });

      next(providerError);
    }
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

function createModelTestRun(db: AppDatabase, provider: Provider, model: Model) {
  const now = new Date().toISOString();
  const sessionId = nanoid();
  const runId = nanoid();
  const stepId = nanoid();

  db.prepare(`
    insert into sessions (id, title, workflow_type, created_at, updated_at)
    values (@id, @title, 'model-test', @createdAt, @updatedAt)
  `).run({
    id: sessionId,
    title: `Model test: ${model.displayName}`,
    createdAt: now,
    updatedAt: now
  });

  db.prepare(`
    insert into runs (id, session_id, workflow_type, status, started_at)
    values (@id, @sessionId, 'model-test', 'running', @startedAt)
  `).run({
    id: runId,
    sessionId,
    startedAt: now
  });

  db.prepare(`
    insert into run_steps (
      id,
      run_id,
      step_index,
      step_type,
      provider_id,
      model_id,
      status,
      input_preview,
      created_at,
      updated_at
    )
    values (
      @id,
      @runId,
      0,
      'model-test',
      @providerId,
      @modelId,
      'running',
      @inputPreview,
      @createdAt,
      @updatedAt
    )
  `).run({
    id: stepId,
    runId,
    providerId: provider.id,
    modelId: model.id,
    inputPreview: "Reply with ok.",
    createdAt: now,
    updatedAt: now
  });

  return { id: runId, stepId };
}

function completeModelTestRun(
  db: AppDatabase,
  input: {
    runId: string;
    stepId: string;
    status: "succeeded" | "failed";
    outputPreview?: string;
    errorCode?: string;
    errorMessage?: string;
    latencyMs?: number;
    inputTokens?: number;
    outputTokens?: number;
  }
) {
  const now = new Date().toISOString();

  db.prepare(`
    update run_steps
    set status = @status,
        output_preview = @outputPreview,
        error_code = @errorCode,
        error_message = @errorMessage,
        latency_ms = @latencyMs,
        input_tokens = @inputTokens,
        output_tokens = @outputTokens,
        updated_at = @updatedAt
    where id = @stepId
  `).run({
    stepId: input.stepId,
    status: input.status,
    outputPreview: input.outputPreview ?? null,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    latencyMs: input.latencyMs ?? null,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null,
    updatedAt: now
  });

  db.prepare(`
    update runs
    set status = @status,
        ended_at = @endedAt,
        total_input_tokens = @inputTokens,
        total_output_tokens = @outputTokens
    where id = @runId
  `).run({
    runId: input.runId,
    status: input.status,
    endedAt: now,
    inputTokens: input.inputTokens ?? null,
    outputTokens: input.outputTokens ?? null
  });
}

function normalizeProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  return new ProviderError("provider_error", "Provider request failed", {
    providerMessage: error instanceof Error ? error.message : String(error)
  });
}
