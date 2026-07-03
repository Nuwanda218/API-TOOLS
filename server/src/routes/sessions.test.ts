import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("session routes", () => {
  it("creates and lists sessions", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const createResponse = await request(app).post("/api/sessions").send({
      title: "Test chat",
      workflowType: "api-workflow"
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual(
      expect.objectContaining({
        title: "Test chat",
        workflowType: "api-workflow",
        messageCount: 0
      })
    );

    const listResponse = await request(app).get("/api/sessions");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].id).toBe(createResponse.body.id);

    db.close();
  });

  it("returns session detail with messages", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });
    const now = "2026-06-23T08:00:00.000Z";

    db.prepare(`
      insert into sessions (id, title, workflow_type, created_at, updated_at)
      values ('session-1', 'Chat session', 'api-workflow', @now, @now)
    `).run({ now });
    db.prepare(`
      insert into messages (id, session_id, role, content, created_at)
      values ('msg-1', 'session-1', 'user', 'Hello', @now)
    `).run({ now });
    db.prepare(`
      insert into messages (id, session_id, role, content, model_id, run_id, created_at)
      values ('msg-2', 'session-1', 'assistant', 'Hi there', null, null, @now)
    `).run({ now });

    const response = await request(app).get("/api/sessions/session-1");

    expect(response.status).toBe(200);
    expect(response.body.title).toBe("Chat session");
    expect(response.body.messageCount).toBe(2);
    expect(response.body.messages).toHaveLength(2);
    expect(response.body.messages[0]).toEqual(
      expect.objectContaining({
        id: "msg-1",
        role: "user",
        content: "Hello"
      })
    );
    expect(response.body.messages[1]).toEqual(
      expect.objectContaining({
        id: "msg-2",
        role: "assistant",
        content: "Hi there"
      })
    );

    db.close();
  });

  it("deletes session and cascades", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });
    const now = "2026-06-23T08:00:00.000Z";

    db.prepare(`
      insert into sessions (id, title, workflow_type, created_at, updated_at)
      values ('session-del', 'To delete', 'api-workflow', @now, @now)
    `).run({ now });
    db.prepare(`
      insert into messages (id, session_id, role, content, created_at)
      values ('msg-del', 'session-del', 'user', 'test', @now)
    `).run({ now });
    db.prepare(`
      insert into runs (id, session_id, workflow_type, status, started_at)
      values ('run-del', 'session-del', 'api-workflow', 'succeeded', @now)
    `).run({ now });

    const deleteResponse = await request(app).delete("/api/sessions/session-del");
    expect(deleteResponse.status).toBe(204);

    const getResponse = await request(app).get("/api/sessions/session-del");
    expect(getResponse.status).toBe(404);

    db.close();
  });

  it("returns 404 for missing session", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const response = await request(app).get("/api/sessions/nonexistent");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });

    db.close();
  });
});
