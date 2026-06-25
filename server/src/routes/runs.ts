import { Router } from "express";
import type { AppDatabase } from "../db/client.js";

interface RunRow {
  id: string;
  session_id: string;
  session_title: string;
  workflow_type: string;
  status: "running" | "succeeded" | "failed";
  started_at: string;
  ended_at: string | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  total_cost_estimate: number | null;
}

interface RunStepRow {
  id: string;
  run_id: string;
  step_index: number;
  step_type: string;
  provider_id: string;
  model_id: string | null;
  endpoint_id: string | null;
  status: "running" | "succeeded" | "failed";
  input_preview: string;
  output_preview: string | null;
  error_code: string | null;
  error_message: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_estimate: number | null;
  created_at: string;
  updated_at: string;
}

export function createRunsRouter(db: AppDatabase) {
  const router = Router();

  router.get("/", (_req, res) => {
    const rows = db.prepare(`
      select
        runs.id,
        runs.session_id,
        sessions.title as session_title,
        runs.workflow_type,
        runs.status,
        runs.started_at,
        runs.ended_at,
        runs.total_input_tokens,
        runs.total_output_tokens,
        runs.total_cost_estimate
      from runs
      join sessions on sessions.id = runs.session_id
      order by runs.started_at desc
    `).all<RunRow>();

    res.json(mapRunsWithSteps(db, rows));
  });

  router.get("/:id", (req, res) => {
    const row = db.prepare(`
      select
        runs.id,
        runs.session_id,
        sessions.title as session_title,
        runs.workflow_type,
        runs.status,
        runs.started_at,
        runs.ended_at,
        runs.total_input_tokens,
        runs.total_output_tokens,
        runs.total_cost_estimate
      from runs
      join sessions on sessions.id = runs.session_id
      where runs.id = @id
    `).get<RunRow>({ id: req.params.id });

    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json(mapRunsWithSteps(db, [row])[0]);
  });

  return router;
}

function mapRunsWithSteps(db: AppDatabase, rows: RunRow[]) {
  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    sessionTitle: row.session_title,
    workflowType: row.workflow_type,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    totalInputTokens: row.total_input_tokens,
    totalOutputTokens: row.total_output_tokens,
    totalCostEstimate: row.total_cost_estimate,
    steps: listSteps(db, row.id)
  }));
}

function listSteps(db: AppDatabase, runId: string) {
  const rows = db.prepare(`
    select *
    from run_steps
    where run_id = @runId
    order by step_index asc
  `).all<RunStepRow>({ runId });

  return rows.map((row) => ({
    id: row.id,
    runId: row.run_id,
    stepIndex: row.step_index,
    stepType: row.step_type,
    providerId: row.provider_id,
    modelId: row.model_id,
    endpointId: row.endpoint_id,
    status: row.status,
    inputPreview: row.input_preview,
    outputPreview: row.output_preview,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    latencyMs: row.latency_ms,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    costEstimate: row.cost_estimate,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}
