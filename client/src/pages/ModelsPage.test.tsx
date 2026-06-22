import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ModelRecord, ProviderRecord } from "../api/types";
import { NotificationProvider } from "../components/notifications/NotificationProvider";
import { ModelsPage } from "./ModelsPage";

function renderWithNotifications(ui: ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

const provider: ProviderRecord = {
  id: "provider-1",
  name: "DeepSeek",
  type: "openai-compatible",
  apiFormat: "openai-chat-completions",
  baseUrl: "https://api.deepseek.com/v1",
  apiKeyEnv: "DEEPSEEK_API_KEY",
  capabilities: {
    supportsChat: true,
    supportsModelListing: true,
    supportsManualModelImport: true,
    supportsStreaming: false,
    supportsToolCalling: false,
    supportsVision: false,
    supportsRemoteConversation: false,
    requiresManualModelImport: false
  },
  enabled: true
};

const model: ModelRecord = {
  id: "model-1",
  providerId: "provider-1",
  displayName: "deepseek-chat",
  modelId: "deepseek-chat",
  capability: "chat",
  enabled: true,
  defaultParams: {},
  pricing: {}
};

function createApi(overrides: Partial<Parameters<typeof ModelsPage>[0]["api"]> = {}) {
  return {
    listProviders: vi.fn().mockResolvedValue([provider]),
    listModels: vi.fn().mockResolvedValue([]),
    createModel: vi.fn().mockResolvedValue(model),
    testModel: vi.fn().mockResolvedValue({
      ok: true,
      latencyMs: 123,
      message: "ok.",
      usage: { inputTokens: 8, outputTokens: 2 }
    }),
    listRemoteModels: vi.fn().mockResolvedValue({
      ok: true,
      providerId: "provider-1",
      models: [
        { id: "deepseek-chat", ownedBy: "deepseek" },
        { id: "deepseek-reasoner", ownedBy: "deepseek" }
      ]
    }),
    importModels: vi.fn().mockResolvedValue({ created: [model], skipped: [] }),
    deleteModel: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("ModelsPage", () => {
  it("creates a model and refreshes the local list", async () => {
    const api = createApi({
      listModels: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([model])
    });

    renderWithNotifications(<ModelsPage api={api} />);

    await screen.findByText("DeepSeek");
    await userEvent.type(screen.getByLabelText("显示名称"), "deepseek-chat");
    await userEvent.type(screen.getByLabelText("Model ID"), "deepseek-chat");
    await userEvent.click(screen.getByRole("button", { name: "添加模型" }));

    await waitFor(() => expect(api.createModel).toHaveBeenCalledWith(modelWithoutId(model)));
    expect((await screen.findAllByText("模型已创建：deepseek-chat")).length).toBeGreaterThanOrEqual(1);
    expect(api.listModels).toHaveBeenCalledTimes(2);
  });

  it("fetches remote models and reports the count", async () => {
    const api = createApi();

    renderWithNotifications(<ModelsPage api={api} />);

    await screen.findByText("DeepSeek");
    await userEvent.click(screen.getByRole("button", { name: "拉取远程模型" }));

    expect((await screen.findAllByText("已拉取 2 个远程模型")).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("deepseek-chat")).toBeInTheDocument();
  });

  it("imports a remote model and reports created and skipped counts", async () => {
    const api = createApi({
      listModels: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([model])
    });

    renderWithNotifications(<ModelsPage api={api} />);

    await screen.findByText("DeepSeek");
    await userEvent.click(screen.getByRole("button", { name: "拉取远程模型" }));
    await screen.findByText("deepseek-chat");
    await userEvent.click(screen.getAllByRole("button", { name: "导入" })[0]);

    expect((await screen.findAllByText("导入完成：新增 1 个，跳过 0 个")).length).toBeGreaterThanOrEqual(1);
    expect(api.listModels).toHaveBeenCalledTimes(2);
  });

  it("tests a model and reports latency plus usage", async () => {
    const api = createApi({ listModels: vi.fn().mockResolvedValue([model]) });

    renderWithNotifications(<ModelsPage api={api} />);

    expect(await screen.findByRole("button", { name: "测试 deepseek-chat" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "测试 deepseek-chat" }));

    expect((await screen.findAllByText("成功: ok. (123ms, tokens 8/2)")).length).toBeGreaterThanOrEqual(1);
  });

  it("deletes a model and refreshes the local list", async () => {
    const api = createApi({
      listModels: vi.fn().mockResolvedValueOnce([model]).mockResolvedValueOnce([])
    });

    renderWithNotifications(<ModelsPage api={api} />);

    expect(await screen.findByRole("button", { name: "删除 deepseek-chat" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "删除 deepseek-chat" }));

    await waitFor(() => expect(api.deleteModel).toHaveBeenCalledWith("model-1"));
    expect((await screen.findAllByText("模型已删除：deepseek-chat")).length).toBeGreaterThanOrEqual(1);
    expect(api.listModels).toHaveBeenCalledTimes(2);
  });

  it("shows model deletion errors", async () => {
    const api = createApi({
      listModels: vi.fn().mockResolvedValue([model]),
      deleteModel: vi.fn().mockRejectedValue(new Error("Model delete failed"))
    });

    renderWithNotifications(<ModelsPage api={api} />);

    expect(await screen.findByRole("button", { name: "删除 deepseek-chat" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "删除 deepseek-chat" }));

    expect((await screen.findAllByText("Model delete failed")).length).toBeGreaterThanOrEqual(1);
  });
});

function modelWithoutId(input: ModelRecord) {
  return {
    providerId: input.providerId,
    displayName: input.displayName,
    modelId: input.modelId,
    capability: input.capability,
    enabled: input.enabled,
    defaultParams: input.defaultParams,
    pricing: input.pricing
  };
}
