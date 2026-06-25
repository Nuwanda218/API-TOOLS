import type { AppDatabase } from "../db/client.js";
import { nanoid } from "nanoid";

export type ProviderType = "openai-compatible" | "openai-official";
export type ProviderApiFormat = "openai-chat-completions" | "openai-responses" | "claude-messages";

export interface ProviderCapabilities {
  supportsChat: boolean;
  supportsModelListing: boolean;
  supportsManualModelImport: boolean;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsRemoteConversation: boolean;
  requiresManualModelImport: boolean;
}

export const DEFAULT_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  supportsChat: true,
  supportsModelListing: true,
  supportsManualModelImport: true,
  supportsStreaming: false,
  supportsToolCalling: false,
  supportsVision: false,
  supportsRemoteConversation: false,
  requiresManualModelImport: false
};

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  apiFormat: ProviderApiFormat;
  baseUrl: string;
  apiKeyEnv: string;
  capabilities: ProviderCapabilities;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderInput {
  id?: string;
  name: string;
  type: ProviderType;
  apiFormat?: ProviderApiFormat;
  baseUrl: string;
  apiKeyEnv: string;
  capabilities?: Partial<ProviderCapabilities>;
  enabled?: boolean;
}

export type UpdateProviderInput = Partial<Omit<CreateProviderInput, "id">>;

interface ProviderRow {
  id: string;
  name: string;
  type: ProviderType;
  api_format: ProviderApiFormat;
  base_url: string;
  api_key_env: string;
  capabilities_json: string;
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
      insert into providers (id, name, type, api_format, base_url, api_key_env, capabilities_json, enabled, created_at, updated_at)
      values (@id, @name, @type, @apiFormat, @baseUrl, @apiKeyEnv, @capabilitiesJson, @enabled, @createdAt, @updatedAt)
    `).run({
      id,
      name: input.name,
      type: input.type,
      apiFormat: input.apiFormat ?? "openai-chat-completions",
      baseUrl: input.baseUrl,
      apiKeyEnv: input.apiKeyEnv,
      capabilitiesJson: JSON.stringify(mergeCapabilities(input.capabilities)),
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
          api_format = @apiFormat,
          base_url = @baseUrl,
          api_key_env = @apiKeyEnv,
          capabilities_json = @capabilitiesJson,
          enabled = @enabled,
          updated_at = @updatedAt
      where id = @id
    `).run({
      id,
      name: input.name ?? current.name,
      type: input.type ?? current.type,
      apiFormat: input.apiFormat ?? current.apiFormat,
      baseUrl: input.baseUrl ?? current.baseUrl,
      apiKeyEnv: input.apiKeyEnv ?? current.apiKeyEnv,
      capabilitiesJson: JSON.stringify(mergeCapabilities(input.capabilities, current.capabilities)),
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
    apiFormat: row.api_format,
    baseUrl: row.base_url,
    apiKeyEnv: row.api_key_env,
    capabilities: parseCapabilities(row.capabilities_json),
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mergeCapabilities(
  capabilities: Partial<ProviderCapabilities> | undefined,
  base: ProviderCapabilities = DEFAULT_PROVIDER_CAPABILITIES
): ProviderCapabilities {
  return {
    ...base,
    ...capabilities
  };
}

function parseCapabilities(value: string): ProviderCapabilities {
  try {
    const parsed = JSON.parse(value) as Partial<ProviderCapabilities>;
    return mergeCapabilities(parsed);
  } catch {
    return DEFAULT_PROVIDER_CAPABILITIES;
  }
}

function nextTimestamp(previous: string): string {
  const now = new Date().toISOString();
  return now === previous ? new Date(Date.parse(now) + 1).toISOString() : now;
}
