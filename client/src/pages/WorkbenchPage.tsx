import { type FormEvent, useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import { formatErrorNotification, formatErrorTitle } from "../api/errors";
import type { ModelRecord, RunRecord, SessionListItem, SessionMessage } from "../api/types";
import { useNotifications } from "../components/notifications/NotificationProvider";
import type { LanguageKey } from "../components/TopNav";

interface WorkbenchPageProps {
  api: Pick<ApiClient, "listModels" | "listSessions" | "getSession" | "createSession" | "deleteSession" | "runWorkflow" | "getRun">;
  language?: LanguageKey;
}

const copy = {
  "zh-CN": {
    title: "工作台",
    subtitle: "选择模型，发送消息，查看运行详情。",
    model: "模型",
    message: "消息",
    messagePlaceholder: "输入要发送给模型的内容",
    send: "发送",
    sessions: "会话",
    newSession: "+ 新建会话",
    deleteSession: "删除",
    runDetail: "运行详情",
    noDetail: "发送消息后，这里会显示运行详情。",
    empty: "还没有可用的 chat 模型。请先在模型管理中导入模型。",
    running: "发送中…",
    failed: "失败",
    runSucceeded: "发送成功",
    stepType: "类型",
    latency: "延迟",
    tokens: "Tokens",
    cost: "成本",
    status: "状态",
    total: "合计",
    error: "错误",
    noMessages: "发送一条消息开始对话。",
    defaultTitle: "新对话"
  },
  en: {
    title: "Workbench",
    subtitle: "Select a model, send messages, and inspect run details.",
    model: "Model",
    message: "Message",
    messagePlaceholder: "Enter content to send to the model",
    send: "Send",
    sessions: "Sessions",
    newSession: "+ New session",
    deleteSession: "Delete",
    runDetail: "Run Detail",
    noDetail: "Send a message to see run details here.",
    empty: "No chat-capable models yet. Import a model in Models first.",
    running: "Sending…",
    failed: "Failed",
    runSucceeded: "Message sent successfully",
    stepType: "Type",
    latency: "Latency",
    tokens: "Tokens",
    cost: "Cost",
    status: "Status",
    total: "Total",
    error: "Error",
    noMessages: "Send a message to start a conversation.",
    defaultTitle: "New chat"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

function readOutputContent(outputs: Record<string, Record<string, unknown>>) {
  const output = outputs["main-response"];
  const content = output?.content;
  if (typeof content === "string") return content;
  if (content == null) return "";
  return JSON.stringify(content);
}

export function WorkbenchPage({ api, language = "zh-CN" }: WorkbenchPageProps) {
  const text = copy[language];
  const notify = useNotifications();

  const [models, setModels] = useState<ModelRecord[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [runDetail, setRunDetail] = useState<RunRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([api.listModels(), api.listSessions()])
      .then(([modelRows, sessionRows]) => {
        if (!active) return;
        const chatModels = modelRows.filter(
          (m) => m.enabled && (m.capability === "chat" || m.capability === "multimodal")
        );
        setModels(chatModels);
        setSelectedModelId((cur) => cur || chatModels[0]?.id || "");
        setSessions(sessionRows);
        if (sessionRows.length > 0) {
          loadSession(sessionRows[0].id);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(formatErrorTitle(err, text.failed));
      });

    return () => { active = false; };
  }, [api]);

  async function loadSession(sessionId: string) {
    setActiveSessionId(sessionId);
    setRunDetail(null);
    try {
      const detail = await api.getSession(sessionId);
      setMessages(detail.messages);
    } catch (err) {
      setMessages([]);
      setError(formatErrorTitle(err, text.failed));
    }
  }

  async function handleNewSession() {
    try {
      const created = await api.createSession({ title: text.defaultTitle, workflowType: "api-workflow" });
      setSessions((cur) => [created, ...cur]);
      setActiveSessionId(created.id);
      setMessages([]);
      setRunDetail(null);
    } catch (err) {
      notify.error(formatErrorNotification(err, text.failed));
    }
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      await api.deleteSession(sessionId);
      setSessions((cur) => cur.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([]);
        setRunDetail(null);
      }
    } catch (err) {
      notify.error(formatErrorNotification(err, text.failed));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const userMessage = message.trim();
    if (!selectedModelId || !userMessage) return;

    let sessionId = activeSessionId;
    if (!sessionId) {
      try {
        const created = await api.createSession({
          title: userMessage.slice(0, 60) || text.defaultTitle,
          workflowType: "api-workflow"
        });
        sessionId = created.id;
        setSessions((cur) => [created, ...cur]);
        setActiveSessionId(sessionId);
      } catch (err) {
        notify.error(formatErrorNotification(err, text.failed));
        return;
      }
    }

    setMessages((cur) => [...cur, {
      id: `temp-${Date.now()}`,
      role: "user" as const,
      content: userMessage,
      modelId: null,
      runId: null,
      createdAt: new Date().toISOString()
    }]);
    setMessage("");
    setSending(true);
    setError("");

    try {
      const result = await api.runWorkflow({
        sessionId,
        workflowType: "api-workflow",
        input: { message: userMessage },
        steps: [{
          id: "main-response",
          type: "llm.chat",
          modelId: selectedModelId,
          input: { message: "{{input.message}}" }
        }]
      });

      const content = readOutputContent(result.outputs);
      if (content) {
        setMessages((cur) => [...cur, {
          id: `resp-${Date.now()}`,
          role: "assistant" as const,
          content,
          modelId: selectedModelId,
          runId: result.run.id,
          createdAt: new Date().toISOString()
        }]);
      }

      setSessions((cur) =>
        cur.map((s) => s.id === sessionId ? { ...s, messageCount: s.messageCount + 2, updatedAt: new Date().toISOString() } : s)
      );

      try {
        const run = await api.getRun(result.run.id);
        setRunDetail(run);
      } catch { /* run detail is optional */ }

      notify.success({ title: text.runSucceeded });
    } catch (runError) {
      setError(formatErrorTitle(runError, text.failed));
      notify.error(formatErrorNotification(runError, text.failed));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="page workbench-page" data-testid="workbench-page">
      {/* Left: Session list */}
      <aside className="session-list" aria-label={text.sessions}>
        <div className="panel-heading">
          <h2>{text.sessions}</h2>
          <span>{sessions.length}</span>
        </div>
        <button className="session-new-btn" type="button" onClick={handleNewSession}>{text.newSession}</button>
        <div className="session-items">
          {sessions.map((session) => (
            <div
              className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
              key={session.id}
            >
              <button className="session-select" type="button" onClick={() => loadSession(session.id)}>
                <strong>{session.title}</strong>
                <small>{session.messageCount} msgs</small>
              </button>
              <button
                className="session-delete"
                type="button"
                aria-label={text.deleteSession}
                onClick={() => handleDeleteSession(session.id)}
              >×</button>
            </div>
          ))}
        </div>
      </aside>

      {/* Center: Chat area */}
      <section className="workbench-chat">
        <div className="page-heading">
          <span className="module-badge">api-workflow</span>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>

        {models.length === 0 && !error && <p className="panel-status">{text.empty}</p>}
        {error && <p className="panel-status error">{error}</p>}

        <div className="chat-transcript">
          {messages.length === 0 && !error && models.length > 0 && (
            <p className="panel-status">{text.noMessages}</p>
          )}
          {messages.map((item) => (
            <article className={`chat-message ${item.role}`} key={item.id}>
              <span>{item.role}</span>
              <p>{item.content}</p>
            </article>
          ))}
        </div>

        <form className="chat-input-bar" onSubmit={handleSubmit}>
          <select value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
          </select>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={text.messagePlaceholder}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button type="submit" disabled={!selectedModelId || !message.trim() || sending}>
            {sending ? text.running : text.send}
          </button>
        </form>
      </section>

      {/* Right: Run detail panel */}
      <aside className="run-detail-panel" aria-label={text.runDetail}>
        <div className="panel-heading">
          <h2>{text.runDetail}</h2>
        </div>
        {!runDetail && <p className="panel-status">{text.noDetail}</p>}
        {runDetail && <RunDetailView run={runDetail} text={text} />}
      </aside>
    </main>
  );
}

function RunDetailView({ run, text }: { run: RunRecord; text: Record<string, string> }) {
  return (
    <div className="run-detail-content">
      <div className="run-detail-summary">
        <div className="run-detail-row">
          <span>{text.status}</span>
          <em className={`run-status-badge ${run.status}`}>{run.status}</em>
        </div>
        <div className="run-detail-row">
          <span>{text.tokens}</span>
          <strong>{run.totalInputTokens ?? 0} / {run.totalOutputTokens ?? 0}</strong>
        </div>
        <div className="run-detail-row">
          <span>{text.cost}</span>
          <strong>${(run.totalCostEstimate ?? 0).toFixed(6)}</strong>
        </div>
      </div>

      {run.steps.map((step) => (
        <article className="trace-step" key={step.id}>
          <header>
            <strong>{step.stepType}</strong>
            <em className={`run-status-badge ${step.status}`}>{step.status}</em>
          </header>
          <dl className="trace-details">
            <div>
              <dt>{text.latency}</dt>
              <dd>{step.latencyMs ?? "—"} ms</dd>
            </div>
            <div>
              <dt>{text.tokens}</dt>
              <dd>{step.inputTokens ?? 0} / {step.outputTokens ?? 0}</dd>
            </div>
            <div>
              <dt>{text.cost}</dt>
              <dd>${(step.costEstimate ?? 0).toFixed(6)}</dd>
            </div>
          </dl>
          {step.errorCode && (
            <div className="trace-error">
              <code>{step.errorCode}</code>
              {step.errorMessage && <p>{step.errorMessage}</p>}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
