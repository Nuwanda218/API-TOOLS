import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ModelRecord, SkillTemplateRecord } from "../api/types";
import { NotificationProvider } from "../components/notifications/NotificationProvider";
import { WorkflowTemplatesPage } from "./WorkflowTemplatesPage";

function renderWithNotifications(ui: ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

const model: ModelRecord = {
  id: "model-1",
  providerId: "provider-1",
  displayName: "DeepSeek Chat",
  modelId: "deepseek-chat",
  capability: "chat",
  enabled: true,
  defaultParams: {},
  pricing: {}
};

const skill: SkillTemplateRecord = {
  id: "llm-single-reply",
  name: { "zh-CN": "单模型回复", en: "Single Model Reply" },
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
  ],
  builtin: true
};

describe("WorkflowTemplatesPage", () => {
  it("loads skill templates from the API and runs one with parameters", async () => {
    const api = {
      listSkills: vi.fn().mockResolvedValue([skill]),
      listModels: vi.fn().mockResolvedValue([model]),
      runSkill: vi.fn().mockResolvedValue({
        session: { id: "session-1", title: "Hello", workflowType: "api-workflow" },
        run: { id: "run-1", status: "succeeded" },
        outputs: { reply: { content: "Model reply" } }
      })
    };

    renderWithNotifications(<WorkflowTemplatesPage api={api} />);

    expect(screen.getByRole("heading", { name: "工作流模板" })).toBeInTheDocument();
    expect((await screen.findAllByText("单模型回复")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("调用一个模型回复")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("模型"), "model-1");
    await userEvent.type(screen.getByLabelText("文本"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "运行 单模型回复" }));

    await waitFor(() =>
      expect(api.runSkill).toHaveBeenCalledWith("llm-single-reply", {
        model: "model-1",
        text: "Hello"
      })
    );
    expect(await screen.findByText("Model reply")).toBeInTheDocument();
  });
});
