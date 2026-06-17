import type { LanguageKey } from "../components/TopNav";

interface SettingsPageProps {
  language?: LanguageKey;
}

const settingsRows = [
  {
    label: { "zh-CN": "后端地址", en: "Backend URL" },
    value: "http://127.0.0.1:8787",
    description: { "zh-CN": "本地 Express API 服务。", en: "Local Express API service." }
  },
  {
    label: { "zh-CN": "密钥来源", en: "Key source" },
    value: ".env",
    description: { "zh-CN": "前端只保存环境变量名，不显示完整 API key。", en: "Frontend stores env var names only, never full API keys." }
  },
  {
    label: { "zh-CN": "内部协议", en: "Internal protocol" },
    value: "api-workflow",
    description: { "zh-CN": "工作台通过统一 workflow payload 调用后端。", en: "Workbench calls the backend through a unified workflow payload." }
  },
  {
    label: { "zh-CN": "扩展入口", en: "Extension point" },
    value: "adapter registry",
    description: { "zh-CN": "后续按 API 文档添加专用协议转接器。", en: "Future API-document-specific protocol adapters attach here." }
  }
];

const copy = {
  "zh-CN": {
    title: "设置",
    subtitle: "当前阶段展示本地运行配置和未来通用 API 扩展边界。",
    badge: "local",
    runtime: "运行时配置"
  },
  en: {
    title: "Settings",
    subtitle: "Current local runtime configuration and future generic API extension boundaries.",
    badge: "local",
    runtime: "Runtime settings"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

export function SettingsPage({ language = "zh-CN" }: SettingsPageProps) {
  const text = copy[language];

  return (
    <main className="page settings-page">
      <section className="page-heading">
        <span className="module-badge">{text.badge}</span>
        <h1>{text.title}</h1>
        <p>{text.subtitle}</p>
      </section>

      <section className="operation-panel management-panel" aria-label={text.runtime}>
        <div className="panel-heading">
          <h2>{text.runtime}</h2>
          <span>V0.1</span>
        </div>
        <div className="settings-list">
          {settingsRows.map((row) => (
            <article className="settings-card" key={row.value}>
              <div>
                <strong>{row.label[language]}</strong>
                <code>{row.value}</code>
              </div>
              <p>{row.description[language]}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
