import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ApiClient } from "../api/client";
import { formatErrorNotification, formatErrorTitle } from "../api/errors";
import type { ModelRecord, SkillParameterRecord, SkillTemplateRecord } from "../api/types";
import { useNotifications } from "../components/notifications/NotificationProvider";
import type { LanguageKey } from "../components/TopNav";

interface WorkflowTemplatesPageProps {
  api: Pick<ApiClient, "listSkills" | "listModels" | "runSkill">;
  language?: LanguageKey;
}

const copy = {
  "zh-CN": {
    title: "工作流模板",
    subtitle: "从后端 Skill 模板系统加载可复用工作流，填写参数后直接运行。",
    badge: "skills",
    templates: "模板",
    parameters: "运行参数",
    output: "运行输出",
    loading: "正在加载模板",
    empty: "还没有可用模板",
    noSelection: "请选择一个模板",
    builtin: "内置",
    custom: "自定义",
    modelFallback: "选择模型",
    run: "运行",
    running: "正在运行模板",
    succeeded: "模板运行成功",
    failed: "模板运行失败",
    steps: "步骤",
    modelsLoading: "正在加载模型",
    noModels: "还没有可选模型"
  },
  en: {
    title: "Workflow Templates",
    subtitle: "Load reusable workflows from the backend Skill template system and run them with parameters.",
    badge: "skills",
    templates: "Templates",
    parameters: "Run Parameters",
    output: "Output",
    loading: "Loading templates",
    empty: "No templates available",
    noSelection: "Select a template",
    builtin: "Builtin",
    custom: "Custom",
    modelFallback: "Select model",
    run: "Run",
    running: "Running template",
    succeeded: "Template run succeeded",
    failed: "Template run failed",
    steps: "steps",
    modelsLoading: "Loading models",
    noModels: "No models available"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

export function WorkflowTemplatesPage({ api, language = "zh-CN" }: WorkflowTemplatesPageProps) {
  const text = copy[language];
  const notify = useNotifications();
  const [templates, setTemplates] = useState<SkillTemplateRecord[]>([]);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [status, setStatus] = useState(text.loading);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");

  useEffect(() => {
    let active = true;
    setStatus(text.loading);

    Promise.all([api.listSkills(), api.listModels()])
      .then(([skillItems, modelItems]) => {
        if (!active) return;
        setTemplates(skillItems);
        setModels(modelItems);
        setSelectedId((current) => current ?? skillItems[0]?.id ?? null);
        setStatus(skillItems.length ? "" : text.empty);
      })
      .catch((error) => {
        if (!active) return;
        setStatus(formatErrorTitle(error, text.failed));
        notify.error(formatErrorNotification(error, text.failed));
      });

    return () => {
      active = false;
    };
  }, [api, notify, text.empty, text.failed, text.loading]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates]
  );

  useEffect(() => {
    if (!selectedTemplate) return;

    setOutput("");
    setParameters((current) => {
      const next: Record<string, string> = {};
      for (const parameter of selectedTemplate.parameters) {
        if (parameter.type === "model") {
          next[parameter.key] = current[parameter.key] ?? models[0]?.id ?? "";
          continue;
        }
        next[parameter.key] = current[parameter.key] ?? "";
      }
      return next;
    });
  }, [models, selectedTemplate]);

  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTemplate) return;

    setRunning(true);
    setStatus(text.running);
    notify.info({ title: text.running, detail: selectedTemplate.name[language] });

    try {
      const result = await api.runSkill(selectedTemplate.id, parameters);
      const renderedOutput = formatWorkflowOutput(result.outputs);
      setOutput(renderedOutput);
      setStatus(text.succeeded);
      notify.success({ title: text.succeeded, detail: selectedTemplate.name[language] });
    } catch (error) {
      setStatus(formatErrorTitle(error, text.failed));
      notify.error(formatErrorNotification(error, text.failed));
    } finally {
      setRunning(false);
    }
  }

  function updateParameter(key: string, value: string) {
    setParameters((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="page template-page">
      <section className="page-heading">
        <span className="module-badge">{text.badge}</span>
        <h1>{text.title}</h1>
        <p>{text.subtitle}</p>
      </section>

      <section className="two-column">
        <div className="page-section">
          <div className="panel-heading">
            <div>
              <span className="module-badge">{text.templates}</span>
              <h2>{text.templates}</h2>
            </div>
            {status && <span className="status-pill">{status}</span>}
          </div>

          <div className="operation-panel resource-list">
            {templates.length === 0 && <p className="muted">{text.empty}</p>}
            {templates.map((template) => (
              <article className={`resource-card ${selectedId === template.id ? "selected" : ""}`} key={template.id}>
                <button className="resource-card-main" type="button" onClick={() => setSelectedId(template.id)}>
                  <strong>{template.name[language]}</strong>
                  <span>{template.description[language]}</span>
                  <code>{template.builtin ? text.builtin : text.custom}</code>
                </button>
                <span className="status-pill">
                  {template.steps.length} {text.steps}
                </span>
              </article>
            ))}
          </div>
        </div>

        <div className="page-section">
          <form className="card-form" onSubmit={handleRun}>
            <h2>{selectedTemplate ? selectedTemplate.name[language] : text.parameters}</h2>
            {!selectedTemplate && <p className="muted">{text.noSelection}</p>}
            {selectedTemplate?.parameters.map((parameter) => (
              <ParameterField
                key={parameter.key}
                language={language}
                models={models}
                onChange={updateParameter}
                parameter={parameter}
                text={text}
                value={parameters[parameter.key] ?? ""}
              />
            ))}
            <button disabled={!selectedTemplate || running} type="submit">
              {running
                ? text.running
                : selectedTemplate
                  ? `${text.run} ${selectedTemplate.name[language]}`
                  : text.run}
            </button>
          </form>

          <section className="operation-panel tool-panel" aria-label={text.output}>
            <div className="panel-heading">
              <div>
                <span className="module-badge">output</span>
                <h2>{text.output}</h2>
              </div>
            </div>
            {output ? <pre>{output}</pre> : <p className="muted">{text.output}</p>}
          </section>
        </div>
      </section>
    </main>
  );
}

function ParameterField(input: {
  parameter: SkillParameterRecord;
  value: string;
  models: ModelRecord[];
  language: LanguageKey;
  text: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const { parameter, value, models, language, text, onChange } = input;
  const label = parameter.label[language];

  if (parameter.type === "model") {
    return (
      <label>
        {label}
        <select
          required={parameter.required}
          value={value}
          onChange={(event) => onChange(parameter.key, event.target.value)}
        >
          <option value="">{models.length ? text.modelFallback : text.noModels}</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (parameter.type === "text") {
    return (
      <label>
        {label}
        <textarea
          required={parameter.required}
          rows={4}
          value={value}
          onChange={(event) => onChange(parameter.key, event.target.value)}
        />
      </label>
    );
  }

  return (
    <label>
      {label}
      <input
        required={parameter.required}
        value={value}
        onChange={(event) => onChange(parameter.key, event.target.value)}
      />
    </label>
  );
}

function formatWorkflowOutput(outputs: Record<string, Record<string, unknown>>): string {
  const firstOutput = Object.values(outputs)[0];
  const content = firstOutput?.content;
  if (typeof content === "string") return content;

  return JSON.stringify(outputs, null, 2);
}
