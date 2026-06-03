import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppDatabase } from "./db/client.js";
import { createDatabase } from "./db/client.js";
import { createProviderRepository } from "./providers/providerRepository.js";
import { createShutdownHandler } from "./index.js";
import "./test/testDb.js";

let tempDirectory: string | undefined;

afterEach(async () => {
  if (tempDirectory) {
    await rm(tempDirectory, { recursive: true, force: true });
    tempDirectory = undefined;
  }
});

describe("server lifecycle", () => {
  it("closes the HTTP server and database once during shutdown", async () => {
    const closeDatabase = vi.fn();
    const server = {
      close: vi.fn((callback?: (error?: Error) => void) => {
        callback?.();
        return server;
      })
    };
    const shutdown = createShutdownHandler({
      server,
      db: {
        close: closeDatabase
      } as unknown as AppDatabase
    });

    await shutdown("SIGINT");
    await shutdown("SIGTERM");

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(closeDatabase).toHaveBeenCalledTimes(1);
  });

  it("persists file-backed sql.js database data when closed", async () => {
    tempDirectory = await mkdtemp(join(tmpdir(), "api-tools-db-"));
    const databasePath = join(tempDirectory, "api-tools.db");

    const firstDb = createDatabase(databasePath);
    createProviderRepository(firstDb).create({
      id: "provider-persisted",
      name: "Persisted",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_OPENAI_COMPATIBLE_KEY",
      enabled: true
    });
    firstDb.close();

    const secondDb = createDatabase(databasePath);

    expect(createProviderRepository(secondDb).getById("provider-persisted")).toMatchObject({
      id: "provider-persisted",
      name: "Persisted"
    });

    secondDb.close();
  });
});
