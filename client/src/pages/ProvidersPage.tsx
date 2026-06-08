import { type FormEvent, useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import type { ProviderApiFormat, ProviderRecord } from "../api/types";
import type { LanguageKey } from "../components/TopNav";

interface ProvidersPageProps {
  api: Pick<ApiClient, "listProviders" | "createProvider">;
  language?: LanguageKey;
}

const copy = {
  "zh-CN": {
    title: "API接入",
    subtitle: "创建供应商连接，密钥只通过本地环境变量读取。",
    formTitle: "新增 Provider",
    name: "名称",
    type: "类型",
    apiFormat: "API 协议格式",
    baseUrl: "Base URL",
    apiKeyEnv: "API Key 环境变量",
    submit: "添加 Provider",
    listTitle: "已接入 API",
    empty: "还没有 Provider。",
    enabled: "enabled",
    loading: "加载中",
    error: "加载失败"
  },
  en: {
    title: "Providers",
    subtitle: "Create provider connections. API keys are read from local environment variables only.",
    formTitle: "New Provider",
    name: "Name",
    type: "Type",
    apiFormat: "API format",
    baseUrl: "Base URL",
    apiKeyEnv: "API key env var",
    submit: "Add Provider",
    listTitle: "Connected APIs",
    empty: "No providers yet.",
    enabled: "enabled",
    loading: "Loading",
    error: "Load failed"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

export function ProvidersPage({ api, language = "zh-CN" }: ProvidersPageProps) {
  const text = copy[language];
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<ProviderRecord["type"]>("openai-compatible");
  const [apiFormat, setApiFormat] = useState<ProviderApiFormat>("openai-chat-completions");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyEnv, setApiKeyEnv] = useState("");
  const [status, setStatus] = useState(text.loading);

  useEffect(() => {
    let active = true;

    api
      .listProviders()
      .then((rows) => {
        if (!active) return;
        setProviders(rows);
        setStatus("");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus(error instanceof Error ? error.message : text.error);
      });

    return () => {
      active = false;
    };
  }, [api, text.error, text.loading]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const created = await api.createProvider({
      name,
      type,
      apiFormat,
      baseUrl,
      apiKeyEnv,
      enabled: true
    });

    setProviders((current) => [...current, created]);
    setName("");
    setBaseUrl("");
    setApiKeyEnv("");
  }

  return (
    <main className="page two-column">
      <section className="page-section">
        <div className="page-heading">
          <span className="module-badge">providers</span>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>

        <form className="card-form" onSubmit={handleSubmit}>
          <h2>{text.formTitle}</h2>
          <label>
            {text.name}
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            {text.type}
            <select value={type} onChange={(event) => setType(event.target.value as ProviderRecord["type"])}>
              <option value="openai-compatible">openai-compatible</option>
              <option value="openai-official">openai-official</option>
            </select>
          </label>
          <label>
            {text.apiFormat}
            <select value={apiFormat} onChange={(event) => setApiFormat(event.target.value as ProviderApiFormat)}>
              <option value="openai-chat-completions">openai-chat-completions</option>
              <option value="openai-responses">openai-responses</option>
            </select>
          </label>
          <label>
            {text.baseUrl}
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} required />
          </label>
          <label>
            {text.apiKeyEnv}
            <input value={apiKeyEnv} onChange={(event) => setApiKeyEnv(event.target.value)} required />
          </label>
          <button type="submit">{text.submit}</button>
        </form>
      </section>

      <section className="operation-panel management-panel" aria-label={text.listTitle}>
        <div className="panel-heading">
          <h2>{text.listTitle}</h2>
          <span>{providers.length}</span>
        </div>
        {status && <p className="panel-status">{status}</p>}
        {!status && providers.length === 0 && <p className="panel-status">{text.empty}</p>}
        <div className="record-list">
          {providers.map((provider) => (
            <div className="record-row provider-row" key={provider.id}>
              <strong>{provider.name}</strong>
              <span>{provider.apiFormat}</span>
              <span>{provider.baseUrl}</span>
              <em>{provider.enabled ? text.enabled : "disabled"}</em>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
