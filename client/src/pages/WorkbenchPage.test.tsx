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

const mockModel = {
  id: "model-1",
  providerId: "provider-1",
  displayName: "Fast Chat",
  modelId: "fast-chat",
  capability: "chat" as const,
  enabled: true,
  defaultParams: {},
  pricing: {},
  createdAt: "2026-06-08T00:00:00.000Z",
  updatedAt: "2026-06-08T00:00:00.000Z"
};

function createApi(overrides: Record<string, unknown> = {}) {
  return {
    listModels: vi.fn().mockResolvedValue([mockModel]),
    listSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn().mockResolvedValue({ id: "s1", title: "t", workflowType: "api-workflow", createdAt: "", updatedAt: "", messageCount: 0, messages: [] }),
    createSession: vi.fn().mockResolvedValue({ id: "new-session", title: "New chat", workflowType: "api-workflow", createdAt: "", updatedAt: "", messageCount: 0 }),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    runWorkflow: vi.fn().mockResolvedValue({
      session: { id: "session-1", title: "Workbench", workflowType: "api-workflow" },
      run: { id: "run-1", status: "succeeded" },
      outputs: { "main-response": { content: "A short test response." } }
    }),
    getRun: vi.fn().mockResolvedValue({
      id: "run-1",
      sessionId: "session-1",
      sessionTitle: "Workbench",
      workflowType: "api-workflow",
      status: "succeeded",
      startedAt: "2026-06-08T00:00:00.000Z",
      endedAt: "2026-06-08T00:00:01.000Z",
      totalInputTokens: 10,
      totalOutputTokens: 5,
      totalCostEstimate: 0.0001,
      steps: [{
        id: "step-1",
        runId: "run-1",
        stepIndex: 0,
        stepType: "llm.chat",
        providerId: "provider-1",
        modelId: "model-1",
        endpointId: null,
        mcpServerId: null,
        mcpToolName: null,
        status: "succeeded",
        inputPreview: "Reply with one short sentence.",
        outputPreview: "A short test response.",
        errorCode: null,
        errorMessage: null,
        latencyMs: 320,
        inputTokens: 10,
        outputTokens: 5,
        costEstimate: 0.0001,
        createdAt: "2026-06-08T00:00:00.000Z",
        updatedAt: "2026-06-08T00:00:01.000Z"
      }]
    }),
    ...overrides
  };
}

describe("WorkbenchPage", () => {
  it("sends a message and displays the response with run details", async () => {
    const api = createApi();
    renderWithNotifications(<WorkbenchPage api={api} />);

    expect(await screen.findByText("Fast Chat")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("输入要发送给模型的内容"), "Reply with one short sentence.");
    await userEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(api.runWorkflow).toHaveBeenCalled());
    expect(await screen.findByText("A short test response.")).toBeInTheDocument();
    expect(await screen.findByText("发送成功")).toBeInTheDocument();
  });

  it("shows workflow error notifications with codes", async () => {
    const api = createApi({
      runWorkflow: vi.fn().mockRejectedValue(
        new ApiClientError({
          code: "missing_api_key",
          message: "Missing API key env var: DEEPSEEK_API_KEY",
          providerMessage: "env var not found",
          statusCode: 400
        })
      )
    });

    renderWithNotifications(<WorkbenchPage api={api} />);

    expect(await screen.findByText("Fast Chat")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("输入要发送给模型的内容"), "Reply with one short sentence.");
    await userEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(await screen.findByText("missing_api_key")).toBeInTheDocument();
  });

  it("creates a new session and switches between sessions", async () => {
    const existingSession = {
      id: "existing-1",
      title: "Old chat",
      workflowType: "api-workflow",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      messageCount: 2
    };

    const api = createApi({
      listSessions: vi.fn().mockResolvedValue([existingSession]),
      getSession: vi.fn().mockResolvedValue({
        ...existingSession,
        messages: [
          { id: "m1", role: "user", content: "Hello", modelId: null, runId: null, createdAt: "2026-06-01T00:00:00.000Z" },
          { id: "m2", role: "assistant", content: "Hi there", modelId: "model-1", runId: null, createdAt: "2026-06-01T00:00:01.000Z" }
        ]
      })
    });

    renderWithNotifications(<WorkbenchPage api={api} />);

    expect(await screen.findByText("Old chat")).toBeInTheDocument();
    expect(await screen.findByText("Hello")).toBeInTheDocument();
    expect(await screen.findByText("Hi there")).toBeInTheDocument();

    await userEvent.click(screen.getByText("+ 新建会话"));
    expect(api.createSession).toHaveBeenCalled();
  });
});
