import type { LanguageKey } from "../components/TopNav";

interface WorkflowTemplatesPageProps {
  language?: LanguageKey;
}

const templates = [
  {
    title: { "zh-CN": "单步 LLM Chat", en: "Single-step LLM Chat" },
    tag: "llm.chat step",
    description: {
      "zh-CN": "使用当前内部 api-workflow 协议调用一个模型，并把 main-response 作为输出。",
      en: "Calls one model through the internal api-workflow protocol and returns main-response."
    },
    status: { "zh-CN": "可运行", en: "Runnable" }
  },
  {
    title: { "zh-CN": "HTTP Request 占位", en: "HTTP Request placeholder" },
    tag: "http.request step",
    description: {
      "zh-CN": "为未来非大模型 API 预留的通用 HTTP 调用模板。",
      en: "Reserved generic HTTP invocation template for future non-LLM APIs."
    },
    status: { "zh-CN": "预留", en: "Planned" }
  },
  {
    title: { "zh-CN": "协议适配器占位", en: "Protocol adapter placeholder" },
    tag: "adapter.invoke",
    description: {
      "zh-CN": "为后续基于 API 文档新增专用 adapter 的入口。",
      en: "Entry point for future API-document-specific adapters."
    },
    status: { "zh-CN": "预留", en: "Planned" }
  }
];

const copy = {
  "zh-CN": {
    title: "工作流模板",
    subtitle: "查看当前内置工作流模板和后续通用 API 步骤扩展入口。",
    badge: "templates",
    builtIn: "内置模板"
  },
  en: {
    title: "Workflow Templates",
    subtitle: "Inspect built-in workflow templates and future generic API step extension points.",
    badge: "templates",
    builtIn: "Built-in templates"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

export function WorkflowTemplatesPage({ language = "zh-CN" }: WorkflowTemplatesPageProps) {
  const text = copy[language];

  return (
    <main className="page template-page">
      <section className="page-heading">
        <span className="module-badge">{text.badge}</span>
        <h1>{text.title}</h1>
        <p>{text.subtitle}</p>
      </section>

      <section className="operation-panel management-panel" aria-label={text.builtIn}>
        <div className="panel-heading">
          <h2>{text.builtIn}</h2>
          <span>{templates.length}</span>
        </div>
        <div className="workflow-grid">
          {templates.map((template) => (
            <article className="workflow-card" key={template.tag}>
              <div>
                <strong>{template.title[language]}</strong>
                <span>{template.tag}</span>
              </div>
              <p>{template.description[language]}</p>
              <em>{template.status[language]}</em>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
