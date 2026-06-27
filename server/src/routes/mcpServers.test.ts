import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("mcp server routes", () => {
  it("creates, lists, updates, and deletes MCP servers", async () => {
    const db = createTestDatabase();
    const app = createApp({
      db,
      env: { MCP_ALLOWED_COMMANDS: "npx,node" }
    });

    const created = await request(app).post("/api/mcp-servers").send({
      name: "Filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "F:\\tmp"],
      env: { ROOT: "F:\\tmp" },
      enabled: true
    });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      id: expect.any(String),
      name: "Filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "F:\\tmp"],
      env: { ROOT: "F:\\tmp" },
      enabled: true
    });

    const list = await request(app).get("/api/mcp-servers");
    expect(list.body).toEqual([created.body]);

    const updated = await request(app)
      .patch(`/api/mcp-servers/${created.body.id}`)
      .send({ name: "Filesystem disabled", enabled: false });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      id: created.body.id,
      name: "Filesystem disabled",
      enabled: false
    });

    const deleted = await request(app).delete(`/api/mcp-servers/${created.body.id}`);
    expect(deleted.status).toBe(204);
    expect((await request(app).get("/api/mcp-servers")).body).toEqual([]);

    db.close();
  });

  it("rejects commands outside the MCP command whitelist", async () => {
    const db = createTestDatabase();
    const app = createApp({
      db,
      env: { MCP_ALLOWED_COMMANDS: "npx,node" }
    });

    const response = await request(app).post("/api/mcp-servers").send({
      name: "Shell",
      command: "powershell",
      args: ["-NoProfile"],
      enabled: true
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: "unsupported_operation",
      message: "MCP command is not allowed"
    });

    db.close();
  });

  it("connects and lists tools for an MCP server", async () => {
    const db = createTestDatabase();
    const mcpManager = createMcpManagerStub();
    mcpManager.listTools.mockResolvedValue([{
      name: "read_file",
      description: "Read file",
      inputSchema: { type: "object" }
    }]);
    const app = createApp({
      db,
      env: { MCP_ALLOWED_COMMANDS: "npx,node" },
      mcpManager
    });
    const created = await createFilesystemServer(app);

    const response = await request(app).get(`/api/mcp-servers/${created.body.id}/tools`);

    expect(response.status).toBe(200);
    expect(mcpManager.connect).toHaveBeenCalledWith(expect.objectContaining({ id: created.body.id }));
    expect(mcpManager.listTools).toHaveBeenCalledWith(created.body.id);
    expect(response.body).toEqual({
      ok: true,
      serverId: created.body.id,
      tools: [{
        name: "read_file",
        description: "Read file",
        inputSchema: { type: "object" }
      }]
    });

    db.close();
  });

  it("tests MCP server connection and disconnects after the test", async () => {
    const db = createTestDatabase();
    const mcpManager = createMcpManagerStub();
    mcpManager.listTools.mockResolvedValue([{ name: "search", inputSchema: {} }]);
    const app = createApp({
      db,
      env: { MCP_ALLOWED_COMMANDS: "npx,node" },
      mcpManager
    });
    const created = await createFilesystemServer(app);

    const response = await request(app).post(`/api/mcp-servers/${created.body.id}/test`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      serverId: created.body.id,
      toolCount: 1
    });
    expect(mcpManager.disconnect).toHaveBeenCalledWith(created.body.id);

    db.close();
  });
});

function createMcpManagerStub() {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(true)
  };
}

async function createFilesystemServer(app: ReturnType<typeof createApp>) {
  return request(app).post("/api/mcp-servers").send({
    name: "Filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "F:\\tmp"],
    env: { ROOT: "F:\\tmp" },
    enabled: true
  });
}
