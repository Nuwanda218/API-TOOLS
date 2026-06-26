import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpClientManager } from "./client.js";
import { ProviderError } from "../errors/providerError.js";
import type { McpServerRecord } from "./types.js";

const sdkMocks = vi.hoisted(() => {
  const clientInstances: Array<{
    connect: ReturnType<typeof vi.fn>;
    listTools: ReturnType<typeof vi.fn>;
    callTool: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }> = [];
  const transportOptions: unknown[] = [];

  const createClient = () => {
    const client = {
      connect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue({ tools: [] }),
      callTool: vi.fn().mockResolvedValue({ content: [] }),
      close: vi.fn().mockResolvedValue(undefined)
    };
    clientInstances.push(client);
    return client;
  };

  return {
    clientInstances,
    transportOptions,
    Client: vi.fn().mockImplementation(createClient),
    StdioClientTransport: vi.fn().mockImplementation((options: unknown) => {
      transportOptions.push(options);
      return { options };
    })
  };
});

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: sdkMocks.Client
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: sdkMocks.StdioClientTransport
}));

describe("McpClientManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdkMocks.clientInstances.length = 0;
    sdkMocks.transportOptions.length = 0;
  });

  it("connects to a stdio server and lists tools", async () => {
    const manager = new McpClientManager();
    const server = createServer();

    await manager.connect(server);
    const client = sdkMocks.clientInstances[0];
    client.listTools.mockResolvedValue({
      tools: [{
        name: "read_file",
        title: "Read File",
        description: "Read a file",
        inputSchema: { type: "object", properties: { path: { type: "string" } } }
      }]
    });

    const tools = await manager.listTools(server.id);

    expect(sdkMocks.StdioClientTransport).toHaveBeenCalledWith(expect.objectContaining({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "F:\\tmp"],
      env: expect.objectContaining({ ROOT: "F:\\tmp" })
    }));
    expect(client.connect).toHaveBeenCalledWith({ options: sdkMocks.transportOptions[0] });
    expect(tools).toEqual([{
      name: "read_file",
      title: "Read File",
      description: "Read a file",
      inputSchema: { type: "object", properties: { path: { type: "string" } } }
    }]);
  });

  it("calls tools and reports MCP content blocks", async () => {
    const manager = new McpClientManager();
    const server = createServer();
    await manager.connect(server);
    const client = sdkMocks.clientInstances[0];
    client.callTool.mockResolvedValue({
      content: [{ type: "text", text: "ok" }],
      isError: false
    });

    const result = await manager.callTool(server.id, "read_file", { path: "F:\\tmp\\a.txt" });

    expect(client.callTool).toHaveBeenCalledWith({
      name: "read_file",
      arguments: { path: "F:\\tmp\\a.txt" }
    });
    expect(result).toEqual({
      ok: true,
      content: [{ type: "text", text: "ok" }],
      isError: false,
      latencyMs: expect.any(Number)
    });
  });

  it("disconnects connected clients", async () => {
    const manager = new McpClientManager();
    const server = createServer();
    await manager.connect(server);
    const client = sdkMocks.clientInstances[0];

    await manager.disconnect(server.id);

    expect(client.close).toHaveBeenCalled();
    await expect(manager.callTool(server.id, "read_file", {})).rejects.toMatchObject({
      code: "mcp_server_not_connected"
    });
  });

  it("throws a provider error when a server is not connected", async () => {
    const manager = new McpClientManager();

    await expect(manager.listTools("missing")).rejects.toBeInstanceOf(ProviderError);
    await expect(manager.callTool("missing", "read_file", {})).rejects.toMatchObject({
      code: "mcp_server_not_connected",
      statusCode: 400
    });
  });
});

function createServer(): McpServerRecord {
  return {
    id: "mcp-1",
    name: "Filesystem",
    transport: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "F:\\tmp"],
    env: { ROOT: "F:\\tmp" },
    enabled: true,
    createdAt: "2026-06-25T00:00:00.000Z",
    updatedAt: "2026-06-25T00:00:00.000Z"
  };
}
