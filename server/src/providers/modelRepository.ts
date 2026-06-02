import type { AppDatabase } from "../db/client.js";
import { nanoid } from "nanoid";

export type ModelCapability = "chat" | "image" | "multimodal";

export interface ModelDefaultParams {
  temperature?: number;
  maxTokens?: number;
  imageSize?: string;
}

export interface ModelPricing {
  inputTokenPrice?: number;
  outputTokenPrice?: number;
  imagePrice?: number;
}

export interface Model {
  id: string;
  providerId: string;
  displayName: string;
  modelId: string;
  capability: ModelCapability;
  enabled: boolean;
  defaultParams: ModelDefaultParams;
  pricing: ModelPricing;
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelInput {
  id?: string;
  providerId: string;
  displayName: string;
  modelId: string;
  capability: ModelCapability;
  enabled?: boolean;
  defaultParams?: ModelDefaultParams;
  pricing?: ModelPricing;
}

export type UpdateModelInput = Partial<Omit<CreateModelInput, "id" | "providerId">> & {
  providerId?: string;
};

interface ModelRow {
  id: string;
  provider_id: string;
  display_name: string;
  model_id: string;
  capability: ModelCapability;
  enabled: number;
  default_params_json: string;
  pricing_json: string;
  created_at: string;
  updated_at: string;
}

export class ModelRepository {
  constructor(private readonly db: AppDatabase) {}

  create(input: CreateModelInput): Model {
    const now = new Date().toISOString();
    const id = input.id ?? nanoid();

    this.db.prepare(`
      insert into models (
        id,
        provider_id,
        display_name,
        model_id,
        capability,
        enabled,
        default_params_json,
        pricing_json,
        created_at,
        updated_at
      )
      values (
        @id,
        @providerId,
        @displayName,
        @modelId,
        @capability,
        @enabled,
        @defaultParamsJson,
        @pricingJson,
        @createdAt,
        @updatedAt
      )
    `).run({
      id,
      providerId: input.providerId,
      displayName: input.displayName,
      modelId: input.modelId,
      capability: input.capability,
      enabled: input.enabled === false ? 0 : 1,
      defaultParamsJson: JSON.stringify(input.defaultParams ?? {}),
      pricingJson: JSON.stringify(input.pricing ?? {}),
      createdAt: now,
      updatedAt: now
    });

    return this.getById(id) as Model;
  }

  getById(id: string): Model | undefined {
    const row = this.db.prepare("select * from models where id = @id").get<ModelRow>({ id });
    return row ? mapModelRow(row) : undefined;
  }

  list(): Model[] {
    return this.db
      .prepare("select * from models order by created_at asc, display_name asc")
      .all<ModelRow>()
      .map(mapModelRow);
  }

  listByProvider(providerId: string): Model[] {
    return this.db
      .prepare("select * from models where provider_id = @providerId order by created_at asc, display_name asc")
      .all<ModelRow>({ providerId })
      .map(mapModelRow);
  }

  update(id: string, input: UpdateModelInput): Model | undefined {
    const current = this.getById(id);
    if (!current) return undefined;

    this.db.prepare(`
      update models
      set provider_id = @providerId,
          display_name = @displayName,
          model_id = @modelId,
          capability = @capability,
          enabled = @enabled,
          default_params_json = @defaultParamsJson,
          pricing_json = @pricingJson,
          updated_at = @updatedAt
      where id = @id
    `).run({
      id,
      providerId: input.providerId ?? current.providerId,
      displayName: input.displayName ?? current.displayName,
      modelId: input.modelId ?? current.modelId,
      capability: input.capability ?? current.capability,
      enabled: input.enabled ?? current.enabled ? 1 : 0,
      defaultParamsJson: JSON.stringify(input.defaultParams ?? current.defaultParams),
      pricingJson: JSON.stringify(input.pricing ?? current.pricing),
      updatedAt: nextTimestamp(current.updatedAt)
    });

    return this.getById(id);
  }

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;

    this.db.prepare("delete from models where id = @id").run({ id });
    return true;
  }
}

export function createModelRepository(db: AppDatabase): ModelRepository {
  return new ModelRepository(db);
}

function mapModelRow(row: ModelRow): Model {
  return {
    id: row.id,
    providerId: row.provider_id,
    displayName: row.display_name,
    modelId: row.model_id,
    capability: row.capability,
    enabled: row.enabled === 1,
    defaultParams: parseJsonObject<ModelDefaultParams>(row.default_params_json),
    pricing: parseJsonObject<ModelPricing>(row.pricing_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseJsonObject<T>(value: string): T {
  const parsed: unknown = JSON.parse(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as T : {} as T;
}

function nextTimestamp(previous: string): string {
  const now = new Date().toISOString();
  return now === previous ? new Date(Date.parse(now) + 1).toISOString() : now;
}
