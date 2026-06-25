import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

describe("DashboardPage", () => {
  it("shows provider, model, endpoint, and run counts", async () => {
    const api = {
      listProviders: vi.fn().mockResolvedValue([
        { id: "p1", name: "DeepSeek", apiFormat: "openai-chat-completions", apiKeyEnv: "KEY", capabilities: {}, enabled: true }
      ]),
      listModels: vi.fn().mockResolvedValue([
        { id: "m1", displayName: "Fast", modelId: "fast", capability: "chat", providerId: "p1", enabled: true, defaultParams: {}, pricing: {} }
      ]),
      listEndpoints: vi.fn().mockResolvedValue([]),
      listRuns: vi.fn().mockResolvedValue([]),
      getUsageSummary: vi.fn().mockResolvedValue({ requestCount: 1, inputTokens: 10, outputTokens: 5, estimatedCost: 0.001, errorCount: 0 })
    };

    render(<DashboardPage api={api} />);

    await waitFor(() => {
      expect(screen.getByText("10 / 5")).toBeInTheDocument();
    });
    expect(screen.getByText("$0.001000")).toBeInTheDocument();
  });

  it("shows empty state guidance when no data", async () => {
    const api = {
      listProviders: vi.fn().mockResolvedValue([]),
      listModels: vi.fn().mockResolvedValue([]),
      listEndpoints: vi.fn().mockResolvedValue([]),
      listRuns: vi.fn().mockResolvedValue([]),
      getUsageSummary: vi.fn().mockResolvedValue({ requestCount: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0, errorCount: 0 })
    };

    render(<DashboardPage api={api} language="zh-CN" />);

    await waitFor(() => {
      expect(screen.getByText("还没有接入任何 API。前往「API接入」添加 Provider 开始使用。")).toBeInTheDocument();
    });
  });

  it("shows English empty state guidance", async () => {
    const api = {
      listProviders: vi.fn().mockResolvedValue([]),
      listModels: vi.fn().mockResolvedValue([]),
      listEndpoints: vi.fn().mockResolvedValue([]),
      listRuns: vi.fn().mockResolvedValue([]),
      getUsageSummary: vi.fn().mockResolvedValue({ requestCount: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0, errorCount: 0 })
    };

    render(<DashboardPage api={api} language="en" />);

    await waitFor(() => {
      expect(screen.getByText("No providers connected yet. Go to Providers to add one.")).toBeInTheDocument();
    });
  });

  it("links to management pages from stat cards", async () => {
    const api = {
      listProviders: vi.fn().mockResolvedValue([]),
      listModels: vi.fn().mockResolvedValue([]),
      listEndpoints: vi.fn().mockResolvedValue([]),
      listRuns: vi.fn().mockResolvedValue([]),
      getUsageSummary: vi.fn().mockResolvedValue({ requestCount: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0, errorCount: 0 })
    };

    render(<DashboardPage api={api} language="zh-CN" />);

    await waitFor(() => {
      expect(screen.getByText("已接入 API")).toBeInTheDocument();
    });

    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("#/providers");
    expect(hrefs).toContain("#/models");
    expect(hrefs).toContain("#/endpoints");
    expect(hrefs).toContain("#/runs");
  });

  it("shows error when API fails", async () => {
    const api = {
      listProviders: vi.fn().mockRejectedValue(new Error("Connection refused")),
      listModels: vi.fn().mockRejectedValue(new Error("Connection refused")),
      listEndpoints: vi.fn().mockRejectedValue(new Error("Connection refused")),
      listRuns: vi.fn().mockRejectedValue(new Error("Connection refused")),
      getUsageSummary: vi.fn().mockRejectedValue(new Error("Connection refused"))
    };

    render(<DashboardPage api={api} />);

    await waitFor(() => {
      expect(screen.getByText("Connection refused")).toBeInTheDocument();
    });
  });
});
