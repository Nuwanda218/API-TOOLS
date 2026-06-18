import { type FormEvent, useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import { formatErrorNotification, formatErrorTitle } from "../api/errors";
import type { ModelCapability, ModelRecord, ProviderRecord, RemoteModelRecord } from "../api/types";
import { useNotifications } from "../components/notifications/NotificationProvider";
import type { LanguageKey } from "../components/TopNav";

interface ModelsPageProps {
  api: Pick<
    ApiClient,
    "listProviders" | "listModels" | "createModel" | "deleteModel" | "testModel" | "listRemoteModels" | "importModels"
  >;
  language?: LanguageKey;
}

const copy = {
  "zh-CN": {
    title: "模型管理",
    subtitle: "从 Provider 创建或导入模型，并执行最小可用性测试。",
    formTitle: "新增本地模型",
    provider: "Provider",
    displayName: "显示名称",
    modelId: "Model ID",
    capability: "能力",
    submit: "添加模型",
    remoteTitle: "远程模型",
    fetchRemote: "拉取远程模型",
    import: "导入",
    localTitle: "本地模型",
    test: "测试",
    success: "成功",
    empty: "还没有本地模型。",
    noProvider: "请先创建 Provider。",
    creating: "正在创建模型...",
    created: "模型已创建",
    fetchingRemote: "正在拉取远程模型...",
    fetchedRemote: "已拉取",
    remoteSuffix: "个远程模型",
    importDone: "导入完成",
    createdCount: "新增",
    skippedCount: "跳过",
    countSuffix: "个",
    delete: "删除",
    deleting: "正在删除模型...",
    deleted: "模型已删除"
  },
  en: {
    title: "Models",
    subtitle: "Create or import models from providers, then run minimal availability tests.",
    formTitle: "New local model",
    provider: "Provider",
    displayName: "Display name",
    modelId: "Model ID",
    capability: "Capability",
    submit: "Add model",
    remoteTitle: "Remote models",
    fetchRemote: "Fetch remote models",
    import: "Import",
    localTitle: "Local models",
    test: "Test",
    success: "Succeeded",
    empty: "No local models yet.",
    noProvider: "Create a provider first.",
    creating: "Creating model...",
    created: "Model created",
    fetchingRemote: "Fetching remote models...",
    fetchedRemote: "Fetched",
    remoteSuffix: "remote models",
    importDone: "Import complete",
    createdCount: "created",
    skippedCount: "skipped",
    countSuffix: "",
    delete: "Delete",
    deleting: "Deleting model...",
    deleted: "Model deleted"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

export function ModelsPage({ api, language = "zh-CN" }: ModelsPageProps) {
  const text = copy[language];
  const notify = useNotifications();
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [remoteModels, setRemoteModels] = useState<RemoteModelRecord[]>([]);
  const [providerId, setProviderId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [modelId, setModelId] = useState("");
  const [capability, setCapability] = useState<ModelCapability>("chat");
  const [status, setStatus] = useState("");
  const [testResult, setTestResult] = useState("");
  const [creating, setCreating] = useState(false);
  const [fetchingRemote, setFetchingRemote] = useState(false);
  const [importingId, setImportingId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([api.listProviders(), api.listModels()])
      .then(([providerRows, modelRows]) => {
        if (!active) return;
        setProviders(providerRows);
        setModels(modelRows);
        setProviderId((current) => current || providerRows[0]?.id || "");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus(formatErrorTitle(error, text.noProvider));
      });

    return () => {
      active = false;
    };
  }, [api]);

  async function refreshModels() {
    const modelRows = await api.listModels();
    setModels(modelRows);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setStatus(text.creating);
    setTestResult("");
    notify.info({ title: text.creating });

    try {
      const created = await api.createModel({
        providerId,
        displayName,
        modelId,
        capability,
        enabled: true,
        defaultParams: {},
        pricing: {}
      });

      await refreshModels();
      const successMessage = `${text.created}：${created.displayName}`;
      setStatus(successMessage);
      notify.success({ title: successMessage });
      setDisplayName("");
      setModelId("");
    } catch (error) {
      setStatus(formatErrorTitle(error, text.created));
      notify.error(formatErrorNotification(error, text.created));
    } finally {
      setCreating(false);
    }
  }

  async function handleFetchRemoteModels() {
    if (!providerId) {
      setStatus(text.noProvider);
      notify.warning({ title: text.noProvider });
      return;
    }

    setFetchingRemote(true);
    setStatus(text.fetchingRemote);
    setTestResult("");
    notify.info({ title: text.fetchingRemote });

    try {
      const result = await api.listRemoteModels(providerId);
      setRemoteModels(result.models);
      const successMessage = `${text.fetchedRemote} ${result.models.length} ${text.remoteSuffix}`;
      setStatus(successMessage);
      notify.success({ title: successMessage });
    } catch (error) {
      setStatus(formatErrorTitle(error, text.fetchRemote));
      notify.error(formatErrorNotification(error, text.fetchRemote));
    } finally {
      setFetchingRemote(false);
    }
  }

  async function handleImport(remoteModel: RemoteModelRecord) {
    setImportingId(remoteModel.id);
    setStatus("");
    setTestResult("");
    notify.info({ title: text.import, detail: remoteModel.id });

    try {
      const result = await api.importModels(providerId, [
        {
          providerId,
          displayName: remoteModel.id,
          modelId: remoteModel.id,
          capability: "chat",
          enabled: true,
          defaultParams: {},
          pricing: {}
        }
      ]);

      await refreshModels();
      const successMessage =
        `${text.importDone}：${text.createdCount} ${result.created.length} ${text.countSuffix}，${text.skippedCount} ${result.skipped.length} ${text.countSuffix}`.trim()
      setStatus(successMessage);
      notify.success({ title: successMessage });
    } catch (error) {
      setStatus(formatErrorTitle(error, text.importDone));
      notify.error(formatErrorNotification(error, text.importDone));
    } finally {
      setImportingId("");
    }
  }

  async function handleTest(id: string) {
    notify.info({ title: text.test });
    try {
      const result = await api.testModel(id);
      const usage =
        result.usage?.inputTokens !== undefined || result.usage?.outputTokens !== undefined
          ? `, tokens ${result.usage?.inputTokens ?? 0}/${result.usage?.outputTokens ?? 0}`
          : "";
      const successMessage = `${text.success}: ${result.message} (${result.latencyMs}ms${usage})`;
      setTestResult(successMessage);
      notify.success({ title: successMessage });
    } catch (error) {
      setTestResult(formatErrorTitle(error, text.test));
      notify.error(formatErrorNotification(error, text.test));
    }
  }

  async function handleDelete(model: ModelRecord) {
    setDeletingId(model.id);
    setStatus(text.deleting);
    setTestResult("");
    notify.info({ title: text.deleting, detail: model.displayName });

    try {
      await api.deleteModel(model.id);
      await refreshModels();
      const successMessage = `${text.deleted}：${model.displayName}`;
      setStatus(successMessage);
      notify.success({ title: successMessage });
    } catch (error) {
      setStatus(formatErrorTitle(error, text.deleted));
      notify.error(formatErrorNotification(error, text.deleted));
    } finally {
      setDeletingId("");
    }
  }

  return (
    <main className="page two-column">
      <section className="page-section">
        <div className="page-heading">
          <span className="module-badge">models</span>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>

        <form className="card-form" onSubmit={handleSubmit}>
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
            {text.displayName}
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
          <label>
            {text.modelId}
            <input value={modelId} onChange={(event) => setModelId(event.target.value)} required />
          </label>
          <label>
            {text.capability}
            <select value={capability} onChange={(event) => setCapability(event.target.value as ModelCapability)}>
              <option value="chat">chat</option>
              <option value="image">image</option>
              <option value="multimodal">multimodal</option>
            </select>
          </label>
          <button type="submit" disabled={!providerId || creating}>
            {creating ? text.creating : text.submit}
          </button>
        </form>

        <section className="operation-panel management-panel">
          <div className="panel-heading">
            <h2>{text.remoteTitle}</h2>
            <button className="secondary-action" disabled={fetchingRemote} type="button" onClick={handleFetchRemoteModels}>
              {fetchingRemote ? text.fetchingRemote : text.fetchRemote}
            </button>
          </div>
          <div className="record-list compact-list">
            {remoteModels.map((remoteModel) => (
              <div className="record-row model-row" key={remoteModel.id}>
                <strong>{remoteModel.id}</strong>
                <span>{remoteModel.ownedBy ?? "unknown"}</span>
                <button
                  className="inline-action"
                  disabled={importingId === remoteModel.id}
                  type="button"
                  onClick={() => handleImport(remoteModel)}
                >
                  {importingId === remoteModel.id ? text.importDone : text.import}
                </button>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="operation-panel management-panel" aria-label={text.localTitle}>
        <div className="panel-heading">
          <h2>{text.localTitle}</h2>
          <span>{models.length}</span>
        </div>
        {status && <p className="panel-status">{status}</p>}
        {testResult && <p className="panel-status success">{testResult}</p>}
        {models.length === 0 && !status && <p className="panel-status">{text.empty}</p>}
        <div className="record-list">
          {models.map((model) => (
            <div className="record-row model-row" key={model.id}>
              <strong>{model.displayName}</strong>
              <span>{model.modelId}</span>
              <span>{model.capability}</span>
              <button
                aria-label={`${text.test} ${model.displayName}`}
                className="inline-action"
                type="button"
                onClick={() => handleTest(model.id)}
              >
                {text.test}
              </button>
              <button
                aria-label={`${text.delete} ${model.displayName}`}
                className="inline-action danger-action"
                disabled={deletingId === model.id}
                type="button"
                onClick={() => handleDelete(model)}
              >
                {deletingId === model.id ? text.deleting : text.delete}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
