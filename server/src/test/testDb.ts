import { beforeAll } from "vitest";
import { createDatabase, initializeSqlRuntime } from "../db/client.js";

beforeAll(async () => {
  await initializeSqlRuntime();
});

export function createTestDatabase() {
  return createDatabase(":memory:");
}
