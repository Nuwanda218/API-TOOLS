import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AdapterRegistry, ModelAdapter } from "../adapters/types.js";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("skill routes", () => {
  it("lists builtin skill templates", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const response = await request(app).get("/api/skills");

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThanOrEqual(3);
    expect(response.body[0]).toMatchObject({
      builtin: true,
      id: expect.any(String),
      name: expect.objectContaining({ "zh-CN": expect.any(String), en: expect.any(String) }),
      parameters: expect.any(Array),
      steps: expect.any(Array)
    });

    db.close();
  });

  it("creates and retrieves a custom skill template", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const createResponse = await request(app).post("/api/skills").send({
      id: "custom-reply",
      name: { "zh-CN": "自定义回复", en: "Custom Reply" },
      description: { "zh-CN": "调用一个模型回复", en: "Calls one model" },
      parameters: [
        { key: "model", label: { "zh-CN": "模型", en: "Model" }, required: true, type: "model" },
        { key: "text", label: { "zh-CN": "文本", en: "Text" }, required: true, type: "text" }
      ],
      steps: [
        {
          id: "reply",
          type: "llm.chat",
          modelId: "{{model}}",
          input: { message: "{{input.text}}" }
        }
      ]
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      id: "custom-reply",
      builtin: false,
      name: { "zh-CN": "自定义回复", en: "Custom Reply" }
    });

    const getResponse = await request(app).get("/api/skills/custom-reply");
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual(createResponse.body);

    db.close();
  });

  it("runs a custom skill template with runtime parameters", async () => {
    const db = createTestDatabase();
    const adapter: ModelAdapter = {
      listModels: async () => [],
      testModel: async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} }),
      runChat: async () => ({ content: "Skill reply", latencyMs: 8, usage: { inputTokens: 4, outputTokens: 2 } })
    };
    const adapterRegistry: AdapterRegistry = {
      getModelAdapter: () => adapter,
      invoke: async () => ({
        ok: true,
        data: { content: "Skill reply" },
        latencyMs: 8,
        usage: { inputTokens: 4, outputTokens: 2 }
      })
    };
    const app = createApp({ db, env: { CUSTOM_KEY: "secret" }, adapterRegistry });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_KEY",
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
    const skillResponse = await request(app).post("/api/skills").send({
      id: "custom-reply",
      name: { "zh-CN": "自定义回复", en: "Custom Reply" },
      description: { "zh-CN": "调用一个模型回复", en: "Calls one model" },
      parameters: [
        { key: "model", label: { "zh-CN": "模型", en: "Model" }, required: true, type: "model" },
        { key: "text", label: { "zh-CN": "文本", en: "Text" }, required: true, type: "text" }
      ],
      steps: [
        {
          id: "reply",
          type: "llm.chat",
          modelId: "{{model}}",
          input: { message: "{{input.text}}" }
        }
      ]
    });

    const runResponse = await request(app).post(`/api/skills/${skillResponse.body.id}/run`).send({
      parameters: {
        model: modelResponse.body.id,
        text: "Hello"
      }
    });

    expect(runResponse.status).toBe(200);
    expect(runResponse.body.run.status).toBe("succeeded");
    expect(runResponse.body.outputs.reply.content).toBe("Skill reply");

    db.close();
  });
});
