import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { McpServerRecord } from "../api/types";
import { NotificationProvider } from "../components/notifications/NotificationProvider";
import { McpServersPage } from "./McpServersPage";

function renderWithNotifications(ui: ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

const server: McpServerRecord = {
  id: "mcp-1",
  name: "Filesystem",
  transport: "stdio",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "F:/website"],
  env: {},
  enabled: true,
  createdAt: "2026-06-26T00:00:00.000Z",
  updatedAt: "2026-06-26T00:00:00.000Z"
};

describe("McpServersPage", () => {
  it("creates MCP servers, tests connection, lists tools, and deletes servers", async () => {
    const api = {
      listMcpServers: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([server]).mockResolvedValueOnce([]),
      createMcpServer: vi.fn().mockResolvedValue(server),
      updateMcpServer: vi.fn(),
      deleteMcpServer: vi.fn().mockResolvedValue(undefined),
      testMcpServer: vi.fn().mockResolvedValue({
        ok: true,
        serverId: "mcp-1",
        toolCount: 1,
        tools: [
          {
            name: "read_file",
            description: "Read a file from disk",
            inputSchema: {
              type: "object",
              properties: {
                path: { type: "string" }
              }
            }
          }
        ]
      }),
      listMcpServerTools: vi.fn().mockResolvedValue([
        {
          name: "read_file",
          description: "Read a file from disk",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string" }
            }
          }
        }
      ])
    };

    renderWithNotifications(<McpServersPage api={api} />);

    await userEvent.type(screen.getByLabelText("名称"), "Filesystem");
    fireEvent.change(screen.getByLabelText("命令"), { target: { value: "npx" } });
    fireEvent.change(screen.getByLabelText("参数 JSON"), {
      target: { value: "[\"-y\",\"@modelcontextprotocol/server-filesystem\",\"F:/website\"]" }
    });
    await userEvent.click(screen.getByRole("button", { name: "创建 MCP Server" }));

    await waitFor(() =>
      expect(api.createMcpServer).toHaveBeenCalledWith({
        name: "Filesystem",
        transport: "stdio",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "F:/website"],
        env: {},
        enabled: true
      })
    );
    expect((await screen.findAllByText("MCP Server 已创建：Filesystem")).length).toBeGreaterThanOrEqual(1);
    expect((await screen.findAllByText("Filesystem")).length).toBeGreaterThanOrEqual(1);

    await userEvent.click(screen.getByRole("button", { name: "测试 Filesystem" }));

    expect(api.testMcpServer).toHaveBeenCalledWith("mcp-1");
    expect((await screen.findAllByText("连接成功，发现 1 个工具")).length).toBeGreaterThanOrEqual(1);
    expect(api.listMcpServerTools).toHaveBeenCalledWith("mcp-1");
    expect(await screen.findByText("read_file")).toBeInTheDocument();
    expect(screen.getByText("Read a file from disk")).toBeInTheDocument();
    expect(screen.getByText(/"path"/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "删除 Filesystem" }));

    await waitFor(() => expect(api.deleteMcpServer).toHaveBeenCalledWith("mcp-1"));
    expect((await screen.findAllByText("MCP Server 已删除：Filesystem")).length).toBeGreaterThanOrEqual(1);
  });
});
