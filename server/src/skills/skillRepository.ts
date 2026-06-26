import { nanoid } from "nanoid";
import type { AppDatabase } from "../db/client.js";
import type { LocalizedText, SkillParameter, SkillTemplate } from "./templateRegistry.js";
import type { WorkflowStepDefinition } from "../workflows/types.js";

export interface CreateSkillInput {
  id?: string;
  name: LocalizedText;
  description: LocalizedText;
  parameters?: SkillParameter[];
  steps: WorkflowStepDefinition[];
}

export interface UpdateSkillInput {
  name?: LocalizedText;
  description?: LocalizedText;
  parameters?: SkillParameter[];
  steps?: WorkflowStepDefinition[];
}

interface SkillRow {
  id: string;
  name_json: string;
  description_json: string;
  parameters_json: string;
  steps_json: string;
  builtin: number;
  created_at: string;
  updated_at: string;
}

export class SkillRepository {
  constructor(private readonly db: AppDatabase) {}

  create(input: CreateSkillInput): SkillTemplate {
    const now = new Date().toISOString();
    const id = input.id ?? nanoid();

    this.db.prepare(`
      insert into skills (
        id,
        name_json,
        description_json,
        parameters_json,
        steps_json,
        builtin,
        created_at,
        updated_at
      )
      values (
        @id,
        @nameJson,
        @descriptionJson,
        @parametersJson,
        @stepsJson,
        0,
        @createdAt,
        @updatedAt
      )
    `).run({
      id,
      nameJson: JSON.stringify(input.name),
      descriptionJson: JSON.stringify(input.description),
      parametersJson: JSON.stringify(input.parameters ?? []),
      stepsJson: JSON.stringify(input.steps),
      createdAt: now,
      updatedAt: now
    });

    return this.getById(id) as SkillTemplate;
  }

  list(): SkillTemplate[] {
    return this.db
      .prepare("select * from skills order by created_at asc, id asc")
      .all<SkillRow>()
      .map(mapSkillRow);
  }

  getById(id: string): SkillTemplate | undefined {
    const row = this.db.prepare("select * from skills where id = @id").get<SkillRow>({ id });
    return row ? mapSkillRow(row) : undefined;
  }

  update(id: string, input: UpdateSkillInput): SkillTemplate | undefined {
    const current = this.getById(id);
    if (!current) return undefined;

    this.db.prepare(`
      update skills
      set name_json = @nameJson,
          description_json = @descriptionJson,
          parameters_json = @parametersJson,
          steps_json = @stepsJson,
          updated_at = @updatedAt
      where id = @id
    `).run({
      id,
      nameJson: JSON.stringify(input.name ?? current.name),
      descriptionJson: JSON.stringify(input.description ?? current.description),
      parametersJson: JSON.stringify(input.parameters ?? current.parameters),
      stepsJson: JSON.stringify(input.steps ?? current.steps),
      updatedAt: nextTimestamp(current.updatedAt ?? new Date().toISOString())
    });

    return this.getById(id);
  }

  delete(id: string): boolean {
    const existing = this.getById(id);
    if (!existing) return false;

    this.db.prepare("delete from skills where id = @id").run({ id });
    return true;
  }
}

export function createSkillRepository(db: AppDatabase): SkillRepository {
  return new SkillRepository(db);
}

function mapSkillRow(row: SkillRow): SkillTemplate {
  return {
    id: row.id,
    name: parseJson<LocalizedText>(row.name_json),
    description: parseJson<LocalizedText>(row.description_json),
    parameters: parseJson<SkillParameter[]>(row.parameters_json),
    steps: parseJson<WorkflowStepDefinition[]>(row.steps_json),
    builtin: row.builtin === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function nextTimestamp(previous: string): string {
  const now = new Date().toISOString();
  return now === previous ? new Date(Date.parse(now) + 1).toISOString() : now;
}
