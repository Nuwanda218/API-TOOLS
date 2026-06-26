import { useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import { formatErrorNotification, formatErrorTitle } from "../api/errors";
import type { RunRecord } from "../api/types";
import { useNotifications } from "../components/notifications/NotificationProvider";
import type { LanguageKey } from "../components/TopNav";

interface RunsPageProps {
  api: Pick<ApiClient, "listRuns" | "getRun">;
  language?: LanguageKey;
}

const copy = {
  "zh-CN": {
    title: "运行历史",
    subtitle: "查看模型测试和工作流运行记录，定位每一步的输入、输出和错误。",
    listTitle: "Runs",
    detailTitle: "Trace",
    loading: "加载中",
    empty: "还没有运行记录。去工作台发送一条消息，或在模型管理中测试一个模型。",
    error: "加载失败",
    view: "查看",
    tokens: "tokens",
    latency: "latency",
    cost: "cost",
    input: "Input",
    llmContent: "LLM content",
    httpStatus: "HTTP status",
    bodyPreview: "Body preview",
    mcpTool: "MCP tool",
    contentBlocks: "Content blocks"
  },
  en: {
    title: "Run History",
    subtitle: "Inspect model tests and workflow runs with per-step inputs, outputs, and errors.",
    listTitle: "Runs",
    detailTitle: "Trace",
    loading: "Loading",
    empty: "No runs yet. Send a message in Workbench or test a model in Models.",
    error: "Load failed",
    view: "View",
    tokens: "tokens",
    latency: "latency",
    cost: "cost",
    input: "Input",
    llmContent: "LLM content",
    httpStatus: "HTTP status",
    bodyPreview: "Body preview",
    mcpTool: "MCP tool",
    contentBlocks: "Content blocks"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

export function RunsPage({ api, language = "zh-CN" }: RunsPageProps) {
  const text = copy[language];
  const notify = useNotifications();
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [status, setStatus] = useState(text.loading);

  useEffect(() => {
    let active = true;

    api
      .listRuns()
      .then((rows) => {
        if (!active) return;
        setRuns(rows);
        setSelectedRun(rows[0] ?? null);
        setStatus("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus(formatErrorTitle(error, text.error));
        notify.error(formatErrorNotification(error, text.error));
      });

    return () => {
      active = false;
    };
  }, [api, notify, text.error]);

  async function handleSelect(runId: string) {
    try {
      const run = await api.getRun(runId);
      setSelectedRun(run);
    } catch (error) {
      setStatus(formatErrorTitle(error, text.error));
      notify.error(formatErrorNotification(error, text.error));
    }
  }

  return (
    <main className="page two-column">
      <section className="page-section">
        <div className="page-heading">
          <span className="module-badge">runs</span>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>

        <section className="operation-panel management-panel" aria-label={text.listTitle}>
          <div className="panel-heading">
            <h2>{text.listTitle}</h2>
            <span>{runs.length}</span>
          </div>
          {status && <p className="panel-status">{status}</p>}
          {!status && runs.length === 0 && <p className="panel-status">{text.empty}</p>}
          <div className="record-list">
            {runs.map((run) => (
              <div className="record-row run-row" key={run.id}>
                <strong>{run.sessionTitle}</strong>
                <span>{run.workflowType}</span>
                <span>{formatRunMetric(run, text)}</span>
                <em>{run.status}</em>
                <button className="inline-action" type="button" onClick={() => handleSelect(run.id)}>
                  {text.view} {run.id}
                </button>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="operation-panel management-panel" aria-label={text.detailTitle}>
        <div className="panel-heading">
          <h2>{text.detailTitle}</h2>
          <span>{selectedRun?.id ?? "-"}</span>
        </div>
        {selectedRun?.steps.map((step) => (
          <article className="trace-step" key={step.id}>
            <header>
              <strong>{step.stepType}</strong>
              <em>{step.status}</em>
            </header>
            <dl className="trace-details">
              <div>
                <dt>{text.input}</dt>
                <dd>{step.inputPreview}</dd>
              </div>
              {renderStepOutput(step, text)}
            </dl>
            {step.errorCode && <code>{step.errorCode}</code>}
            {step.errorMessage && <p>{step.errorMessage}</p>}
            <small>
              {text.latency}: {step.latencyMs ?? "-"}ms · {text.tokens}: {step.inputTokens ?? 0}/{step.outputTokens ?? 0}
            </small>
          </article>
        ))}
      </section>
    </main>
  );
}

function formatRunMetric(run: RunRecord, text: Record<string, string>) {
  const inputTokens = run.totalInputTokens ?? 0;
  const outputTokens = run.totalOutputTokens ?? 0;
  const cost = run.totalCostEstimate ?? 0;
  return `${text.tokens} ${inputTokens}/${outputTokens} · ${text.cost} ${cost}`;
}

function renderStepOutput(step: RunRecord["steps"][number], text: Record<string, string>) {
  if (step.stepType === "endpoint.call") {
    const parsed = parseEndpointPreview(step.outputPreview);

    return (
      <>
        <div>
          <dt>{text.httpStatus}</dt>
          <dd>{parsed?.statusCode ?? "-"}</dd>
        </div>
        <div>
          <dt>{text.bodyPreview}</dt>
          <dd>{formatPreview(parsed?.bodyPreview ?? step.outputPreview)}</dd>
        </div>
      </>
    );
  }

  if (step.stepType === "mcp.call") {
    return (
      <>
        <div>
          <dt>{text.mcpTool}</dt>
          <dd>{step.mcpToolName ?? "-"}</dd>
        </div>
        <div>
          <dt>{text.contentBlocks}</dt>
          <dd>{formatMcpContentBlocks(step.outputPreview)}</dd>
        </div>
      </>
    );
  }

  return (
    <div>
      <dt>{text.llmContent}</dt>
      <dd>{step.outputPreview ?? "-"}</dd>
    </div>
  );
}

function parseEndpointPreview(value: string | null): { statusCode?: number; bodyPreview?: unknown } | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as { statusCode?: number; bodyPreview?: unknown };
  } catch {
    return null;
  }
}

function formatMcpContentBlocks(value: string | null): string {
  if (!value) return "-";

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return value;

    return parsed
      .map((block) => {
        if (!block || typeof block !== "object") return "";
        const text = "text" in block ? block.text : undefined;
        return typeof text === "string" ? text : JSON.stringify(block);
      })
      .filter(Boolean)
      .join("\n");
  } catch {
    return value;
  }
}

function formatPreview(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
