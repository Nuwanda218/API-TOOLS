import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../test/testDb.js";
import { createMcpServerRepository } from "./mcpServerRepository.js";

describe("mcpServerRepository", () => {
  it("creates, lists, updates, and deletes stdio MCP servers", () => {
    const db = createTestDatabase();
    const servers = createMcpServerRepository(db);

    const created = servers.create({
      name: "Filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "F:\\tmp"],
      env: { ROOT: "F:\\tmp" },
      enabled: true
    });

    expect(created).toEqual(expect.objectContaining({
      id: expect.any(String),
      name: "Filesystem",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "F:\\tmp"],
      env: { ROOT: "F:\\tmp" },
      enabled: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    }));
    expect(servers.list()).toEqual([created]);
    expect(servers.getById(created.id)).toEqual(created);

    const updated = servers.update(created.id, {
      name: "Filesystem Local",
      args: ["F:\\workspace"],
      env: { ROOT: "F:\\workspace" },
      enabled: false
    });

    expect(updated).toEqual(expect.objectContaining({
      id: created.id,
      name: "Filesystem Local",
      transport: "stdio",
      command: "npx",
      args: ["F:\\workspace"],
      env: { ROOT: "F:\\workspace" },
      enabled: false
    }));
    expect(updated?.updatedAt).not.toBe(created.updatedAt);

    expect(servers.delete(created.id)).toBe(true);
    expect(servers.getById(created.id)).toBeUndefined();
    expect(servers.delete(created.id)).toBe(false);

    db.close();
  });
});
