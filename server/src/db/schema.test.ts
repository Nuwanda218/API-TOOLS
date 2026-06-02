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
});
