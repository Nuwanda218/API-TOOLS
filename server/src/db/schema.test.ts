import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDatabase, type AppDatabase } from "./client.js";
import { createTestDatabase } from "../test/testDb.js";

const databases: AppDatabase[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  for (const database of databases.splice(0)) {
    database.close();
  }

  for (const tempDir of tempDirs.splice(0)) {
    await rm(tempDir, { force: true, recursive: true });
  }
});

describe("schema", () => {
  it("creates core tables", () => {
    const database = createTestDatabase();
    databases.push(database);

    const rows = database
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all<{ name: string }>();

    expect(rows.map((row) => row.name)).toEqual([
      "messages",
      "models",
      "providers",
      "run_steps",
      "runs",
      "sessions"
    ]);
  });

  it("persists provider rows when reopened from the same database file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "api-tools-db-"));
    tempDirs.push(tempDir);
    const databasePath = join(tempDir, "app.db");

    const database = createDatabase(databasePath);
    database
      .prepare(
        `insert into providers (id, name, type, base_url, api_key_env, enabled, created_at, updated_at)
         values (@id, @name, @type, @baseUrl, @apiKeyEnv, @enabled, @createdAt, @updatedAt)`
      )
      .run({
        id: "provider-persisted",
        name: "Persisted Provider",
        type: "openai-compatible",
        baseUrl: "https://api.example.com/v1",
        apiKeyEnv: "PERSISTED_PROVIDER_KEY",
        enabled: 1,
        createdAt: "2026-06-02T00:00:00.000Z",
        updatedAt: "2026-06-02T00:00:00.000Z"
      });
    database.close();

    const reopened = createDatabase(databasePath);
    databases.push(reopened);

    const provider = reopened
      .prepare("select id, name from providers where id = @id")
      .get<{ id: string; name: string }>({ id: "provider-persisted" });

    expect(provider).toEqual({ id: "provider-persisted", name: "Persisted Provider" });
  });

  it("stores provider API format for adapter selection", () => {
    const database = createTestDatabase();
    databases.push(database);

    database.prepare(`
      insert into providers (id, name, type, api_format, base_url, api_key_env, enabled, created_at, updated_at)
      values ('provider-responses', 'Responses', 'openai-compatible', 'openai-responses', 'https://example.test/v1', 'RESPONSES_KEY', 1, '2026-06-06T00:00:00.000Z', '2026-06-06T00:00:00.000Z')
    `).run();

    const row = database
      .prepare("select api_format from providers where id = ?")
      .get<{ api_format: string }>("provider-responses");

    expect(row).toEqual({ api_format: "openai-responses" });
  });

  it("allows framework workflow and llm.chat step records", () => {
    const database = createTestDatabase();
    databases.push(database);

    const timestamp = "2026-06-02T00:00:00.000Z";
    database.exec(`
      insert into providers (id, name, type, base_url, api_key_env, enabled, created_at, updated_at)
      values ('provider-1', 'Provider', 'openai-compatible', 'https://example.test/v1', 'CUSTOM_KEY', 1, '${timestamp}', '${timestamp}');

      insert into models (id, provider_id, display_name, model_id, capability, enabled, default_params_json, pricing_json, created_at, updated_at)
      values ('model-1', 'provider-1', 'Fast Chat', 'fast-chat', 'chat', 1, '{}', '{}', '${timestamp}', '${timestamp}');

      insert into sessions (id, title, workflow_type, created_at, updated_at)
      values ('session-1', 'Workflow', 'api-workflow', '${timestamp}', '${timestamp}');

      insert into runs (id, session_id, workflow_type, status, started_at)
      values ('run-1', 'session-1', 'api-workflow', 'running', '${timestamp}');

      insert into run_steps (id, run_id, step_index, step_type, provider_id, model_id, status, input_preview, created_at, updated_at)
      values ('step-1', 'run-1', 0, 'llm.chat', 'provider-1', 'model-1', 'running', 'Hello', '${timestamp}', '${timestamp}');
    `);

    const step = database
      .prepare("select workflow_type, step_type from runs join run_steps on run_steps.run_id = runs.id")
      .get<{ workflow_type: string; step_type: string }>();

    expect(step).toEqual({ workflow_type: "api-workflow", step_type: "llm.chat" });
  });
});
