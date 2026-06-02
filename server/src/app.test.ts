import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createTestDatabase } from "./test/testDb.js";

describe("app", () => {
  it("returns health status", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: "api-tools" });

    db.close();
  });
});
