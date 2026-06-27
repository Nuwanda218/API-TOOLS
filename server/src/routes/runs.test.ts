import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("run routes", () => {
  it("lists runs with trace steps", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });
    const providerResponse = await request(app).post("/api/providers").send({
      name: "DeepSeek",
      type: "openai-compatible",
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      enabled: true
    });
    const modelResponse = await request(app).post("/api/models").send({
      providerId: providerResponse.body.id,
      displayName: "deepseek-chat",
      modelId: "deepseek-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: {}
    });
    const now = "2026-06-23T08:00:00.000Z";

    db.prepare(`
      insert into sessions (id, title, workflow_type, created_at, updated_at)
      values ('session-1', 'Model smoke test', 'model-test', @now, @now)
    `).run({ now });
    db.prepare(`
      insert into runs (
        id,
        session_id,
        workflow_type,
        status,
        started_at,
        ended_at,
        total_input_tokens,
        total_output_tokens,
        total_cost_estimate
      )
      values ('run-1', 'session-1', 'model-test', 'failed', @now, @now, 8, 2, 0.001)
    `).run({ now });
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
        output_preview,
        error_code,
        error_message,
        latency_ms,
        input_tokens,
        output_tokens,
        cost_estimate,
        created_at,
        updated_at
      )
      values (
        'step-1',
        'run-1',
        0,
        'model-test',
        @providerId,
        @modelId,
        'failed',
        '只回复 ok',
        null,
        'rate_limited',
        'Provider request failed',
        803,
        8,
        2,
        0.001,
        @now,
        @now
      )
    `).run({
      providerId: providerResponse.body.id,
      modelId: modelResponse.body.id,
      now
    });

    const listResponse = await request(app).get("/api/runs");
    const detailResponse = await request(app).get("/api/runs/run-1");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([
      expect.objectContaining({
        id: "run-1",
        sessionId: "session-1",
        sessionTitle: "Model smoke test",
        workflowType: "model-test",
        status: "failed",
        totalInputTokens: 8,
        totalOutputTokens: 2,
        totalCostEstimate: 0.001,
        steps: [
          expect.objectContaining({
            id: "step-1",
            stepType: "model-test",
            providerId: providerResponse.body.id,
            modelId: modelResponse.body.id,
            status: "failed",
            inputPreview: "只回复 ok",
            errorCode: "rate_limited",
            errorMessage: "Provider request failed",
            latencyMs: 803,
            inputTokens: 8,
            outputTokens: 2
          })
        ]
      })
    ]);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.id).toBe("run-1");

    db.close();
  });

  it("lists endpoint.call trace steps with endpoint ids", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });
    const providerResponse = await request(app).post("/api/providers").send({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_KEY",
      enabled: true
    });
    const endpointResponse = await request(app).post("/api/endpoints").send({
      providerId: providerResponse.body.id,
      name: "Echo",
      operationId: "http.request",
      method: "POST",
      path: "/echo",
      bodyTemplate: { prompt: "{{input.prompt}}" },
      enabled: true
    });
    const now = "2026-06-23T08:00:00.000Z";

    db.prepare(`
      insert into sessions (id, title, workflow_type, created_at, updated_at)
      values ('session-endpoint', 'Endpoint workflow', 'api-workflow', @now, @now)
    `).run({ now });
    db.prepare(`
      insert into runs (id, session_id, workflow_type, status, started_at, ended_at)
      values ('run-endpoint', 'session-endpoint', 'api-workflow', 'succeeded', @now, @now)
    `).run({ now });
    db.prepare(`
      insert into run_steps (
        id,
        run_id,
        step_index,
        step_type,
        provider_id,
        model_id,
        endpoint_id,
        status,
        input_preview,
        output_preview,
        latency_ms,
        cost_estimate,
        created_at,
        updated_at
      )
      values (
        'step-endpoint',
        'run-endpoint',
        0,
        'endpoint.call',
        @providerId,
        null,
        @endpointId,
        'succeeded',
        '{"prompt":"Hello"}',
        '{"received":"Hello"}',
        12,
        0,
        @now,
        @now
      )
    `).run({
      providerId: providerResponse.body.id,
      endpointId: endpointResponse.body.id,
      now
    });

    const response = await request(app).get("/api/runs/run-endpoint");

    expect(response.status).toBe(200);
    expect(response.body.steps).toEqual([
      expect.objectContaining({
        id: "step-endpoint",
        stepType: "endpoint.call",
        providerId: providerResponse.body.id,
        modelId: null,
        endpointId: endpointResponse.body.id,
        inputPreview: '{"prompt":"Hello"}',
        outputPreview: '{"received":"Hello"}',
        latencyMs: 12,
        costEstimate: 0
      })
    ]);

    db.close();
  });

  it("returns 404 for missing runs", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const response = await request(app).get("/api/runs/missing-run");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });

    db.close();
  });
});
