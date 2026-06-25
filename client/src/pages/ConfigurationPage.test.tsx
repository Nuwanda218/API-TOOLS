import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ExportedConfiguration } from "../api/types";
import { NotificationProvider } from "../components/notifications/NotificationProvider";
import { ConfigurationPage } from "./ConfigurationPage";

function renderWithNotifications(ui: ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

const configuration: ExportedConfiguration = {
  version: 1,
  providers: [
    {
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
    }
  ],
  models: [],
  endpoints: [],
  missingApiKeyEnvs: ["DEEPSEEK_API_KEY"]
};

describe("ConfigurationPage", () => {
  it("exports configuration JSON and imports pasted configuration", async () => {
    const api = {
      exportConfiguration: vi.fn().mockResolvedValue(configuration),
      importConfiguration: vi.fn().mockResolvedValue({
        imported: { providers: 1, models: 0, endpoints: 0 }
      })
    };

    const { container } = renderWithNotifications(<ConfigurationPage api={api} />);

    await userEvent.click(screen.getByRole("button", { name: "导出配置" }));

    await waitFor(() => {
      expect((screen.getByLabelText("导出 JSON") as HTMLTextAreaElement).value).toContain("DEEPSEEK_API_KEY");
    });
    expect(screen.getByText("缺失 Key：DEEPSEEK_API_KEY")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("导入 JSON"), {
      target: { value: JSON.stringify(configuration) }
    });
    await userEvent.click(screen.getByRole("button", { name: "导入配置" }));

    expect(api.importConfiguration).toHaveBeenCalledWith(configuration);
    await waitFor(() => {
      expect(container.textContent).toContain("Provider 1");
      expect(container.textContent).toContain("Model 0");
      expect(container.textContent).toContain("Endpoint 0");
    });
  });
});
