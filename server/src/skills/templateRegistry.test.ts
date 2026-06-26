import { describe, expect, it } from "vitest";
import { listBuiltinSkillTemplates, resolveSkillTemplate } from "./templateRegistry.js";

describe("skill template registry", () => {
  it("lists builtin workflow templates with typed parameters", () => {
    const templates = listBuiltinSkillTemplates();

    expect(templates.length).toBeGreaterThanOrEqual(3);
    expect(templates[0]).toMatchObject({
      builtin: true,
      id: expect.any(String),
      name: expect.objectContaining({ "zh-CN": expect.any(String), en: expect.any(String) }),
      parameters: expect.any(Array),
      steps: expect.any(Array)
    });
  });

  it("resolves runtime resource parameters while preserving workflow input placeholders", () => {
    const template = {
      id: "custom-llm",
      name: { "zh-CN": "自定义 LLM", en: "Custom LLM" },
      description: { "zh-CN": "测试模板", en: "Test template" },
      parameters: [
        { key: "model", label: { "zh-CN": "模型", en: "Model" }, required: true, type: "model" as const },
        { key: "text", label: { "zh-CN": "文本", en: "Text" }, required: true, type: "text" as const }
      ],
      steps: [
        {
          id: "reply",
          type: "llm.chat" as const,
          modelId: "{{model}}",
          input: { message: "{{input.text}}" }
        }
      ],
      builtin: false
    };

    const resolved = resolveSkillTemplate(template, { model: "model-1", text: "hello" });

    expect(resolved.input).toEqual({ text: "hello" });
    expect(resolved.steps).toEqual([
      {
        id: "reply",
        type: "llm.chat",
        modelId: "model-1",
        input: { message: "{{input.text}}" }
      }
    ]);
  });

  it("rejects missing required parameters", () => {
    const template = listBuiltinSkillTemplates()[0];

    expect(() => resolveSkillTemplate(template, {})).toThrow(/Missing required skill parameter/);
  });
});
