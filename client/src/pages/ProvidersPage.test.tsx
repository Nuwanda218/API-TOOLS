import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { NotificationProvider } from "../components/notifications/NotificationProvider";
import { ProvidersPage } from "./ProvidersPage";

function renderWithNotifications(ui: ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

describe("ProvidersPage", () => {
  it("creates a provider and refreshes the local list", async () => {
    const providersAfterCreate = [
      {
        id: "provider-1",
        name: "DeepSeek",
        type: "openai-compatible" as const,
        apiFormat: "openai-chat-completions" as const,
        baseUrl: "https://api.deepseek.com/v1",
        apiKeyEnv: "DEEPSEEK_API_KEY",
        enabled: true,
        createdAt: "2026-06-08T00:00:00.000Z",
        updatedAt: "2026-06-08T00:00:00.000Z"
      }
    ];
    const api = {
      listProviders: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(providersAfterCreate),
      createProvider: vi.fn().mockResolvedValue({
        id: "provider-1",
        name: "DeepSeek",
        type: "openai-compatible",
        apiFormat: "openai-chat-completions",
        baseUrl: "https://api.deepseek.com/v1",
        apiKeyEnv: "DEEPSEEK_API_KEY",
        enabled: true,
        createdAt: "2026-06-08T00:00:00.000Z",
        updatedAt: "2026-06-08T00:00:00.000Z"
      }),
      deleteProvider: vi.fn()
    };

    renderWithNotifications(<ProvidersPage api={api} />);

    await userEvent.type(screen.getByLabelText("名称"), "DeepSeek");
    await userEvent.type(screen.getByLabelText("Base URL"), "https://api.deepseek.com/v1");
    await userEvent.type(screen.getByLabelText("API Key 环境变量"), "DEEPSEEK_API_KEY");
    await userEvent.click(screen.getByRole("button", { name: "添加 Provider" }));

    await waitFor(() =>
      expect(api.createProvider).toHaveBeenCalledWith({
        name: "DeepSeek",
        type: "openai-compatible",
        apiFormat: "openai-chat-completions",
        baseUrl: "https://api.deepseek.com/v1",
        apiKeyEnv: "DEEPSEEK_API_KEY",
        enabled: true
      })
    );
    expect((await screen.findAllByText("供应商已创建：DeepSeek")).length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText("DeepSeek")).toBeInTheDocument();
    expect(screen.getAllByText("openai-chat-completions").length).toBeGreaterThan(0);
    expect(api.listProviders).toHaveBeenCalledTimes(2);
  });

  it("shows provider creation errors", async () => {
    const api = {
      listProviders: vi.fn().mockResolvedValue([]),
      createProvider: vi.fn().mockRejectedValue(new Error("Invalid provider base URL")),
      deleteProvider: vi.fn()
    };

    renderWithNotifications(<ProvidersPage api={api} />);

    await userEvent.type(screen.getByLabelText("名称"), "Broken");
    await userEvent.type(screen.getByLabelText("Base URL"), "https://example.com/v1");
    await userEvent.type(screen.getByLabelText("API Key 环境变量"), "BROKEN_API_KEY");
    await userEvent.click(screen.getByRole("button", { name: "添加 Provider" }));

    expect((await screen.findAllByText("Invalid provider base URL")).length).toBeGreaterThanOrEqual(1);
  });

  it("rejects raw API keys before creating a provider", async () => {
    const api = {
      listProviders: vi.fn().mockResolvedValue([]),
      createProvider: vi.fn(),
      deleteProvider: vi.fn()
    };

    renderWithNotifications(<ProvidersPage api={api} />);

    await userEvent.type(screen.getByLabelText("名称"), "DeepSeek");
    await userEvent.type(screen.getByLabelText("Base URL"), "https://api.deepseek.com/v1");
    await userEvent.type(screen.getByLabelText("API Key 环境变量"), "sk-e7c5cfcf8e3a4444a0479f264e39c52d");
    await userEvent.click(screen.getByRole("button", { name: "添加 Provider" }));

    expect(
      (await screen.findAllByText("API Key 环境变量填变量名，例如 DEEPSEEK_API_KEY，不要填真实 key。")).length
    ).toBeGreaterThanOrEqual(1);
    expect(api.createProvider).not.toHaveBeenCalled();
  });

  it("deletes a provider and refreshes the list", async () => {
    const provider = {
      id: "provider-1",
      name: "DeepSeek",
      type: "openai-compatible" as const,
      apiFormat: "openai-chat-completions" as const,
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      enabled: true,
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z"
    };
    const api = {
      listProviders: vi.fn().mockResolvedValueOnce([provider]).mockResolvedValueOnce([]),
      createProvider: vi.fn(),
      deleteProvider: vi.fn().mockResolvedValue(undefined)
    };

    renderWithNotifications(<ProvidersPage api={api} />);

    expect(await screen.findByText("DeepSeek")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "删除 DeepSeek" }));

    await waitFor(() => expect(api.deleteProvider).toHaveBeenCalledWith("provider-1"));
    expect((await screen.findAllByText("供应商已删除：DeepSeek")).length).toBeGreaterThanOrEqual(1);
    expect(api.listProviders).toHaveBeenCalledTimes(2);
  });

  it("shows provider deletion errors", async () => {
    const provider = {
      id: "provider-1",
      name: "DeepSeek",
      type: "openai-compatible" as const,
      apiFormat: "openai-chat-completions" as const,
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      enabled: true,
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z"
    };
    const api = {
      listProviders: vi.fn().mockResolvedValue([provider]),
      createProvider: vi.fn(),
      deleteProvider: vi.fn().mockRejectedValue(new Error("Provider delete failed"))
    };

    renderWithNotifications(<ProvidersPage api={api} />);

    expect(await screen.findByText("DeepSeek")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "删除 DeepSeek" }));

    expect((await screen.findAllByText("Provider delete failed")).length).toBeGreaterThanOrEqual(1);
  });
});
