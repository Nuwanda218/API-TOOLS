import { type FormEvent, useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import { formatErrorNotification, formatErrorTitle } from "../api/errors";
import type { ProviderApiFormat, ProviderRecord } from "../api/types";
import { useNotifications } from "../components/notifications/NotificationProvider";
import type { LanguageKey } from "../components/TopNav";

interface ProvidersPageProps {
  api: Pick<ApiClient, "listProviders" | "createProvider" | "saveApiKey" | "deleteProvider">;
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
    apiKey: "API Key（可选，会写入本地 .env）",
    submit: "添加 Provider",
    listTitle: "已接入 API",
    empty: "还没有 Provider。在上方表单中添加第一个 Provider 开始使用。",
    enabled: "enabled",
    loading: "加载中",
    error: "加载失败",
    creating: "正在创建供应商...",
    created: "供应商已创建",
    delete: "删除",
    deleting: "正在删除供应商...",
    deleted: "供应商已删除",
    apiKeyEnvHelp: "填写 .env 里的变量名，例如 DEEPSEEK_API_KEY，不要填真实 key。",
    apiKeyHelp: "如果填写，会由本地后端写入 .env；不会保存到数据库。",
    savingApiKey: "正在写入 API Key...",
    apiKeySaved: "API Key 已写入本地 .env",
    invalidApiKeyEnv: "API Key 环境变量填变量名，例如 DEEPSEEK_API_KEY，不要填真实 key。",
    disabled: "disabled",
    apiKeyEnvDetail: "Key 变量",
    capabilities: "能力",
    chat: "聊天",
    modelListing: "模型列表",
    modelListingOff: "模型列表关闭",
    manualImport: "手动导入",
    streaming: "流式",
    toolCalling: "工具调用",
    vision: "视觉",
    remoteConversation: "远端会话"
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
    apiKey: "API key (optional, writes to local .env)",
    submit: "Add Provider",
    listTitle: "Connected APIs",
    empty: "No providers yet. Add your first provider using the form above.",
    enabled: "enabled",
    loading: "Loading",
    error: "Load failed",
    creating: "Creating provider...",
    created: "Provider created",
    delete: "Delete",
    deleting: "Deleting provider...",
    deleted: "Provider deleted",
    apiKeyEnvHelp: "Use the variable name from .env, for example DEEPSEEK_API_KEY. Do not enter the real key.",
    apiKeyHelp: "If filled, the local backend writes it to .env. It is not saved to the database.",
    savingApiKey: "Saving API key...",
    apiKeySaved: "API key saved to local .env",
    invalidApiKeyEnv: "API key env var must be a variable name such as DEEPSEEK_API_KEY, not the real key.",
    disabled: "disabled",
    apiKeyEnvDetail: "Key env",
    capabilities: "Capabilities",
    chat: "chat",
    modelListing: "model listing",
    modelListingOff: "model listing off",
    manualImport: "manual import",
    streaming: "streaming",
    toolCalling: "tool calling",
    vision: "vision",
    remoteConversation: "remote conversation"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

const apiKeyEnvPattern = /^[A-Z][A-Z0-9_]*$/;

function looksLikeRawApiKey(value: string) {
  return /^(sk|tk)-/i.test(value) || /[A-Z0-9]{32,}/.test(value);
}

function isValidApiKeyEnv(value: string) {
  return apiKeyEnvPattern.test(value) && !looksLikeRawApiKey(value);
}

function getCapabilityLabels(provider: ProviderRecord, text: Record<string, string>) {
  const { capabilities } = provider;
  const labels: string[] = [];

  if (capabilities.supportsChat) labels.push(text.chat);
  labels.push(capabilities.supportsModelListing ? text.modelListing : text.modelListingOff);
  if (capabilities.requiresManualModelImport || capabilities.supportsManualModelImport) labels.push(text.manualImport);
  if (capabilities.supportsStreaming) labels.push(text.streaming);
  if (capabilities.supportsToolCalling) labels.push(text.toolCalling);
  if (capabilities.supportsVision) labels.push(text.vision);
  if (capabilities.supportsRemoteConversation) labels.push(text.remoteConversation);

  return labels;
}

export function ProvidersPage({ api, language = "zh-CN" }: ProvidersPageProps) {
  const text = copy[language];
  const notify = useNotifications();
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<ProviderRecord["type"]>("openai-compatible");
  const [apiFormat, setApiFormat] = useState<ProviderApiFormat>("openai-chat-completions");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyEnv, setApiKeyEnv] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState(text.loading);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState("");

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
        setStatus(formatErrorTitle(error, text.error));
      });

    return () => {
      active = false;
    };
  }, [api, text.error, text.loading]);

  async function refreshProviders() {
    const rows = await api.listProviders();
    setProviders(rows);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!isValidApiKeyEnv(apiKeyEnv)) {
      setStatus(text.invalidApiKeyEnv);
      notify.warning({ title: text.invalidApiKeyEnv });
      return;
    }

    setCreating(true);
    setStatus(text.creating);
    notify.info({ title: text.creating });

    try {
      if (apiKey.trim()) {
        setStatus(text.savingApiKey);
        notify.info({ title: text.savingApiKey, detail: apiKeyEnv });
        await api.saveApiKey({ apiKeyEnv, apiKey: apiKey.trim() });
        const savedMessage = `${text.apiKeySaved}：${apiKeyEnv}`;
        setStatus(savedMessage);
        notify.success({ title: savedMessage });
      }

      const created = await api.createProvider({
        name,
        type,
        apiFormat,
        baseUrl,
        apiKeyEnv,
        enabled: true
      });

      await refreshProviders();
      const successMessage = `${text.created}：${created.name}`;
      setStatus(successMessage);
      notify.success({ title: successMessage });
      setName("");
      setBaseUrl("");
      setApiKeyEnv("");
      setApiKey("");
    } catch (error) {
      setStatus(formatErrorTitle(error, text.error));
      notify.error(formatErrorNotification(error, text.error));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(provider: ProviderRecord) {
    setDeletingId(provider.id);
    setStatus(text.deleting);
    notify.info({ title: text.deleting, detail: provider.name });

    try {
      await api.deleteProvider(provider.id);
      await refreshProviders();
      const successMessage = `${text.deleted}：${provider.name}`;
      setStatus(successMessage);
      notify.success({ title: successMessage });
    } catch (error) {
      setStatus(formatErrorTitle(error, text.error));
      notify.error(formatErrorNotification(error, text.error));
    } finally {
      setDeletingId("");
    }
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
              <option value="claude-messages">claude-messages</option>
            </select>
          </label>
          <label>
            {text.baseUrl}
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} required />
          </label>
          <label>
            {text.apiKeyEnv}
            <input
              aria-label={text.apiKeyEnv}
              value={apiKeyEnv}
              onChange={(event) => setApiKeyEnv(event.target.value)}
              required
            />
            <small>{text.apiKeyEnvHelp}</small>
          </label>
          <label>
            {text.apiKey}
            <input
              aria-label={text.apiKey}
              autoComplete="off"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <small>{text.apiKeyHelp}</small>
          </label>
          <button type="submit" disabled={creating}>
            {creating ? text.creating : text.submit}
          </button>
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
              <div className="record-primary">
                <strong>{provider.name}</strong>
                <span>{provider.type}</span>
              </div>
              <div className="provider-details">
                <span>{provider.apiFormat}</span>
                <span>{provider.baseUrl}</span>
                <span>
                  {text.apiKeyEnvDetail}: <code>{provider.apiKeyEnv}</code>
                </span>
              </div>
              <div className="capability-tags" aria-label={`${provider.name} ${text.capabilities}`}>
                {getCapabilityLabels(provider, text).map((label) => (
                  <span className="capability-tag" key={label}>
                    {label}
                  </span>
                ))}
              </div>
              <em>{provider.enabled ? text.enabled : text.disabled}</em>
              <button
                aria-label={`${text.delete} ${provider.name}`}
                className="inline-action danger-action"
                disabled={deletingId === provider.id}
                type="button"
                onClick={() => handleDelete(provider)}
              >
                {deletingId === provider.id ? text.deleting : text.delete}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
