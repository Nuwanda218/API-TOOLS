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
  sessionTitle: "Model smoke test",
  workflowType: "model-test",
  status: "failed",
  startedAt: "2026-06-23T08:00:00.000Z",
  endedAt: "2026-06-23T08:00:01.000Z",
  totalInputTokens: 8,
  totalOutputTokens: 2,
  totalCostEstimate: 0.001,
  steps: [
    {
      id: "step-1",
      runId: "run-1",
      stepIndex: 0,
      stepType: "model-test",
      providerId: "provider-1",
      modelId: "model-1",
      status: "failed",
      inputPreview: "只回复 ok",
      outputPreview: null,
      errorCode: "rate_limited",
      errorMessage: "Provider request failed",
      latencyMs: 803,
      inputTokens: 8,
      outputTokens: 2,
      costEstimate: 0.001,
      createdAt: "2026-06-23T08:00:00.000Z",
      updatedAt: "2026-06-23T08:00:01.000Z"
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

    expect(await screen.findByText("Model smoke test")).toBeInTheDocument();
    expect(screen.getAllByText("failed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("rate_limited")).toBeInTheDocument();
    expect(screen.getByText("只回复 ok")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "查看 run-1" }));

    expect(api.getRun).toHaveBeenCalledWith("run-1");
    expect(await screen.findByText("Provider request failed")).toBeInTheDocument();
  });
});
