import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProvidersPage } from "./ProvidersPage";

describe("ProvidersPage", () => {
  it("creates a provider and refreshes the local list", async () => {
    const api = {
      listProviders: vi.fn().mockResolvedValue([]),
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
      })
    };

    render(<ProvidersPage api={api} />);

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
    expect(await screen.findByText("DeepSeek")).toBeInTheDocument();
    expect(screen.getAllByText("openai-chat-completions").length).toBeGreaterThan(0);
  });
});
