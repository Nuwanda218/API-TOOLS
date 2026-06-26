import { useState } from "react";
import type { ApiClient } from "../api/client";
import type { ExportedConfiguration } from "../api/types";
import { formatErrorNotification, formatErrorTitle } from "../api/errors";
import type { LanguageKey } from "../components/TopNav";
import { useNotifications } from "../components/notifications/NotificationProvider";

interface ConfigurationPageProps {
  api: Pick<ApiClient, "exportConfiguration" | "importConfiguration">;
  language?: LanguageKey;
}

const copy = {
  "zh-CN": {
    title: "配置迁移",
    subtitle: "导出 Provider、Model、Endpoint 配置；真实 API key 不会写入导出文件。",
    exportTitle: "导出",
    importTitle: "导入",
    exportButton: "导出配置",
    importButton: "导入配置",
    importLabel: "导入 JSON",
    exportLabel: "导出 JSON",
    emptyExport: "尚未导出配置",
    missingKeys: "缺失 Key",
    noMissingKeys: "当前导出配置没有缺失 key 变量。",
    exported: "配置已导出",
    imported: "已导入",
    invalidJson: "导入 JSON 格式无效",
    error: "配置操作失败"
  },
  en: {
    title: "Configuration",
    subtitle: "Export Provider, Model, and Endpoint settings. Real API keys are never included.",
    exportTitle: "Export",
    importTitle: "Import",
    exportButton: "Export configuration",
    importButton: "Import configuration",
    importLabel: "Import JSON",
    exportLabel: "Export JSON",
    emptyExport: "No configuration exported yet",
    missingKeys: "Missing keys",
    noMissingKeys: "No missing key variables in the exported configuration.",
    exported: "Configuration exported",
    imported: "Configuration imported",
    invalidJson: "Import JSON is invalid",
    error: "Configuration action failed"
  }
};

export function ConfigurationPage({ api, language = "zh-CN" }: ConfigurationPageProps) {
  const text = copy[language];
  const notify = useNotifications();
  const [exportJson, setExportJson] = useState("");
  const [importJson, setImportJson] = useState("");
  const [missingApiKeyEnvs, setMissingApiKeyEnvs] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [working, setWorking] = useState(false);

  async function handleExport() {
    setWorking(true);
    try {
      const configuration = await api.exportConfiguration();
      const nextJson = JSON.stringify(configuration, null, 2);
      setExportJson(nextJson);
      setImportJson(nextJson);
      setMissingApiKeyEnvs(configuration.missingApiKeyEnvs);
      setStatus(text.exported);
      notify.success({
        title: text.exported,
        detail: [
          `${configuration.providers.length} providers`,
          `${configuration.models.length} models`,
          `${configuration.endpoints.length} endpoints`,
          `${configuration.mcpServers?.length ?? 0} MCP servers`,
          `${configuration.skills?.length ?? 0} skills`
        ].join(" / ")
      });
    } catch (error) {
      setStatus(formatErrorTitle(error, text.error));
      notify.error(formatErrorNotification(error, text.error));
    } finally {
      setWorking(false);
    }
  }

  async function handleImport() {
    let configuration: ExportedConfiguration;
    try {
      configuration = JSON.parse(importJson) as ExportedConfiguration;
    } catch {
      setStatus(text.invalidJson);
      notify.warning({ title: text.invalidJson });
      return;
    }

    setWorking(true);
    try {
      const result = await api.importConfiguration(configuration);
      const message = `${text.imported}：Provider ${result.imported.providers}，Model ${result.imported.models}，Endpoint ${result.imported.endpoints}，MCP Server ${result.imported.mcpServers}，Skill ${result.imported.skills}`;
      setStatus(message);
      notify.success({ title: text.imported, detail: message });
    } catch (error) {
      setStatus(formatErrorTitle(error, text.error));
      notify.error(formatErrorNotification(error, text.error));
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="operation-surface">
      <header className="page-header">
        <div>
          <span className="eyebrow">configuration</span>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
      </header>

      <div className="management-grid">
        <section className="operation-panel management-panel" aria-label={text.exportTitle}>
          <div className="panel-heading">
            <h2>{text.exportTitle}</h2>
            <button type="button" disabled={working} onClick={handleExport}>
              {text.exportButton}
            </button>
          </div>
          {status && <p className="panel-status success">{status}</p>}
          <label className="panel-editor">
            {text.exportLabel}
            <textarea aria-label={text.exportLabel} readOnly value={exportJson || text.emptyExport} />
          </label>
          <div className="record-list">
            {missingApiKeyEnvs.length > 0 ? (
              missingApiKeyEnvs.map((apiKeyEnv) => (
                <div className="record-row" key={apiKeyEnv}>
                  <strong>{`${text.missingKeys}：${apiKeyEnv}`}</strong>
                </div>
              ))
            ) : (
              <p className="panel-status">{text.noMissingKeys}</p>
            )}
          </div>
        </section>

        <section className="operation-panel management-panel" aria-label={text.importTitle}>
          <div className="panel-heading">
            <h2>{text.importTitle}</h2>
            <button type="button" disabled={working || !importJson.trim()} onClick={handleImport}>
              {text.importButton}
            </button>
          </div>
          <label className="panel-editor">
            {text.importLabel}
            <textarea
              aria-label={text.importLabel}
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
            />
          </label>
        </section>
      </div>
    </section>
  );
}
