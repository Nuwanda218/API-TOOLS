import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { RunRecord } from "../api/types";
import { NotificationProvider } from "../components/notifications/NotificationProvider";
import { RunsPage } from "./RunsPage";

function renderWithNotifications(ui: ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

const run: RunRecord = {
  id: "run-1",
  sessionId: "session-1",
  sessionTitle: "Mixed workflow",
  workflowType: "api-workflow",
  status: "succeeded",
  startedAt: "2026-06-23T08:00:00.000Z",
  endedAt: "2026-06-23T08:00:01.000Z",
  totalInputTokens: 18,
  totalOutputTokens: 12,
  totalCostEstimate: 0.002,
  steps: [
    {
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
      inputPreview: "{\"message\":\"Summarize\"}",
      outputPreview: "Short answer",
      errorCode: null,
      errorMessage: null,
      latencyMs: 803,
      inputTokens: 8,
      outputTokens: 6,
      costEstimate: 0.001,
      createdAt: "2026-06-23T08:00:00.000Z",
      updatedAt: "2026-06-23T08:00:01.000Z"
    },
    {
      id: "step-2",
      runId: "run-1",
      stepIndex: 1,
      stepType: "endpoint.call",
      providerId: "provider-1",
      modelId: null,
      endpointId: "endpoint-1",
      mcpServerId: null,
      mcpToolName: null,
      status: "succeeded",
      inputPreview: "{\"prompt\":\"Hello\"}",
      outputPreview: "{\"statusCode\":200,\"bodyPreview\":{\"ok\":true}}",
      errorCode: null,
      errorMessage: null,
      latencyMs: 120,
      inputTokens: null,
      outputTokens: null,
      costEstimate: 0,
      createdAt: "2026-06-23T08:00:01.000Z",
      updatedAt: "2026-06-23T08:00:02.000Z"
    },
    {
      id: "step-3",
      runId: "run-1",
      stepIndex: 2,
      stepType: "mcp.call",
      providerId: null,
      modelId: null,
      endpointId: null,
      mcpServerId: "mcp-1",
      mcpToolName: "web_search",
      status: "succeeded",
      inputPreview: "{\"query\":\"API Tools\"}",
      outputPreview: "[{\"type\":\"text\",\"text\":\"Search result\"}]",
      errorCode: null,
      errorMessage: null,
      latencyMs: 90,
      inputTokens: null,
      outputTokens: null,
      costEstimate: 0,
      createdAt: "2026-06-23T08:00:02.000Z",
      updatedAt: "2026-06-23T08:00:03.000Z"
    }
  ]
};

describe("RunsPage", () => {
  it("renders run history and selected trace details", async () => {
    const api = {
      listRuns: vi.fn().mockResolvedValue([run]),
      getRun: vi.fn().mockResolvedValue(run)
    };

    renderWithNotifications(<RunsPage api={api} />);

    expect(await screen.findByText("Mixed workflow")).toBeInTheDocument();
    expect(screen.getAllByText("succeeded").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("LLM content")).toBeInTheDocument();
    expect(screen.getByText("Short answer")).toBeInTheDocument();
    expect(screen.getByText("HTTP status")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("MCP tool")).toBeInTheDocument();
    expect(screen.getByText("web_search")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "查看 run-1" }));

    expect(api.getRun).toHaveBeenCalledWith("run-1");
    expect(await screen.findByText("Search result")).toBeInTheDocument();
  });
});
