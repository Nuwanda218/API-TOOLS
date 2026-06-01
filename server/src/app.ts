import cors from "cors";
import express from "express";
import { createHealthRouter } from "./routes/health.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: "http://127.0.0.1:5173" }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/health", createHealthRouter());

  return app;
}
