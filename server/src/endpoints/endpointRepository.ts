import { nanoid } from "nanoid";
import type { AppDatabase } from "../db/client.js";

export type EndpointMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Endpoint {
  id: string;
  providerId: string;
  name: string;
  operationId: string;
  method: EndpointMethod;
  path: string;
  queryTemplate: Record<string, unknown>;
  headersTemplate: Record<string, unknown>;
  bodyTemplate: unknown;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEndpointInput {
  id?: string;
  providerId: string;
  name: string;
  operationId: string;
  method: EndpointMethod;
  path: string;
  queryTemplate?: Record<string, unknown>;
  headersTemplate?: Record<string, unknown>;
  bodyTemplate?: unknown;
  enabled?: boolean;
}

export type UpdateEndpointInput = Partial<Omit<CreateEndpointInput, "id">>;

interface EndpointRow {
  id: string;
  provider_id: string;
  name: string;
  operation_id: string;
  method: EndpointMethod;
  path: string;
  query_template_json: string;
  headers_template_json: string;
  body_template_json: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export class EndpointRepository {
  constructor(private readonly db: AppDatabase) {}

  create(input: CreateEndpointInput): Endpoint {
    const now = new Date().toISOString();
    const id = input.id ?? nanoid();

    this.db.prepare(`
      insert into endpoints (
        id,
        provider_id,
        name,
        operation_id,
        method,
        path,
        query_template_json,
        headers_template_json,
        body_template_json,
        enabled,
        created_at,
        updated_at
      )
      values (
        @id,
        @providerId,
        @name,
        @operationId,
        @method,
        @path,
        @queryTemplateJson,
        @headersTemplateJson,
        @bodyTemplateJson,
        @enabled,
        @createdAt,
        @updatedAt
      )
    `).run({
      id,
      providerId: input.providerId,
      name: input.name,
      operationId: input.operationId,
      method: input.method,
      path: input.path,
      queryTemplateJson: JSON.stringify(input.queryTemplate ?? {}),
      headersTemplateJson: JSON.stringify(input.headersTemplate ?? {}),
      bodyTemplateJson: input.bodyTemplate === undefined ? null : JSON.stringify(input.bodyTemplate),
      enabled: input.enabled === false ? 0 : 1,
      createdAt: now,
      updatedAt: now
    });

    return this.getById(id) as Endpoint;
  }

  list(): Endpoint[] {
    return this.db
      .prepare("select * from endpoints order by created_at asc, name asc")
      .all<EndpointRow>()
      .map(mapEndpointRow);
  }

  listByProvider(providerId: string): Endpoint[] {
    return this.db
      .prepare("select * from endpoints where provider_id = @providerId order by created_at asc, name asc")
      .all<EndpointRow>({ providerId })
      .map(mapEndpointRow);
  }

  getById(id: string): Endpoint | undefined {
    const row = this.db.prepare("select * from endpoints where id = @id").get<EndpointRow>({ id });
    return row ? mapEndpointRow(row) : undefined;
  }

  update(id: string, input: UpdateEndpointInput): Endpoint | undefined {
    const current = this.getById(id);
    if (!current) return undefined;

    this.db.prepare(`
      update endpoints
      set provider_id = @providerId,
          name = @name,
          operation_id = @operationId,
          method = @method,
          path = @path,
          query_template_json = @queryTemplateJson,
          headers_template_json = @headersTemplateJson,
          body_template_json = @bodyTemplateJson,
          enabled = @enabled,
          updated_at = @updatedAt
      where id = @id
    `).run({
      id,
      providerId: input.providerId ?? current.providerId,
      name: input.name ?? current.name,
      operationId: input.operationId ?? current.operationId,
      method: input.method ?? current.method,
      path: input.path ?? current.path,
      queryTemplateJson: JSON.stringify(input.queryTemplate ?? current.queryTemplate),
      headersTemplateJson: JSON.stringify(input.headersTemplate ?? current.headersTemplate),
      bodyTemplateJson: input.bodyTemplate === undefined ? JSON.stringify(current.bodyTemplate) : JSON.stringify(input.bodyTemplate),
      enabled: input.enabled ?? current.enabled ? 1 : 0,
      updatedAt: nextTimestamp(current.updatedAt)
    });

    return this.getById(id);
  }

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;

    this.db.prepare("delete from endpoints where id = @id").run({ id });
    return true;
  }
}

export function createEndpointRepository(db: AppDatabase) {
  return new EndpointRepository(db);
}

function mapEndpointRow(row: EndpointRow): Endpoint {
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    operationId: row.operation_id,
    method: row.method,
    path: row.path,
    queryTemplate: parseJsonObject(row.query_template_json),
    headersTemplate: parseJsonObject(row.headers_template_json),
    bodyTemplate: row.body_template_json === null ? null : JSON.parse(row.body_template_json),
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseJsonObject(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
}

function nextTimestamp(previous: string): string {
  const now = new Date().toISOString();
  return now === previous ? new Date(Date.parse(now) + 1).toISOString() : now;
}
