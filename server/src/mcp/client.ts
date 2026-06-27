import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { McpCallResult, McpContentBlock, McpServerRecord, McpTool } from "./types.js";
import { ProviderError } from "../errors/providerError.js";

export interface McpManagerLike {
  connect(server: McpServerRecord): Promise<void>;
  listTools(serverId: string): Promise<McpTool[]>;
  callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<McpCallResult>;
  disconnect(serverId: string): Promise<boolean>;
}

interface McpClientEntry {
  client: Client;
  server: McpServerRecord;
}

export class McpClientManager implements McpManagerLike {
  private readonly clients = new Map<string, McpClientEntry>();

  async connect(server: McpServerRecord): Promise<void> {
    if (this.clients.has(server.id)) {
      await this.disconnect(server.id);
    }

    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      env: { ...getDefaultEnvironment(), ...server.env }
    });
    const client = new Client(
      { name: "api-tools", version: "0.3.0" },
      { capabilities: {} }
    );

    try {
      await client.connect(transport);
      this.clients.set(server.id, { client, server });
    } catch (error) {
      await closeQuietly(client);
      throw new ProviderError("mcp_connection_failed", "Could not connect to MCP Server", {
        providerMessage: error instanceof Error ? error.message : String(error),
        statusCode: 502,
        suggestion: "Check the MCP command, args, environment variables, and local runtime."
      });
    }
  }

  async listTools(serverId: string): Promise<McpTool[]> {
    const entry = this.requireConnected(serverId);
    const result = await entry.client.listTools();
    const tools = Array.isArray(result.tools) ? result.tools : [];

    return tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: normalizeObject(tool.inputSchema)
    }));
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<McpCallResult> {
    const entry = this.requireConnected(serverId);
    const startedAt = Date.now();

    try {
      const result = await entry.client.callTool({ name: toolName, arguments: args });
      const isError = Boolean((result as { isError?: boolean }).isError);

      return {
        ok: !isError,
        content: normalizeContentBlocks((result as { content?: unknown }).content),
        isError,
        latencyMs: Date.now() - startedAt
      };
    } catch (error) {
      throw new ProviderError("mcp_tool_error", "MCP tool call failed", {
        providerMessage: error instanceof Error ? error.message : String(error),
        statusCode: 502
      });
    }
  }

  async disconnect(serverId: string): Promise<boolean> {
    const entry = this.clients.get(serverId);
    if (!entry) return false;

    this.clients.delete(serverId);
    await closeQuietly(entry.client);
    return true;
  }

  private requireConnected(serverId: string): McpClientEntry {
    const entry = this.clients.get(serverId);
    if (!entry) {
      throw new ProviderError("mcp_server_not_connected", "MCP Server not connected", { statusCode: 400 });
    }

    return entry;
  }
}

function getDefaultEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

async function closeQuietly(client: Client): Promise<void> {
  try {
    await client.close();
  } catch {
    // Best-effort cleanup after failed MCP connection or explicit disconnect.
  }
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeContentBlocks(value: unknown): McpContentBlock[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({
      type: typeof entry.type === "string" ? entry.type : "unknown",
      text: typeof entry.text === "string" ? entry.text : undefined,
      data: typeof entry.data === "string" ? entry.data : undefined,
      mimeType: typeof entry.mimeType === "string" ? entry.mimeType : undefined
    }));
}
