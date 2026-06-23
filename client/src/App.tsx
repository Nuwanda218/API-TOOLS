import { useState } from "react";
import { apiClient } from "./api/client";
import { NotificationProvider } from "./components/notifications/NotificationProvider";
import { TopNav, type LanguageKey, type PageKey } from "./components/TopNav";
import { EndpointsPage } from "./pages/EndpointsPage";
import { ModelsPage } from "./pages/ModelsPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { RunsPage } from "./pages/RunsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsagePage } from "./pages/UsagePage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import { WorkflowTemplatesPage } from "./pages/WorkflowTemplatesPage";
import "./styles.css";

interface ModuleView {
  title: string;
  badge: string;
  metrics: Array<{ label: string; value: string; tone?: "good" | "idle" | "warn" }>;
  records: Array<{ name: string; primary: string; secondary: string; state: string }>;
}

interface LocalizedCopy {
  statusAria: string;
  metricsSuffix: string;
  recordsSuffix: string;
  operationSurface: string;
  rows: string;
  version: string;
  statusItems: Array<{ label: string; value: string; tone: "good" | "idle" }>;
  moduleViews: Record<PageKey, ModuleView>;
}

const localizedCopy: Record<LanguageKey, LocalizedCopy> = {
  "zh-CN": {
    statusAria: "运行状态",
    metricsSuffix: "指标",
    recordsSuffix: "记录",
    operationSurface: "操作面板",
    rows: "行",
    version: "V0.1",
    statusItems: [
      { label: "本地 API", value: "127.0.0.1:8787", tone: "good" },
      { label: "适配器注册表", value: "invoke()", tone: "good" },
      { label: "工作流引擎", value: "api-workflow", tone: "idle" }
    ],
    moduleViews: {
      workbench: {
        title: "工作台",
        badge: "api-workflow",
        metrics: [
          { label: "工作流", value: "llm.chat", tone: "good" },
          { label: "供应商", value: "2 active", tone: "good" },
          { label: "适配器", value: "2 formats", tone: "idle" },
          { label: "运行状态", value: "ready", tone: "good" }
        ],
        records: [
          { name: "DeepSeek", primary: "openai-chat-completions", secondary: "deepseek-v4-flash", state: "ready" },
          { name: "SharedChat", primary: "openai-responses", secondary: "codex-auto-review", state: "ready" },
          { name: "Generic API", primary: "ApiInvocation", secondary: "registry.invoke", state: "foundation" }
        ]
      },
      providers: {
        title: "API接入",
        badge: "providers",
        metrics: [
          { label: "供应商", value: "2", tone: "good" },
          { label: "密钥来源", value: ".env", tone: "idle" },
          { label: "协议格式", value: "2", tone: "good" },
          { label: "健康检查", value: "manual", tone: "idle" }
        ],
        records: [
          { name: "DeepSeek", primary: "https://api.deepseek.com/v1", secondary: "DEEPSEEK_API_KEY", state: "enabled" },
          { name: "SharedChat", primary: "https://new.sharedchat.cc/codex", secondary: "SHAREDCHAT_API_KEY", state: "enabled" }
        ]
      },
      models: {
        title: "模型管理",
        badge: "models",
        metrics: [
          { label: "本地模型", value: "2", tone: "good" },
          { label: "能力", value: "chat", tone: "idle" },
          { label: "导入方式", value: "remote", tone: "good" },
          { label: "价格", value: "empty", tone: "warn" }
        ],
        records: [
          { name: "deepseek-v4-flash", primary: "DeepSeek", secondary: "chat", state: "enabled" },
          { name: "codex-auto-review", primary: "SharedChat", secondary: "chat", state: "enabled" }
        ]
      },
      endpoints: {
        title: "Endpoint",
        badge: "http.request",
        metrics: [
          { label: "操作", value: "http.request", tone: "good" },
          { label: "测试", value: "enabled", tone: "good" },
          { label: "模板", value: "JSON", tone: "idle" },
          { label: "工作流", value: "disabled", tone: "warn" }
        ],
        records: [{ name: "Generic endpoint", primary: "provider + path", secondary: "query / headers / body", state: "ready" }]
      },
      usage: {
        title: "用量检测",
        badge: "usage",
        metrics: [
          { label: "请求数", value: "0", tone: "idle" },
          { label: "输入 Tokens", value: "0", tone: "idle" },
          { label: "输出 Tokens", value: "0", tone: "idle" },
          { label: "错误", value: "0", tone: "good" }
        ],
        records: [{ name: "汇总", primary: "requestCount", secondary: "tokens / cost / errors", state: "available" }]
      },
      runs: {
        title: "运行历史",
        badge: "runs",
        metrics: [
          { label: "状态", value: "trace", tone: "good" },
          { label: "步骤", value: "run_steps", tone: "idle" },
          { label: "错误码", value: "visible", tone: "good" },
          { label: "延迟", value: "latency", tone: "idle" }
        ],
        records: [{ name: "Run trace", primary: "GET /api/runs", secondary: "steps / previews / errors", state: "ready" }]
      },
      workflows: {
        title: "工作流模板",
        badge: "templates",
        metrics: [
          { label: "模板", value: "1", tone: "idle" },
          { label: "步骤类型", value: "llm.chat", tone: "good" },
          { label: "内部协议", value: "internal", tone: "good" },
          { label: "分支能力", value: "later", tone: "warn" }
        ],
        records: [{ name: "single-llm-chat", primary: "api-workflow", secondary: "main-response", state: "ready" }]
      },
      settings: {
        title: "设置",
        badge: "local",
        metrics: [
          { label: "后端", value: "8787", tone: "good" },
          { label: "前端", value: "5173", tone: "good" },
          { label: "数据库", value: "sql.js", tone: "idle" },
          { label: "模式", value: "local", tone: "idle" }
        ],
        records: [{ name: "运行时", primary: "127.0.0.1", secondary: "workspace .env", state: "active" }]
      }
    }
  },
  en: {
    statusAria: "Runtime status",
    metricsSuffix: "metrics",
    recordsSuffix: "records",
    operationSurface: "Operation Surface",
    rows: "rows",
    version: "V0.1",
    statusItems: [
      { label: "Local API", value: "127.0.0.1:8787", tone: "good" },
      { label: "Adapter Registry", value: "invoke()", tone: "good" },
      { label: "Workflow Engine", value: "api-workflow", tone: "idle" }
    ],
    moduleViews: {
      workbench: {
        title: "Workbench",
        badge: "api-workflow",
        metrics: [
          { label: "Workflow", value: "llm.chat", tone: "good" },
          { label: "Provider", value: "2 active", tone: "good" },
          { label: "Adapter", value: "2 formats", tone: "idle" },
          { label: "Run State", value: "ready", tone: "good" }
        ],
        records: [
          { name: "DeepSeek", primary: "openai-chat-completions", secondary: "deepseek-v4-flash", state: "ready" },
          { name: "SharedChat", primary: "openai-responses", secondary: "codex-auto-review", state: "ready" },
          { name: "Generic API", primary: "ApiInvocation", secondary: "registry.invoke", state: "foundation" }
        ]
      },
      providers: {
        title: "Providers",
        badge: "providers",
        metrics: [
          { label: "Providers", value: "2", tone: "good" },
          { label: "Key Source", value: ".env", tone: "idle" },
          { label: "Formats", value: "2", tone: "good" },
          { label: "Health", value: "manual", tone: "idle" }
        ],
        records: [
          { name: "DeepSeek", primary: "https://api.deepseek.com/v1", secondary: "DEEPSEEK_API_KEY", state: "enabled" },
          { name: "SharedChat", primary: "https://new.sharedchat.cc/codex", secondary: "SHAREDCHAT_API_KEY", state: "enabled" }
        ]
      },
      models: {
        title: "Models",
        badge: "models",
        metrics: [
          { label: "Local Models", value: "2", tone: "good" },
          { label: "Capability", value: "chat", tone: "idle" },
          { label: "Import", value: "remote", tone: "good" },
          { label: "Pricing", value: "empty", tone: "warn" }
        ],
        records: [
          { name: "deepseek-v4-flash", primary: "DeepSeek", secondary: "chat", state: "enabled" },
          { name: "codex-auto-review", primary: "SharedChat", secondary: "chat", state: "enabled" }
        ]
      },
      endpoints: {
        title: "Endpoints",
        badge: "http.request",
        metrics: [
          { label: "Operation", value: "http.request", tone: "good" },
          { label: "Testing", value: "enabled", tone: "good" },
          { label: "Templates", value: "JSON", tone: "idle" },
          { label: "Workflow", value: "disabled", tone: "warn" }
        ],
        records: [{ name: "Generic endpoint", primary: "provider + path", secondary: "query / headers / body", state: "ready" }]
      },
      usage: {
        title: "Usage",
        badge: "usage",
        metrics: [
          { label: "Requests", value: "0", tone: "idle" },
          { label: "Input Tokens", value: "0", tone: "idle" },
          { label: "Output Tokens", value: "0", tone: "idle" },
          { label: "Errors", value: "0", tone: "good" }
        ],
        records: [{ name: "Summary", primary: "requestCount", secondary: "tokens / cost / errors", state: "available" }]
      },
      runs: {
        title: "Run History",
        badge: "runs",
        metrics: [
          { label: "State", value: "trace", tone: "good" },
          { label: "Steps", value: "run_steps", tone: "idle" },
          { label: "Errors", value: "visible", tone: "good" },
          { label: "Latency", value: "latency", tone: "idle" }
        ],
        records: [{ name: "Run trace", primary: "GET /api/runs", secondary: "steps / previews / errors", state: "ready" }]
      },
      workflows: {
        title: "Workflows",
        badge: "templates",
        metrics: [
          { label: "Templates", value: "1", tone: "idle" },
          { label: "Step Type", value: "llm.chat", tone: "good" },
          { label: "Protocol", value: "internal", tone: "good" },
          { label: "Branching", value: "later", tone: "warn" }
        ],
        records: [{ name: "single-llm-chat", primary: "api-workflow", secondary: "main-response", state: "ready" }]
      },
      settings: {
        title: "Settings",
        badge: "local",
        metrics: [
          { label: "Backend", value: "8787", tone: "good" },
          { label: "Frontend", value: "5173", tone: "good" },
          { label: "Database", value: "sql.js", tone: "idle" },
          { label: "Mode", value: "local", tone: "idle" }
        ],
        records: [{ name: "Runtime", primary: "127.0.0.1", secondary: "workspace .env", state: "active" }]
      }
    }
  }
};

function StatusStrip({ copy }: { copy: LocalizedCopy }) {
  return (
    <section className="status-strip" aria-label={copy.statusAria}>
      {copy.statusItems.map((item) => (
        <div className={`status-pill ${item.tone}`} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}

function ModulePage({ language, page }: { language: LanguageKey; page: PageKey }) {
  const copy = localizedCopy[language];
  const view = copy.moduleViews[page];

  return (
    <main className="workspace">
      <div className="workspace-header">
        <div>
          <span className="workspace-eyebrow">API operations console</span>
          <span className="module-badge">{view.badge}</span>
          <h1>{view.title}</h1>
        </div>
        <div className="header-mark">{copy.version}</div>
      </div>

      <StatusStrip copy={copy} />

      <section className="metric-grid" aria-label={`${view.title} ${copy.metricsSuffix}`}>
        {view.metrics.map((metric) => (
          <div className="metric-tile" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <i className={metric.tone ?? "idle"} />
          </div>
        ))}
      </section>

      <section className="operation-panel" aria-label={`${view.title} ${copy.recordsSuffix}`}>
        <div className="panel-heading">
          <h2>{copy.operationSurface}</h2>
          <span>
            {view.records.length} {copy.rows}
          </span>
        </div>
        <div className="record-list">
          {view.records.map((record) => (
            <div className="record-row" key={`${record.name}-${record.primary}`}>
              <strong>{record.name}</strong>
              <span>{record.primary}</span>
              <span>{record.secondary}</span>
              <em>{record.state}</em>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageKey>("workbench");
  const [language, setLanguage] = useState<LanguageKey>("zh-CN");
  const content =
    currentPage === "workbench" ? (
      <WorkbenchPage api={apiClient} language={language} />
    ) : currentPage === "providers" ? (
      <ProvidersPage api={apiClient} language={language} />
    ) : currentPage === "models" ? (
      <ModelsPage api={apiClient} language={language} />
    ) : currentPage === "endpoints" ? (
      <EndpointsPage api={apiClient} language={language} />
    ) : currentPage === "usage" ? (
      <UsagePage api={apiClient} language={language} />
    ) : currentPage === "runs" ? (
      <RunsPage api={apiClient} language={language} />
    ) : currentPage === "workflows" ? (
      <WorkflowTemplatesPage language={language} />
    ) : currentPage === "settings" ? (
      <SettingsPage language={language} />
    ) : (
      <ModulePage language={language} page={currentPage} />
    );

  return (
    <NotificationProvider>
      <div className={`app-shell console-shell ${collapsed ? "nav-collapsed" : ""}`} data-testid="app-shell">
        <TopNav
          collapsed={collapsed}
          currentPage={currentPage}
          language={language}
          onCollapsedChange={setCollapsed}
          onLanguageChange={setLanguage}
          onPageChange={setCurrentPage}
        />
        <div className="content-shell">
          <div className="console-topline">
            <span className="workspace-eyebrow">API operations console</span>
          </div>
          {content}
        </div>
      </div>
    </NotificationProvider>
  );
}
