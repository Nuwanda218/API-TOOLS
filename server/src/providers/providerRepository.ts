import type { AppDatabase } from "../db/client.js";
import { nanoid } from "nanoid";

export type ProviderType = "openai-compatible" | "openai-official";

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKeyEnv: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderInput {
  id?: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKeyEnv: string;
  enabled?: boolean;
}

export type UpdateProviderInput = Partial<Omit<CreateProviderInput, "id">>;

interface ProviderRow {
  id: string;
  name: string;
  type: ProviderType;
  base_url: string;
  api_key_env: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export class ProviderRepository {
  constructor(private readonly db: AppDatabase) {}

  create(input: CreateProviderInput): Provider {
    const now = new Date().toISOString();
    const id = input.id ?? nanoid();

    this.db.prepare(`
      insert into providers (id, name, type, base_url, api_key_env, enabled, created_at, updated_at)
      values (@id, @name, @type, @baseUrl, @apiKeyEnv, @enabled, @createdAt, @updatedAt)
    `).run({
      id,
      name: input.name,
      type: input.type,
      baseUrl: input.baseUrl,
      apiKeyEnv: input.apiKeyEnv,
      enabled: input.enabled === false ? 0 : 1,
      createdAt: now,
      updatedAt: now
    });

    return this.getById(id) as Provider;
  }

  getById(id: string): Provider | undefined {
    const row = this.db.prepare("select * from providers where id = @id").get<ProviderRow>({ id });
    return row ? mapProviderRow(row) : undefined;
  }

  list(): Provider[] {
    return this.db
      .prepare("select * from providers order by created_at asc, name asc")
      .all<ProviderRow>()
      .map(mapProviderRow);
  }

  update(id: string, input: UpdateProviderInput): Provider | undefined {
    const current = this.getById(id);
    if (!current) return undefined;

    this.db.prepare(`
      update providers
      set name = @name,
          type = @type,
          base_url = @baseUrl,
          api_key_env = @apiKeyEnv,
          enabled = @enabled,
          updated_at = @updatedAt
      where id = @id
    `).run({
      id,
      name: input.name ?? current.name,
      type: input.type ?? current.type,
      baseUrl: input.baseUrl ?? current.baseUrl,
      apiKeyEnv: input.apiKeyEnv ?? current.apiKeyEnv,
      enabled: input.enabled ?? current.enabled ? 1 : 0,
      updatedAt: nextTimestamp(current.updatedAt)
    });

    return this.getById(id);
  }

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;

    this.db.prepare("delete from providers where id = @id").run({ id });
    return true;
  }
}

export function createProviderRepository(db: AppDatabase): ProviderRepository {
  return new ProviderRepository(db);
}

function mapProviderRow(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    baseUrl: row.base_url,
    apiKeyEnv: row.api_key_env,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function nextTimestamp(previous: string): string {
  const now = new Date().toISOString();
  return now === previous ? new Date(Date.parse(now) + 1).toISOString() : now;
}
