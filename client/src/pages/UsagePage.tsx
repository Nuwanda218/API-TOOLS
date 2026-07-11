import { useEffect, useMemo, useState } from "react";
import type { ApiClient } from "../api/client";
import { formatErrorTitle } from "../api/errors";
import type {
  ModelRecord,
  ProviderRecord,
  UsageDashboard,
  UsageGroupRow,
  UsageRange,
  UsageSummary,
  UsageTrendPoint
} from "../api/types";
import type { LanguageKey } from "../components/TopNav";

interface UsagePageProps {
  api: Pick<ApiClient, "getUsageDashboard" | "listProviders" | "listModels">;
  language?: LanguageKey;
}

type TabKey = "provider" | "model";

const RANGE_OPTIONS: Array<{ key: UsageRange; label: Record<LanguageKey, string> }> = [
  { key: "today", label: { "zh-CN": "今日", en: "Today" } },
  { key: "7d", label: { "zh-CN": "7天", en: "7d" } },
  { key: "30d", label: { "zh-CN": "30天", en: "30d" } },
  { key: "all", label: { "zh-CN": "全部", en: "All" } }
];

const copy = {
  "zh-CN": {
    title: "用量检测",
    subtitle: "按时间范围、Provider、Model 筛选，查看请求成本与趋势。",
    requestCount: "请求数",
    inputTokens: "输入 Tokens",
    outputTokens: "输出 Tokens",
    estimatedCost: "预估成本",
    errorCount: "错误",
    errorRate: "错误率",
    avgLatency: "平均延迟",
    loading: "加载中",
    empty: "运行一次工作流或测试模型后，这里会显示用量数据。",
    trend: "按天趋势",
    trendEmpty: "暂无趋势数据",
    groupByProvider: "按 Provider",
    groupByModel: "按 Model",
    recentSteps: "最近记录",
    stepsEmpty: "暂无记录",
    allProviders: "全部 Provider",
    allModels: "全部 Model",
    name: "名称",
    tokens: "Tokens",
    cost: "成本",
    latency: "延迟",
    type: "类型",
    status: "状态",
    time: "时间",
    all: "全部"
  },
  en: {
    title: "Usage",
    subtitle: "Filter by time range, provider, and model to see costs and usage trends.",
    requestCount: "Requests",
    inputTokens: "Input Tokens",
    outputTokens: "Output Tokens",
    estimatedCost: "Estimated Cost",
    errorCount: "Errors",
    errorRate: "Error Rate",
    avgLatency: "Avg Latency",
    loading: "Loading",
    empty: "Run a workflow or test a model to see usage data here.",
    trend: "Daily Trend",
    trendEmpty: "No trend data yet",
    groupByProvider: "By Provider",
    groupByModel: "By Model",
    recentSteps: "Recent Records",
    stepsEmpty: "No records yet",
    allProviders: "All Providers",
    allModels: "All Models",
    name: "Name",
    tokens: "Tokens",
    cost: "Cost",
    latency: "Latency",
    type: "Type",
    status: "Status",
    time: "Time",
    all: "All"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

const emptySummary: UsageSummary = {
  requestCount: 0,
  inputTokens: 0,
  outputTokens: 0,
  estimatedCost: 0,
  errorCount: 0,
  averageLatencyMs: null
};

export function UsagePage({ api, language = "zh-CN" }: UsagePageProps) {
  const t = copy[language];
  const [dashboard, setDashboard] = useState<UsageDashboard | null>(null);
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [range, setRange] = useState<UsageRange>("7d");
  const [providerId, setProviderId] = useState("");
  const [modelId, setModelId] = useState("");
  const [tab, setTab] = useState<TabKey>("provider");
  const [status, setStatus] = useState(t.loading);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.listProviders(), api.listModels()])
      .then(([p, m]) => { if (active) { setProviders(p); setModels(m); } })
      .catch(() => { /* dropdowns are optional */ });
    return () => { active = false; };
  }, [api]);

  useEffect(() => {
    let active = true;
    setStale(true);
    api.getUsageDashboard(range, providerId || undefined, modelId || undefined)
      .then((d) => { if (active) { setDashboard(d); setStatus(""); setStale(false); } })
      .catch((err) => { if (active) { setStatus(formatErrorTitle(err, t.loading)); setStale(false); } });
    return () => { active = false; };
  }, [api, range, providerId, modelId, t.loading]);

  const summary = dashboard?.summary ?? emptySummary;
  const trend = dashboard?.trend ?? [];
  const groups = tab === "provider" ? (dashboard?.byProvider ?? []) : (dashboard?.byModel ?? []);
  const steps = dashboard?.recentSteps ?? [];

  const filteredModels = useMemo(() => {
    if (!providerId) return models;
    return models.filter((m) => m.providerId === providerId);
  }, [models, providerId]);

  return (
    <main className={`page usage-dashboard-page ${stale ? "usage-stale" : ""}`}>
      <div className="page-heading">
        <span className="module-badge">usage</span>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </div>

      {/* Filter bar */}
      <div className="usage-filter-bar">
        <div className="usage-range-tabs">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={range === opt.key ? "active" : ""}
              type="button"
              onClick={() => setRange(opt.key)}
            >{opt.label[language]}</button>
          ))}
        </div>
        <select value={providerId} onChange={(e) => { setProviderId(e.target.value); setModelId(""); }}>
          <option value="">{t.allProviders}</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
          <option value="">{t.allModels}</option>
          {filteredModels.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
        </select>
      </div>

      {status && <p className="panel-status">{status}</p>}

      {/* KPI summary */}
      <section className="dashboard-stats" aria-label="Usage summary">
        <KpiCard label={t.requestCount} value={summary.requestCount} />
        <KpiCard label={t.inputTokens} value={summary.inputTokens} />
        <KpiCard label={t.outputTokens} value={summary.outputTokens} />
        <KpiCard label={t.estimatedCost} value={`$${summary.estimatedCost.toFixed(4)}`} />
        <KpiCard label={t.errorCount} value={summary.errorCount} tone={summary.errorCount > 0 ? "warn" : "good"} />
        <KpiCard
          label={t.avgLatency}
          value={summary.averageLatencyMs != null ? `${summary.averageLatencyMs}ms` : "—"}
        />
      </section>

      {summary.requestCount === 0 && !status && <p className="panel-status">{t.empty}</p>}

      {/* Trend bar chart */}
      <section className="operation-panel management-panel" aria-label={t.trend}>
        <div className="panel-heading"><h2>{t.trend}</h2></div>
        {trend.length === 0 ? (
          <p className="panel-status">{t.trendEmpty}</p>
        ) : (
          <TrendBars trend={trend} />
        )}
      </section>

      {/* Grouped stats tabs */}
      <section className="operation-panel management-panel" aria-label="Grouped stats">
        <div className="usage-stats-tabs">
          <button
            className={tab === "provider" ? "active" : ""}
            type="button"
            onClick={() => setTab("provider")}
          >{t.groupByProvider}</button>
          <button
            className={tab === "model" ? "active" : ""}
            type="button"
            onClick={() => setTab("model")}
          >{t.groupByModel}</button>
        </div>
        {groups.length === 0 ? (
          <p className="panel-status">{t.empty}</p>
        ) : (
          <GroupTable groups={groups} t={t} />
        )}
      </section>

      {/* Recent steps */}
      <section className="operation-panel management-panel" aria-label={t.recentSteps}>
        <div className="panel-heading"><h2>{t.recentSteps}</h2><span>{steps.length}</span></div>
        {steps.length === 0 ? (
          <p className="panel-status">{t.stepsEmpty}</p>
        ) : (
          <div className="record-list">
            {steps.map((step) => (
              <div className="record-row usage-row" key={step.id}>
                <strong>{step.stepType}</strong>
                <span>{step.providerName ?? "—"}</span>
                <span>{step.modelName ?? "—"}</span>
                <span>{step.inputTokens ?? 0}/{step.outputTokens ?? 0}</span>
                <span>{step.latencyMs != null ? `${step.latencyMs}ms` : "—"}</span>
                <span>${(step.costEstimate ?? 0).toFixed(6)}</span>
                <em className={`run-status-badge ${step.status}`}>{step.status}</em>
                {step.errorCode && <code>{step.errorCode}</code>}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  const num = typeof value === "number" ? value : parseInt(String(value), 10);
  return (
    <div className={`stat-card ${num === 0 ? "stat-card-empty" : ""} ${tone === "warn" ? "stat-card-warn" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrendBars({ trend }: { trend: UsageTrendPoint[] }) {
  const maxCost = Math.max(...trend.map((t) => t.estimatedCost), 0.0001);
  return (
    <div className="usage-trend-bars">
      {trend.map((point) => (
        <div
          className="usage-bar-item"
          key={point.date}
          title={`${point.date}: ${point.requestCount} req, ${point.inputTokens + point.outputTokens} tokens, $${point.estimatedCost.toFixed(4)}`}
        >
          <div
            className="usage-bar"
            style={{ height: `${Math.max((point.estimatedCost / maxCost) * 100, 2)}%` }}
          />
          <span className="usage-bar-date">{point.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function GroupTable({ groups, t }: { groups: UsageGroupRow[]; t: Record<string, string> }) {
  return (
    <table className="usage-table">
      <thead>
        <tr>
          <th>{t.name}</th>
          <th>{t.requestCount}</th>
          <th>{t.tokens}</th>
          <th>{t.cost}</th>
          <th>{t.errorCount}</th>
          <th>{t.latency}</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <tr key={g.id ?? "__null__"}>
            <td>{g.name}</td>
            <td>{g.requestCount}</td>
            <td>{g.totalTokens}</td>
            <td>${g.estimatedCost.toFixed(4)}</td>
            <td className={g.errorCount > 0 ? "usage-error-cell" : ""}>{g.errorCount}</td>
            <td>{g.averageLatencyMs != null ? `${g.averageLatencyMs}ms` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
