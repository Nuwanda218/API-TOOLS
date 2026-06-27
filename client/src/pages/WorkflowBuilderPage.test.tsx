import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { EndpointRecord, McpServerRecord, ModelRecord } from "../api/types";
import { NotificationProvider } from "../components/notifications/NotificationProvider";
import { WorkflowBuilderPage } from "./WorkflowBuilderPage";

function renderWithNotifications(ui: ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

const model: ModelRecord = {
  id: "model-1",
  providerId: "provider-1",
  displayName: "DeepSeek Chat",
  modelId: "deepseek-chat",
  capability: "chat",
  enabled: true,
  defaultParams: {},
  pricing: {}
};

const endpoint: EndpointRecord = {
  id: "endpoint-1",
  providerId: "provider-1",
  name: "Search Endpoint",
  operationId: "http.request",
  method: "POST",
  path: "/search",
  queryTemplate: {},
  headersTemplate: {},
  bodyTemplate: {},
  enabled: true
};

const mcpServer: McpServerRecord = {
  id: "mcp-1",
  name: "Search MCP",
  transport: "stdio",
  command: "npx",
  args: [],
  env: {},
  enabled: true
};

describe("WorkflowBuilderPage", () => {
  it("builds and runs llm, endpoint, and mcp workflow steps", async () => {
    const api = {
      listModels: vi.fn().mockResolvedValue([model]),
      listEndpoints: vi.fn().mockResolvedValue([endpoint]),
      listMcpServers: vi.fn().mockResolvedValue([mcpServer]),
      runWorkflow: vi.fn().mockResolvedValue({
        session: { id: "session-1", title: "Hello", workflowType: "api-workflow" },
        run: { id: "run-1", status: "succeeded" },
        outputs: {
          "step-1": { content: "keywords" },
          "step-2": { body: { result: "endpoint result" }, statusCode: 200 },
          "step-3": { content: [{ type: "text", text: "mcp result" }], isError: false }
        }
      })
    };

    renderWithNotifications(<WorkflowBuilderPage api={api} />);

    await waitFor(() => expect(api.listModels).toHaveBeenCalled());

    await userEvent.selectOptions(screen.getByLabelText("新增步骤类型"), "llm.chat");
    await userEvent.click(screen.getByRole("button", { name: "添加步骤" }));
    expect(screen.getByText("DeepSeek Chat")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("新增步骤类型"), "endpoint.call");
    await userEvent.click(screen.getByRole("button", { name: "添加步骤" }));
    await userEvent.selectOptions(screen.getByLabelText("新增步骤类型"), "mcp.call");
    await userEvent.click(screen.getByRole("button", { name: "添加步骤" }));

    fireEvent.change(screen.getByLabelText("工作流输入 JSON"), { target: { value: "{\"message\":\"Hello\"}" } });
    await userEvent.type(screen.getByLabelText("step-3 工具名"), "web_search");
    await userEvent.click(screen.getByRole("button", { name: "运行工作流" }));

    await waitFor(() =>
      expect(api.runWorkflow).toHaveBeenCalledWith({
        workflowType: "api-workflow",
        input: { message: "Hello" },
        steps: [
          {
            id: "step-1",
            type: "llm.chat",
            modelId: "model-1",
            input: { message: "{{input.message}}" }
          },
          {
            id: "step-2",
            type: "endpoint.call",
            endpointId: "endpoint-1",
            input: { prompt: "{{input.message}}" }
          },
          {
            id: "step-3",
            type: "mcp.call",
            mcpServerId: "mcp-1",
            toolName: "web_search",
            input: { query: "{{input.message}}" }
          }
        ]
      })
    );
    expect(await screen.findByText(/endpoint result/)).toBeInTheDocument();
    expect(await screen.findByText("工作流运行成功")).toBeInTheDocument();
  });
});
