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
    empty: "还没有运行记录。",
    error: "加载失败",
    view: "查看",
    tokens: "tokens",
    latency: "latency",
    cost: "cost"
  },
  en: {
    title: "Run History",
    subtitle: "Inspect model tests and workflow runs with per-step inputs, outputs, and errors.",
    listTitle: "Runs",
    detailTitle: "Trace",
    loading: "Loading",
    empty: "No runs yet.",
    error: "Load failed",
    view: "View",
    tokens: "tokens",
    latency: "latency",
    cost: "cost"
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
            <p>{step.inputPreview}</p>
            {step.outputPreview && <p>{step.outputPreview}</p>}
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
