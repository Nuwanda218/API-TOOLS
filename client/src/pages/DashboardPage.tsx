import { useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import type {
  EndpointRecord,
  ModelRecord,
  ProviderRecord,
  RunRecord,
  UsageSummary
} from "../api/types";
import { formatErrorTitle } from "../api/errors";
import type { LanguageKey } from "../components/TopNav";

interface DashboardPageProps {
  api: Pick<
    ApiClient,
    "listProviders" | "listModels" | "listEndpoints" | "listRuns" | "getUsageSummary"
  >;
  language?: LanguageKey;
}

const copy = {
  "zh-CN": {
    title: "概览",
    providers: "已接入 API",
    models: "本地模型",
    endpoints: "Endpoint",
    runs: "运行记录",
    requests: "总请求",
    tokens: "Tokens",
    cost: "估算成本",
    errors: "错误",
    backend: "后端",
    adapters: "适配器",
    statusOnline: "在线",
    statusOffline: "离线",
    noProviders: "还没有接入任何 API。前往「API接入」添加 Provider 开始使用。",
    noModels: "还没有模型。添加 Provider 后，前往「模型管理」导入模型。",
    noEndpoints: "还没有 Endpoint。前往「Endpoint」配置通用 HTTP API 端点。",
    noRuns: "还没有运行记录。去工作台发送一条消息，或测试一个模型。",
    emptyUsage: "运行一次工作流或测试后，这里会显示用量统计。",
    adapterList: "适配器格式",
    healthCheck: "健康检查"
  },
  en: {
    title: "Overview",
    providers: "Providers",
    models: "Models",
    endpoints: "Endpoints",
    runs: "Runs",
    requests: "Requests",
    tokens: "Tokens",
    cost: "Cost",
    errors: "Errors",
    backend: "Backend",
    adapters: "Adapters",
    statusOnline: "Online",
    statusOffline: "Offline",
    noProviders: "No providers connected yet. Go to Providers to add one.",
    noModels: "No models yet. Add a provider, then import models in Models.",
    noEndpoints: "No endpoints yet. Go to Endpoints to configure a generic HTTP API.",
    noRuns: "No runs yet. Send a message in Workbench or test a model.",
    emptyUsage: "Usage stats appear after running a workflow or testing a model.",
    adapterList: "Adapter formats",
    healthCheck: "Health check"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

export function DashboardPage({ api, language = "zh-CN" }: DashboardPageProps) {
  const t = copy[language];
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointRecord[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      api.listProviders(),
      api.listModels(),
      api.listEndpoints(),
      api.listRuns(),
      api.getUsageSummary()
    ])
      .then(([p, m, e, r, u]) => {
        if (!active) return;
        setProviders(p);
        setModels(m);
        setEndpoints(e);
        setRuns(r);
        setUsage(u);
      })
      .catch((err) => {
        if (!active) return;
        setError(formatErrorTitle(err, "Failed to load dashboard data"));
      });
  }, [api]);

  const adapterFormats = [...new Set(providers.map((p) => p.apiFormat))];

  return (
    <main className="page dashboard-page">
      <section className="page-heading">
        <span className="module-badge">overview</span>
        <h1>{t.title}</h1>
        <p>查看 API 接入、模型、Endpoint 和运行记录的汇总状态。</p>
      </section>

      {error && <p className="panel-status error">{error}</p>}

      {/* Stats cards */}
      <section className="dashboard-stats" aria-label={t.title}>
        <StatCard
          label={t.providers}
          value={String(providers.length)}
          href="#/providers"
          emptyText={t.noProviders}
        />
        <StatCard
          label={t.models}
          value={String(models.length)}
          href="#/models"
          emptyText={t.noModels}
        />
        <StatCard
          label={t.endpoints}
          value={String(endpoints.length)}
          href="#/endpoints"
          emptyText={t.noEndpoints}
        />
        <StatCard
          label={t.runs}
          value={String(runs.length)}
          href="#/runs"
          emptyText={t.noRuns}
        />
      </section>

      {/* System status */}
      <section className="dashboard-panel" aria-label={t.backend}>
        <div className="panel-heading">
          <h2>{t.backend}</h2>
        </div>
        <div className="dashboard-status-list">
          <StatusRow
            label={t.backend}
            value="127.0.0.1:8787"
            tone="good"
          />
          <StatusRow
            label={t.adapters}
            value={adapterFormats.length > 0 ? adapterFormats.join(", ") : "—"}
            tone={adapterFormats.length > 0 ? "good" : "idle"}
          />
          <StatusRow
            label={t.requests}
            value={String(usage?.requestCount ?? 0)}
            tone={usage && usage.requestCount > 0 ? "good" : "idle"}
          />
          <StatusRow
            label={t.tokens}
            value={`${usage?.inputTokens ?? 0} / ${usage?.outputTokens ?? 0}`}
            tone="idle"
          />
          <StatusRow
            label={t.cost}
            value={usage ? `$${usage.estimatedCost.toFixed(6)}` : "—"}
            tone="idle"
          />
          <StatusRow
            label={t.errors}
            value={String(usage?.errorCount ?? 0)}
            tone={usage && usage.errorCount > 0 ? "warn" : "good"}
          />
        </div>
      </section>

      {/* Recent runs */}
      {runs.length > 0 && (
        <section className="dashboard-panel" aria-label="最近运行">
          <div className="panel-heading">
            <h2>最近运行</h2>
            <a className="panel-link" href="#/runs">
              查看全部
            </a>
          </div>
          <div className="record-list">
            {runs.slice(0, 5).map((run) => (
              <div className="record-row run-row" key={run.id}>
                <strong>{run.sessionTitle}</strong>
                <span>{run.workflowType}</span>
                <span>
                  {run.totalInputTokens ?? 0}/{run.totalOutputTokens ?? 0} tokens
                </span>
                <em>{run.status}</em>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  href,
  emptyText
}: {
  label: string;
  value: string;
  href: string;
  emptyText: string;
}) {
  const num = parseInt(value, 10);
  return (
    <a className={`stat-card ${num === 0 ? "stat-card-empty" : ""}`} href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      {num === 0 && <p className="stat-card-empty-text">{emptyText}</p>}
    </a>
  );
}

function StatusRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "good" | "idle" | "warn";
}) {
  return (
    <div className={`status-row ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
