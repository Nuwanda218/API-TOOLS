import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("api key routes", () => {
  const originalValue = process.env.DEEPSEEK_API_KEY;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = originalValue;
    }
  });

  it("writes a key to .env and updates process.env", async () => {
    const db = createTestDatabase();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "api-tools-env-"));
    const envPath = path.join(tmpDir, ".env");
    const app = createApp({ db, envPath });

    const response = await request(app).post("/api/api-keys").send({
      apiKeyEnv: "DEEPSEEK_API_KEY",
      apiKey: "sk-test"
    });

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(fs.readFileSync(envPath, "utf8")).toBe("DEEPSEEK_API_KEY=sk-test\n");
    expect(process.env.DEEPSEEK_API_KEY).toBe("sk-test");

    db.close();
  });

  it("rejects invalid env var names", async () => {
    const db = createTestDatabase();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "api-tools-env-"));
    const app = createApp({ db, envPath: path.join(tmpDir, ".env") });

    const response = await request(app).post("/api/api-keys").send({
      apiKeyEnv: "sk-real-key",
      apiKey: "sk-test"
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("invalid_request");

    db.close();
  });
});
