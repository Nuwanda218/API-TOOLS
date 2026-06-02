import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("model test route", () => {
  it("reports missing API key without exposing a secret and records the failed run step", async () => {
    const db = createTestDatabase();
    const app = createApp({ db, env: { OTHER_KEY: "sk-should-not-leak" } });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_OPENAI_COMPATIBLE_KEY",
      enabled: true
    });
    const modelResponse = await request(app).post("/api/models").send({
      providerId: providerResponse.body.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: {}
    });

    const testResponse = await request(app).post(`/api/models/${modelResponse.body.id}/test`);

    expect(testResponse.status).toBe(400);
    expect(testResponse.body).toMatchObject({
      code: "missing_api_key",
      message: "Missing API key env var: CUSTOM_OPENAI_COMPATIBLE_KEY"
    });
    expect(JSON.stringify(testResponse.body)).not.toContain("sk-should-not-leak");

    const runs = db.prepare("select * from runs").all<{
      id: string;
      session_id: string;
      workflow_type: string;
      status: string;
      total_input_tokens: number | null;
      total_output_tokens: number | null;
    }>();
    const steps = db.prepare("select * from run_steps").all<{
      run_id: string;
      step_type: string;
      provider_id: string;
      model_id: string;
      status: string;
      input_preview: string;
      error_code: string;
      error_message: string;
      input_tokens: number | null;
      output_tokens: number | null;
    }>();

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      workflow_type: "model-test",
      status: "failed",
      total_input_tokens: null,
      total_output_tokens: null
    });
    expect(steps).toEqual([
      expect.objectContaining({
        run_id: runs[0].id,
        step_type: "model-test",
        provider_id: providerResponse.body.id,
        model_id: modelResponse.body.id,
        status: "failed",
        input_preview: "Reply with ok.",
        error_code: "missing_api_key",
        error_message: "Missing API key env var: CUSTOM_OPENAI_COMPATIBLE_KEY",
        input_tokens: null,
        output_tokens: null
      })
    ]);

    db.close();
  });
});
