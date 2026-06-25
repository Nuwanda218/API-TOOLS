import { type FormEvent, useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import { formatErrorNotification, formatErrorTitle } from "../api/errors";
import type { EndpointMethod, EndpointRecord, ProviderRecord } from "../api/types";
import { useNotifications } from "../components/notifications/NotificationProvider";
import type { LanguageKey } from "../components/TopNav";

interface EndpointsPageProps {
  api: Pick<
    ApiClient,
    "listProviders" | "listEndpoints" | "createEndpoint" | "deleteEndpoint" | "testEndpoint"
  >;
  language?: LanguageKey;
}

const copy = {
  "zh-CN": {
    title: "Endpoint 管理",
    subtitle: "配置通用 HTTP API endpoint，并用本地 provider 密钥执行测试请求。",
    formTitle: "新增 Endpoint",
    provider: "Provider",
    name: "名称",
    method: "Method",
    path: "Path",
    queryJson: "Query JSON",
    headersJson: "Headers JSON",
    bodyJson: "Body JSON",
    enabled: "启用",
    submit: "添加 Endpoint",
    listTitle: "Endpoints",
    testInput: "测试输入 JSON",
    test: "测试",
    empty: "还没有 Endpoint。在上方表单中配置一个通用 HTTP API 端点并测试。",
    loading: "加载中",
    created: "Endpoint 已创建",
    deleted: "Endpoint 已删除",
    delete: "删除",
    invalidJson: "JSON 格式无效",
    tested: "测试完成"
  },
  en: {
    title: "Endpoints",
    subtitle: "Configure generic HTTP API endpoints and test them with local provider credentials.",
    formTitle: "New Endpoint",
    provider: "Provider",
    name: "Name",
    method: "Method",
    path: "Path",
    queryJson: "Query JSON",
    headersJson: "Headers JSON",
    bodyJson: "Body JSON",
    enabled: "Enabled",
    submit: "Add Endpoint",
    listTitle: "Endpoints",
    testInput: "Test input JSON",
    test: "Test",
    empty: "No endpoints yet. Configure a generic HTTP API endpoint using the form above.",
    loading: "Loading",
    created: "Endpoint created",
    deleted: "Endpoint deleted",
    delete: "Delete",
    invalidJson: "Invalid JSON",
    tested: "Test complete"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

export function EndpointsPage({ api, language = "zh-CN" }: EndpointsPageProps) {
  const text = copy[language];
  const notify = useNotifications();
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointRecord[]>([]);
  const [providerId, setProviderId] = useState("");
  const [name, setName] = useState("");
  const [method, setMethod] = useState<EndpointMethod>("GET");
  const [path, setPath] = useState("");
  const [queryJson, setQueryJson] = useState("{}");
  const [headersJson, setHeadersJson] = useState("{}");
  const [bodyJson, setBodyJson] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [testInputJson, setTestInputJson] = useState("{}");
  const [status, setStatus] = useState(text.loading);
  const [testResult, setTestResult] = useState("");
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([api.listProviders(), api.listEndpoints()])
      .then(([providerRows, endpointRows]) => {
        if (!active) return;
        setProviders(providerRows);
        setEndpoints(endpointRows);
        setProviderId((current) => current || providerRows[0]?.id || "");
        setStatus("");
      })
      .catch((error) => {
        if (!active) return;
        setStatus(formatErrorTitle(error, text.loading));
        notify.error(formatErrorNotification(error, text.loading));
      });

    return () => {
      active = false;
    };
  }, [api, notify, text.loading]);

  async function refreshEndpoints() {
    setEndpoints(await api.listEndpoints());
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setTestResult("");

    try {
      const queryTemplate = parseJsonObject(queryJson, text.invalidJson);
      const headersTemplate = parseJsonObject(headersJson, text.invalidJson);
      const bodyTemplate = bodyJson.trim() ? JSON.parse(bodyJson) : undefined;
      const created = await api.createEndpoint({
        providerId,
        name,
        operationId: "http.request",
        method,
        path,
        queryTemplate,
        headersTemplate,
        bodyTemplate,
        enabled
      });

      await refreshEndpoints();
      const message = `${text.created}：${created.name}`;
      setStatus(message);
      notify.success({ title: message });
      setName("");
      setPath("");
      setQueryJson("{}");
      setHeadersJson("{}");
      setBodyJson("");
    } catch (error) {
      setStatus(formatErrorTitle(error, text.invalidJson));
      notify.error(formatErrorNotification(error, text.invalidJson));
    } finally {
      setCreating(false);
    }
  }

  async function handleTest(endpoint: EndpointRecord) {
    setTestingId(endpoint.id);
    setTestResult("");

    try {
      const input = parseJsonObject(testInputJson, text.invalidJson);
      const result = await api.testEndpoint(endpoint.id, input);
      const message = `HTTP ${result.status} (${result.latencyMs}ms)`;
      setTestResult(message);
      notify.success({ title: `${text.tested}：${endpoint.name}`, detail: message });
    } catch (error) {
      setTestResult(formatErrorTitle(error, text.test));
      notify.error(formatErrorNotification(error, text.test));
    } finally {
      setTestingId("");
    }
  }

  async function handleDelete(endpoint: EndpointRecord) {
    setDeletingId(endpoint.id);

    try {
      await api.deleteEndpoint(endpoint.id);
      await refreshEndpoints();
      const message = `${text.deleted}：${endpoint.name}`;
      setStatus(message);
      notify.success({ title: message });
    } catch (error) {
      setStatus(formatErrorTitle(error, text.delete));
      notify.error(formatErrorNotification(error, text.delete));
    } finally {
      setDeletingId("");
    }
  }

  return (
    <main className="page two-column">
      <section className="page-section">
        <div className="page-heading">
          <span className="module-badge">endpoints</span>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>

        <form className="card-form" onSubmit={handleCreate}>
          <h2>{text.formTitle}</h2>
          <label>
            {text.provider}
            <select value={providerId} onChange={(event) => setProviderId(event.target.value)} required>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {text.name}
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            {text.method}
            <select value={method} onChange={(event) => setMethod(event.target.value as EndpointMethod)}>
              {(["GET", "POST", "PUT", "PATCH", "DELETE"] as EndpointMethod[]).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            {text.path}
            <input value={path} onChange={(event) => setPath(event.target.value)} required />
          </label>
          <label>
            {text.queryJson}
            <textarea value={queryJson} onChange={(event) => setQueryJson(event.target.value)} />
          </label>
          <label>
            {text.headersJson}
            <textarea value={headersJson} onChange={(event) => setHeadersJson(event.target.value)} />
          </label>
          <label>
            {text.bodyJson}
            <textarea value={bodyJson} onChange={(event) => setBodyJson(event.target.value)} />
          </label>
          <label className="checkbox-row">
            <input checked={enabled} type="checkbox" onChange={(event) => setEnabled(event.target.checked)} />
            {text.enabled}
          </label>
          <button type="submit" disabled={!providerId || creating}>
            {creating ? text.loading : text.submit}
          </button>
        </form>
      </section>

      <section className="operation-panel management-panel" aria-label={text.listTitle}>
        <div className="panel-heading">
          <h2>{text.listTitle}</h2>
          <span>{endpoints.length}</span>
        </div>
        {status && <p className="panel-status">{status}</p>}
        {testResult && <p className="panel-status success">{testResult}</p>}
        {!status && endpoints.length === 0 && <p className="panel-status">{text.empty}</p>}
        <label className="panel-editor">
          {text.testInput}
          <textarea value={testInputJson} onChange={(event) => setTestInputJson(event.target.value)} />
        </label>
        <div className="record-list">
          {endpoints.map((endpoint) => (
            <div className="record-row endpoint-row" key={endpoint.id}>
              <strong>{endpoint.name}</strong>
              <span>{endpoint.method}</span>
              <span>{endpoint.path}</span>
              <em>{endpoint.enabled ? "enabled" : "disabled"}</em>
              <button
                aria-label={`${text.test} ${endpoint.name}`}
                className="inline-action"
                disabled={testingId === endpoint.id}
                type="button"
                onClick={() => handleTest(endpoint)}
              >
                {text.test}
              </button>
              <button
                aria-label={`${text.delete} ${endpoint.name}`}
                className="inline-action danger-action"
                disabled={deletingId === endpoint.id}
                type="button"
                onClick={() => handleDelete(endpoint)}
              >
                {text.delete}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function parseJsonObject(value: string, errorMessage: string) {
  const parsed: unknown = JSON.parse(value || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(errorMessage);
  }

  return parsed as Record<string, unknown>;
}
