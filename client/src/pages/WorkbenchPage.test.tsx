import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../api/client";
import { NotificationProvider } from "../components/notifications/NotificationProvider";
import { WorkbenchPage } from "./WorkbenchPage";

function renderWithNotifications(ui: ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

describe("WorkbenchPage", () => {
  it("runs a single llm.chat workflow with the selected model", async () => {
    const api = {
      listModels: vi.fn().mockResolvedValue([
        {
          id: "model-1",
          providerId: "provider-1",
          displayName: "Fast Chat",
          modelId: "fast-chat",
          capability: "chat",
          enabled: true,
          defaultParams: {},
          pricing: {},
          createdAt: "2026-06-08T00:00:00.000Z",
          updatedAt: "2026-06-08T00:00:00.000Z"
        }
      ]),
      runWorkflow: vi.fn().mockResolvedValue({
        session: { id: "session-1", title: "Workbench", workflowType: "api-workflow" },
        run: { id: "run-1", status: "succeeded" },
        outputs: {
          "main-response": {
            content: "A short test response."
          }
        }
      })
    };

    renderWithNotifications(<WorkbenchPage api={api} />);

    expect(await screen.findByText("Fast Chat")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("消息"), "Reply with one short sentence.");
    await userEvent.click(screen.getByRole("button", { name: "运行工作流" }));

    await waitFor(() =>
      expect(api.runWorkflow).toHaveBeenCalledWith({
        workflowType: "api-workflow",
        input: {
          message: "Reply with one short sentence."
        },
        steps: [
          {
            id: "main-response",
            type: "llm.chat",
            modelId: "model-1",
            input: {
              message: "{{input.message}}"
            }
          }
        ]
      })
    );

    expect(await screen.findByText("A short test response.")).toBeInTheDocument();
    expect(screen.getByText(/succeeded/)).toBeInTheDocument();
    expect(await screen.findByText("工作流运行成功")).toBeInTheDocument();
  });

  it("shows workflow error notifications with codes", async () => {
    const api = {
      listModels: vi.fn().mockResolvedValue([
        {
          id: "model-1",
          providerId: "provider-1",
          displayName: "Fast Chat",
          modelId: "fast-chat",
          capability: "chat",
          enabled: true,
          defaultParams: {},
          pricing: {},
          createdAt: "2026-06-08T00:00:00.000Z",
          updatedAt: "2026-06-08T00:00:00.000Z"
        }
      ]),
      runWorkflow: vi.fn().mockRejectedValue(
        new ApiClientError({
          code: "missing_api_key",
          message: "Missing API key env var: DEEPSEEK_API_KEY",
          providerMessage: "env var not found",
          statusCode: 400
        })
      )
    };

    renderWithNotifications(<WorkbenchPage api={api} />);

    expect(await screen.findByText("Fast Chat")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("消息"), "Reply with one short sentence.");
    await userEvent.click(screen.getByRole("button", { name: "运行工作流" }));

    expect(await screen.findByText("missing_api_key")).toBeInTheDocument();
    expect(await screen.findByText("missing_api_key: Missing API key env var: DEEPSEEK_API_KEY | env var not found")).toBeInTheDocument();
  });
});
