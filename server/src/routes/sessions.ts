import { Router } from "express";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { AppDatabase } from "../db/client.js";

interface SessionRow {
  id: string;
  title: string;
  workflow_type: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  model_id: string | null;
  run_id: string | null;
  created_at: string;
}

const createSessionSchema = z.object({
  title: z.string().min(1).default("New chat"),
  workflowType: z.enum(["api-workflow", "chat", "image-minimal", "model-test"]).default("api-workflow")
});

export function createSessionsRouter(db: AppDatabase) {
  const router = Router();

  router.get("/", (_req, res) => {
    const rows = db.prepare(`
      select
        sessions.id,
        sessions.title,
        sessions.workflow_type,
        sessions.created_at,
        sessions.updated_at,
        (select count(*) from messages where messages.session_id = sessions.id) as message_count
      from sessions
      order by sessions.updated_at desc
    `).all<SessionRow>();

    res.json(rows.map(mapSessionListItem));
  });

  router.get("/:id", (req, res) => {
    const sessionRow = db.prepare(`
      select
        sessions.id,
        sessions.title,
        sessions.workflow_type,
        sessions.created_at,
        sessions.updated_at,
        (select count(*) from messages where messages.session_id = sessions.id) as message_count
      from sessions
      where sessions.id = @id
    `).get<SessionRow>({ id: req.params.id });

    if (!sessionRow) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const messages = db.prepare(`
      select id, session_id, role, content, model_id, run_id, created_at
      from messages
      where session_id = @sessionId
      order by created_at asc
    `).all<MessageRow>({ sessionId: req.params.id });

    res.json({
      ...mapSessionListItem(sessionRow),
      messages: messages.map(mapMessage)
    });
  });

  router.post("/", (req, res) => {
    const input = createSessionSchema.parse(req.body);
    const now = new Date().toISOString();
    const id = nanoid();

    db.prepare(`
      insert into sessions (id, title, workflow_type, created_at, updated_at)
      values (@id, @title, @workflowType, @createdAt, @updatedAt)
    `).run({
      id,
      title: input.title,
      workflowType: input.workflowType,
      createdAt: now,
      updatedAt: now
    });

    res.status(201).json({
      id,
      title: input.title,
      workflowType: input.workflowType,
      createdAt: now,
      updatedAt: now,
      messageCount: 0
    });
  });

  router.delete("/:id", (req, res) => {
    const session = db.prepare("select id from sessions where id = @id").get<{ id: string }>({ id: req.params.id });

    if (!session) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    db.prepare("delete from run_steps where run_id in (select id from runs where session_id = @id)").run({ id: req.params.id });
    db.prepare("delete from runs where session_id = @id").run({ id: req.params.id });
    db.prepare("delete from messages where session_id = @id").run({ id: req.params.id });
    db.prepare("delete from sessions where id = @id").run({ id: req.params.id });

    res.status(204).send();
  });

  return router;
}

function mapSessionListItem(row: SessionRow) {
  return {
    id: row.id,
    title: row.title,
    workflowType: row.workflow_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count
  };
}

function mapMessage(row: MessageRow) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    modelId: row.model_id,
    runId: row.run_id,
    createdAt: row.created_at
  };
}
