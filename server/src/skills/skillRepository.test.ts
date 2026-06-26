import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../test/testDb.js";
import { createSkillRepository } from "./skillRepository.js";

describe("skill repository", () => {
  it("creates, lists, gets, updates, and deletes custom skill templates", () => {
    const db = createTestDatabase();
    const skills = createSkillRepository(db);

    const created = skills.create({
      id: "custom-skill",
      name: { "zh-CN": "自定义模板", en: "Custom Skill" },
      description: { "zh-CN": "描述", en: "Description" },
      parameters: [
        { key: "model", label: { "zh-CN": "模型", en: "Model" }, required: true, type: "model" }
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

    expect(created).toMatchObject({
      id: "custom-skill",
      builtin: false,
      name: { "zh-CN": "自定义模板", en: "Custom Skill" }
    });
    expect(skills.list()).toEqual([created]);
    expect(skills.getById("custom-skill")).toEqual(created);

    const updated = skills.update("custom-skill", {
      description: { "zh-CN": "更新描述", en: "Updated description" }
    });

    expect(updated?.description.en).toBe("Updated description");
    expect(skills.delete("custom-skill")).toBe(true);
    expect(skills.list()).toEqual([]);

    db.close();
  });
});
