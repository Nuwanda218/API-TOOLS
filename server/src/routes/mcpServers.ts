import { basename } from "node:path";
import { Router } from "express";
import { z } from "zod";
import { getAllowedMcpCommands } from "../config/env.js";
import type { AppDatabase } from "../db/client.js";
import { ProviderError } from "../errors/providerError.js";
import { McpClientManager, type McpManagerLike } from "../mcp/client.js";
import { createMcpServerRepository } from "../mcp/mcpServerRepository.js";

const mcpServerSchema = z.object({
  name: z.string().min(1),
  transport: z.enum(["stdio"]).default("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  enabled: z.boolean().default(true)
});

const updateMcpServerSchema = mcpServerSchema.partial();

interface McpServersRouterDependencies {
  env: NodeJS.ProcessEnv;
  mcpManager?: McpManagerLike;
}

export function createMcpServersRouter(db: AppDatabase, dependencies: McpServersRouterDependencies) {
  const router = Router();
  const servers = createMcpServerRepository(db);
  const mcpManager = dependencies.mcpManager ?? new McpClientManager();

  router.get("/", (_req, res) => {
    res.json(servers.list());
  });

  router.post("/", (req, res, next) => {
    try {
      const input = mcpServerSchema.parse(req.body);
      ensureAllowedCommand(input.command, dependencies.env);
      res.status(201).json(servers.create(input));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", (req, res) => {
    const server = servers.getById(req.params.id);
    if (!server) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json(server);
  });

  router.patch("/:id", (req, res, next) => {
    try {
      const input = updateMcpServerSchema.parse(req.body);
      if (input.command) ensureAllowedCommand(input.command, dependencies.env);

      const updated = servers.update(req.params.id, input);
      if (!updated) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/tools", async (req, res, next) => {
    try {
      const server = getServerOrThrow(servers, req.params.id);
      await mcpManager.connect(server);
      const tools = await mcpManager.listTools(server.id);

      res.json({
        ok: true,
        serverId: server.id,
        tools
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/test", async (req, res, next) => {
    try {
      const server = getServerOrThrow(servers, req.params.id);
      await mcpManager.connect(server);
      const tools = await mcpManager.listTools(server.id);

      res.json({
        ok: true,
        serverId: server.id,
        toolCount: tools.length
      });
    } catch (error) {
      next(error);
    } finally {
      await mcpManager.disconnect(req.params.id);
    }
  });

  router.delete("/:id", async (req, res) => {
    const deleted = servers.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    await mcpManager.disconnect(req.params.id);
    res.status(204).send();
  });

  return router;
}

function getServerOrThrow(servers: ReturnType<typeof createMcpServerRepository>, id: string) {
  const server = servers.getById(id);
  if (!server) {
    throw new ProviderError("mcp_server_not_found", "MCP Server not found", { statusCode: 404 });
  }

  return server;
}

function ensureAllowedCommand(command: string, env: NodeJS.ProcessEnv) {
  const allowedCommands = getAllowedMcpCommands(env).map(normalizeCommand);
  if (allowedCommands.includes(normalizeCommand(command))) return;

  throw new ProviderError("unsupported_operation", "MCP command is not allowed", {
    providerMessage: `Allowed MCP commands: ${getAllowedMcpCommands(env).join(", ")}`,
    statusCode: 400,
    suggestion: "Add the command to MCP_ALLOWED_COMMANDS only if you trust the executable."
  });
}

function normalizeCommand(command: string): string {
  return basename(command).replace(/\.(cmd|exe)$/i, "").toLowerCase();
}
