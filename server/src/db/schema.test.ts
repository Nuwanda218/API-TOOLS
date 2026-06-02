import { afterEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "../test/testDb.js";

const databases: ReturnType<typeof createTestDatabase>[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close();
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
});
