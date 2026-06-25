import { type FormEvent, useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import { formatErrorNotification, formatErrorTitle } from "../api/errors";
import type { ModelRecord } from "../api/types";
import { useNotifications } from "../components/notifications/NotificationProvider";
import type { LanguageKey } from "../components/TopNav";

interface WorkbenchPageProps {
  api: Pick<ApiClient, "listModels" | "runWorkflow">;
  language?: LanguageKey;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const copy = {
  "zh-CN": {
    title: "工作台",
    subtitle: "选择一个本地模型，运行单步 llm.chat 工作流，并查看后端返回结果。",
    formTitle: "单步工作流",
    model: "模型",
    message: "消息",
    messagePlaceholder: "输入要发送给模型的内容",
    run: "运行工作流",
    transcript: "运行结果",
    status: "状态",
    empty: "还没有可用的 chat 模型。请先在模型管理中导入模型，然后回来发送消息。",
    idle: "idle",
    running: "running",
    failed: "failed",
    runSucceeded: "工作流运行成功"
  },
  en: {
    title: "Workbench",
    subtitle: "Select a local model, run a single-step llm.chat workflow, and inspect the backend result.",
    formTitle: "Single-step workflow",
    model: "Model",
    message: "Message",
    messagePlaceholder: "Enter content to send to the model",
    run: "Run workflow",
    transcript: "Run result",
    status: "Status",
    empty: "No chat-capable models yet. Import a model in Models, then come back to send a message.",
    idle: "idle",
    running: "running",
    failed: "failed",
    runSucceeded: "Workflow run succeeded"
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
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [runStatus, setRunStatus] = useState(text.idle);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    api
      .listModels()
      .then((rows) => {
        if (!active) return;
        const chatModels = rows.filter(
          (model) => model.enabled && (model.capability === "chat" || model.capability === "multimodal")
        );
        setModels(chatModels);
        setSelectedModelId((current) => current || chatModels[0]?.id || "");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(formatErrorTitle(loadError, text.failed));
      });

    return () => {
      active = false;
    };
  }, [api]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const userMessage = message.trim();
    if (!selectedModelId || !userMessage) return;

    setMessages((current) => [...current, { role: "user", content: userMessage }]);
    setMessage("");
    setRunStatus(text.running);
    setError("");
    notify.info({ title: text.running });

    try {
      const result = await api.runWorkflow({
        workflowType: "api-workflow",
        input: {
          message: userMessage
        },
        steps: [
          {
            id: "main-response",
            type: "llm.chat",
            modelId: selectedModelId,
            input: {
              message: "{{input.message}}"
            }
          }
        ]
      });

      const content = readOutputContent(result.outputs);
      setRunStatus(result.run.status);
      if (content) {
        setMessages((current) => [...current, { role: "assistant", content }]);
      }
      notify.success({ title: text.runSucceeded });
    } catch (runError) {
      setRunStatus(text.failed);
      setError(formatErrorTitle(runError, text.failed));
      notify.error(formatErrorNotification(runError, text.failed));
    }
  }

  return (
    <main className="page two-column workbench-page">
      <section className="page-section">
        <div className="page-heading">
          <span className="module-badge">api-workflow</span>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>

        <form className="card-form workflow-form" onSubmit={handleSubmit}>
          <h2>{text.formTitle}</h2>
          <label>
            {text.model}
            <select value={selectedModelId} onChange={(event) => setSelectedModelId(event.target.value)} required>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            {text.message}
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={text.messagePlaceholder}
              rows={6}
              required
            />
          </label>
          <button type="submit" disabled={!selectedModelId || !message.trim() || runStatus === text.running}>
            {text.run}
          </button>
        </form>
      </section>

      <section className="operation-panel management-panel" aria-label={text.transcript}>
        <div className="panel-heading">
          <h2>{text.transcript}</h2>
          <span>
            {text.status}: {runStatus}
          </span>
        </div>
        {models.length === 0 && !error && <p className="panel-status">{text.empty}</p>}
        {error && <p className="panel-status error">{error}</p>}
        <div className="chat-transcript">
          {messages.map((item, index) => (
            <article className={`chat-message ${item.role}`} key={`${item.role}-${index}`}>
              <span>{item.role}</span>
              <p>{item.content}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
