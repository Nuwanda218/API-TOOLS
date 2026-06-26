import { describe, expect, it } from "vitest";
import { createEndpointRepository } from "../endpoints/endpointRepository.js";
import { createMcpServerRepository } from "../mcp/mcpServerRepository.js";
import { createModelRepository } from "../providers/modelRepository.js";
import { createProviderRepository } from "../providers/providerRepository.js";
import { createSkillRepository } from "../skills/skillRepository.js";
import { createTestDatabase } from "../test/testDb.js";
import { buildConfigurationExport, importConfiguration } from "./configExport.js";

describe("configuration export", () => {
  it("exports providers, models, and endpoints without API key values", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);
    const endpoints = createEndpointRepository(db);
    const mcpServers = createMcpServerRepository(db);
    const skills = createSkillRepository(db);

    const provider = providers.create({
      id: "provider-1",
      name: "DeepSeek",
      type: "openai-compatible",
      apiFormat: "openai-chat-completions",
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      capabilities: { supportsChat: true, supportsModelListing: true },
      enabled: true
    });
    models.create({
      id: "model-1",
      providerId: provider.id,
      displayName: "deepseek-chat",
      modelId: "deepseek-chat",
      capability: "chat",
      enabled: true,
      defaultParams: { temperature: 0.2 },
      pricing: {}
    });
    endpoints.create({
      id: "endpoint-1",
      providerId: provider.id,
      name: "Chat completion",
      operationId: "http.request",
      method: "POST",
      path: "/chat/completions",
      queryTemplate: {},
      headersTemplate: { "X-Test": "{{input.test}}" },
      bodyTemplate: { model: "deepseek-chat" },
      enabled: true
    });
    mcpServers.create({
      id: "mcp-1",
      name: "Search MCP",
      transport: "stdio",
      command: "node",
      args: ["server.js"],
      env: { SEARCH_TOKEN: "mcp-secret-value" },
      enabled: true
    });
    skills.create({
      id: "skill-1",
      name: { "zh-CN": "摘要", en: "Summary" },
      description: { "zh-CN": "生成摘要", en: "Generate summary" },
      parameters: [{ key: "message", label: { "zh-CN": "消息", en: "Message" }, type: "text", required: true }],
      steps: [{ id: "summarize", type: "llm.chat", modelId: "model-1", input: { message: "{{input.message}}" } }]
    });

    const exported = buildConfigurationExport(db, { DEEPSEEK_API_KEY: "real-secret-value" });

    expect(JSON.stringify(exported)).not.toContain("real-secret-value");
    expect(JSON.stringify(exported)).not.toContain("mcp-secret-value");
    expect(exported).toMatchObject({
      version: 2,
      providers: [
        {
          id: "provider-1",
          name: "DeepSeek",
          apiKeyEnv: "DEEPSEEK_API_KEY"
        }
      ],
      models: [
        {
          id: "model-1",
          providerId: "provider-1",
          modelId: "deepseek-chat"
        }
      ],
      endpoints: [
        {
          id: "endpoint-1",
          providerId: "provider-1",
          path: "/chat/completions"
        }
      ],
      mcpServers: [
        {
          id: "mcp-1",
          name: "Search MCP",
          env: { SEARCH_TOKEN: "__RECONFIGURE_REQUIRED__" }
        }
      ],
      skills: [
        {
          id: "skill-1",
          name: { "zh-CN": "摘要", en: "Summary" }
        }
      ],
      missingApiKeyEnvs: []
    });

    db.close();
  });

  it("reports missing API key env vars", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);

    providers.create({
      id: "provider-1",
      name: "TJU",
      type: "openai-compatible",
      apiFormat: "openai-chat-completions",
      baseUrl: "https://ai.tju.edu.cn/api/v3",
      apiKeyEnv: "TJU_API_KEY",
      enabled: true
    });

    const exported = buildConfigurationExport(db, {});

    expect(exported.missingApiKeyEnvs).toEqual(["TJU_API_KEY"]);

    db.close();
  });

  it("imports configuration by upserting providers, models, endpoints, MCP servers, and skills", () => {
    const db = createTestDatabase();

    const result = importConfiguration(db, {
      version: 2,
      providers: [
        {
          id: "provider-1",
          name: "Imported Provider",
          type: "openai-compatible",
          apiFormat: "openai-chat-completions",
          baseUrl: "https://example.test/v1",
          apiKeyEnv: "EXAMPLE_API_KEY",
          capabilities: { supportsChat: true },
          enabled: true
        }
      ],
      models: [
        {
          id: "model-1",
          providerId: "provider-1",
          displayName: "example-chat",
          modelId: "example-chat",
          capability: "chat",
          enabled: true,
          defaultParams: {},
          pricing: {}
        }
      ],
      endpoints: [
        {
          id: "endpoint-1",
          providerId: "provider-1",
          name: "Example endpoint",
          operationId: "http.request",
          method: "POST",
          path: "/chat/completions",
          queryTemplate: {},
          headersTemplate: {},
          bodyTemplate: { model: "example-chat" },
          enabled: true
        }
      ],
      mcpServers: [
        {
          id: "mcp-1",
          name: "Imported MCP",
          transport: "stdio",
          command: "node",
          args: ["mcp.js"],
          env: { SEARCH_TOKEN: "__RECONFIGURE_REQUIRED__" },
          enabled: true
        }
      ],
      skills: [
        {
          id: "skill-1",
          name: { "zh-CN": "导入技能", en: "Imported skill" },
          description: { "zh-CN": "导入描述", en: "Imported description" },
          parameters: [],
          steps: [{ id: "call", type: "endpoint.call", endpointId: "endpoint-1", input: { prompt: "{{input.message}}" } }]
        }
      ],
      missingApiKeyEnvs: []
    });

    expect(result).toEqual({ providers: 1, models: 1, endpoints: 1, mcpServers: 1, skills: 1 });
    expect(createProviderRepository(db).getById("provider-1")?.name).toBe("Imported Provider");
    expect(createModelRepository(db).getById("model-1")?.modelId).toBe("example-chat");
    expect(createEndpointRepository(db).getById("endpoint-1")?.path).toBe("/chat/completions");
    expect(createMcpServerRepository(db).getById("mcp-1")?.name).toBe("Imported MCP");
    expect(createSkillRepository(db).getById("skill-1")?.name.en).toBe("Imported skill");

    db.close();
  });
});
