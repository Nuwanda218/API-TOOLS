import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { EndpointRecord, ProviderRecord } from "../api/types";
import { NotificationProvider } from "../components/notifications/NotificationProvider";
import { EndpointsPage } from "./EndpointsPage";

function renderWithNotifications(ui: ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

const provider: ProviderRecord = {
  id: "provider-1",
  name: "Example",
  type: "openai-compatible",
  apiFormat: "openai-chat-completions",
  baseUrl: "https://example.test/v1",
  apiKeyEnv: "EXAMPLE_KEY",
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

const endpoint: EndpointRecord = {
  id: "endpoint-1",
  providerId: "provider-1",
  name: "List models",
  operationId: "http.request",
  method: "GET",
  path: "/models",
  queryTemplate: { q: "{{input.query}}" },
  headersTemplate: {},
  bodyTemplate: null,
  enabled: true
};

describe("EndpointsPage", () => {
  it("creates endpoints, lists them, and runs endpoint tests", async () => {
    const api = {
      listProviders: vi.fn().mockResolvedValue([provider]),
      listEndpoints: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([endpoint]),
      createEndpoint: vi.fn().mockResolvedValue(endpoint),
      deleteEndpoint: vi.fn(),
      testEndpoint: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { "content-type": "application/json" },
        bodyPreview: { data: [] },
        latencyMs: 12
      })
    };

    renderWithNotifications(<EndpointsPage api={api} />);

    await screen.findByText("Example");
    await userEvent.type(screen.getByLabelText("名称"), "List models");
    await userEvent.type(screen.getByLabelText("Path"), "/models");
    fireEvent.change(screen.getByLabelText("Query JSON"), { target: { value: "{\"q\":\"{{input.query}}\"}" } });
    await userEvent.click(screen.getByRole("button", { name: "添加 Endpoint" }));

    await waitFor(() =>
      expect(api.createEndpoint).toHaveBeenCalledWith({
        providerId: "provider-1",
        name: "List models",
        operationId: "http.request",
        method: "GET",
        path: "/models",
        queryTemplate: { q: "{{input.query}}" },
        headersTemplate: {},
        bodyTemplate: undefined,
        enabled: true
      })
    );
    expect(await screen.findByText("List models")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("测试输入 JSON"), { target: { value: "{\"query\":\"chat\"}" } });
    await userEvent.click(screen.getByRole("button", { name: "测试 List models" }));

    expect(api.testEndpoint).toHaveBeenCalledWith("endpoint-1", { query: "chat" });
    expect((await screen.findAllByText("HTTP 200 (12ms)")).length).toBeGreaterThanOrEqual(1);
  });
});
