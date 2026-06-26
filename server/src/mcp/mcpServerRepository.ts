import { nanoid } from "nanoid";
import type { AppDatabase } from "../db/client.js";
import type { CreateMcpServerInput, McpServerRecord, McpTransport, UpdateMcpServerInput } from "./types.js";

interface McpServerRow {
  id: string;
  name: string;
  transport: McpTransport;
  command: string;
  args_json: string;
  env_json: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export class McpServerRepository {
  constructor(private readonly db: AppDatabase) {}

  create(input: CreateMcpServerInput): McpServerRecord {
    const now = new Date().toISOString();
    const id = input.id ?? nanoid();

    this.db.prepare(`
      insert into mcp_servers (
        id,
        name,
        transport,
        command,
        args_json,
        env_json,
        enabled,
        created_at,
        updated_at
      )
      values (
        @id,
        @name,
        @transport,
        @command,
        @argsJson,
        @envJson,
        @enabled,
        @createdAt,
        @updatedAt
      )
    `).run({
      id,
      name: input.name,
      transport: input.transport ?? "stdio",
      command: input.command,
      argsJson: JSON.stringify(input.args ?? []),
      envJson: JSON.stringify(input.env ?? {}),
      enabled: input.enabled === false ? 0 : 1,
      createdAt: now,
      updatedAt: now
    });

    return this.getById(id) as McpServerRecord;
  }

  list(): McpServerRecord[] {
    return this.db
      .prepare("select * from mcp_servers order by created_at asc, name asc")
      .all<McpServerRow>()
      .map(mapMcpServerRow);
  }

  getById(id: string): McpServerRecord | undefined {
    const row = this.db.prepare("select * from mcp_servers where id = @id").get<McpServerRow>({ id });
    return row ? mapMcpServerRow(row) : undefined;
  }

  update(id: string, input: UpdateMcpServerInput): McpServerRecord | undefined {
    const current = this.getById(id);
    if (!current) return undefined;

    this.db.prepare(`
      update mcp_servers
      set name = @name,
          transport = @transport,
          command = @command,
          args_json = @argsJson,
          env_json = @envJson,
          enabled = @enabled,
          updated_at = @updatedAt
      where id = @id
    `).run({
      id,
      name: input.name ?? current.name,
      transport: input.transport ?? current.transport,
      command: input.command ?? current.command,
      argsJson: JSON.stringify(input.args ?? current.args),
      envJson: JSON.stringify(input.env ?? current.env),
      enabled: input.enabled ?? current.enabled ? 1 : 0,
      updatedAt: nextTimestamp(current.updatedAt)
    });

    return this.getById(id);
  }

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;

    this.db.prepare("delete from mcp_servers where id = @id").run({ id });
    return true;
  }
}

export function createMcpServerRepository(db: AppDatabase): McpServerRepository {
  return new McpServerRepository(db);
}

function mapMcpServerRow(row: McpServerRow): McpServerRecord {
  return {
    id: row.id,
    name: row.name,
    transport: row.transport,
    command: row.command,
    args: parseJsonArray(row.args_json),
    env: parseStringRecord(row.env_json),
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseJsonArray(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
}

function parseStringRecord(value: string): Record<string, string> {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function nextTimestamp(previous: string): string {
  const now = new Date().toISOString();
  return now === previous ? new Date(Date.parse(now) + 1).toISOString() : now;
}
