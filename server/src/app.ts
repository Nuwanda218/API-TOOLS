import type { ErrorRequestHandler } from "express";
import type { AppDatabase } from "./db/client.js";
import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { ProviderError } from "./errors/providerError.js";
import { createAdapterRegistry } from "./adapters/registry.js";
import type { AdapterRegistry } from "./adapters/types.js";
import { createApiKeysRouter } from "./routes/apiKeys.js";
import { createHealthRouter } from "./routes/health.js";
import { createModelsRouter } from "./routes/models.js";
import { createProvidersRouter } from "./routes/providers.js";
import { createRunsRouter } from "./routes/runs.js";
import { createUsageRouter } from "./routes/usage.js";
import { createWorkflowsRouter } from "./routes/workflows.js";

export interface AppDependencies {
  db: AppDatabase;
  env?: NodeJS.ProcessEnv;
  envPath?: string;
  adapterRegistry?: AdapterRegistry;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  const { db } = dependencies;
  const env = dependencies.env ?? process.env;
  const envPath = dependencies.envPath ?? ".env";
  const adapterRegistry = dependencies.adapterRegistry ?? createAdapterRegistry();

  app.use(cors({ origin: "http://127.0.0.1:5173" }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/health", createHealthRouter());
  app.use("/api/api-keys", createApiKeysRouter({ envPath, env }));
  app.use("/api/providers", createProvidersRouter(db, {
    env,
    adapterRegistry
  }));
  app.use("/api/models", createModelsRouter(db, { env, adapterRegistry }));
  app.use("/api/runs", createRunsRouter(db));
  app.use("/api/workflows", createWorkflowsRouter(db, {
    env,
    adapterRegistry
  }));
  app.use("/api/usage", createUsageRouter(db));
  app.use(errorHandler);

  return app;
}

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof ProviderError) {
    const status = error.statusCode && error.statusCode >= 500 ? 502 : error.statusCode ?? 400;
    res.status(status).json(error.toJSON());
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({ error: "invalid_request", issues: error.issues });
    return;
  }

  if (error instanceof Error && /constraint|foreign key|unique/i.test(error.message)) {
    res.status(400).json({ error: "invalid_request", message: error.message });
    return;
  }

  next(error);
};
