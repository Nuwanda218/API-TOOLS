import type { ErrorRequestHandler } from "express";
import type { AppDatabase } from "./db/client.js";
import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { createHealthRouter } from "./routes/health.js";
import { createModelsRouter } from "./routes/models.js";
import { createProvidersRouter } from "./routes/providers.js";

export interface AppDependencies {
  db: AppDatabase;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  const { db } = dependencies;

  app.use(cors({ origin: "http://127.0.0.1:5173" }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/health", createHealthRouter());
  app.use("/api/providers", createProvidersRouter(db));
  app.use("/api/models", createModelsRouter(db));
  app.use(errorHandler);

  return app;
}

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
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
