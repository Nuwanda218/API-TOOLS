import { useEffect, useState, type FormEvent } from "react";
import type { ApiClient } from "../api/client";
import { formatErrorNotification, formatErrorTitle } from "../api/errors";
import type { CreateMcpServerInput, ListMcpToolsResponse, McpServerRecord, McpToolRecord } from "../api/types";
import { useNotifications } from "../components/notifications/NotificationProvider";
import type { LanguageKey } from "../components/TopNav";

interface McpServersPageProps {
  api: Pick<
    ApiClient,
    | "listMcpServers"
    | "createMcpServer"
    | "updateMcpServer"
    | "deleteMcpServer"
    | "testMcpServer"
    | "listMcpServerTools"
  >;
  language?: LanguageKey;
}

const copy = {
  "zh-CN": {
    title: "MCP Server",
    eyebrow: "mcp",
    description: "管理本地 stdio MCP Server，连接后可在工作流中通过 mcp.call 调用工具。",
    createTitle: "新增 MCP Server",
    listTitle: "已接入 Server",
    toolsTitle: "工具列表",
    name: "名称",
    command: "命令",
    args: "参数 JSON",
    env: "环境变量 JSON",
    enabled: "启用",
    create: "创建 MCP Server",
    creating: "正在创建 MCP Server",
    created: "MCP Server 已创建",
    delete: "删除",
    deleting: "正在删除 MCP Server",
    deleted: "MCP Server 已删除",
    test: "测试",
    testing: "正在测试连接",
    loading: "正在加载 MCP Server",
    empty: "还没有 MCP Server",
    noTools: "尚未拉取工具列表",
    connected: "连接成功，发现",
    toolUnit: "个工具",
    error: "操作失败",
    invalidArgs: "参数 JSON 必须是字符串数组。",
    invalidEnv: "环境变量 JSON 必须是键值对象。",
    inputSchema: "Input Schema",
    workflowHint: "此 Server 可用于 mcp.call 工作流步骤"
  },
  en: {
    title: "MCP Servers",
    eyebrow: "mcp",
    description: "Manage local stdio MCP servers and call their tools from mcp.call workflow steps.",
    createTitle: "New MCP Server",
    listTitle: "Connected Servers",
    toolsTitle: "Tools",
    name: "Name",
    command: "Command",
    args: "Args JSON",
    env: "Env JSON",
    enabled: "Enabled",
    create: "Create MCP Server",
    creating: "Creating MCP Server",
    created: "MCP Server created",
    delete: "Delete",
    deleting: "Deleting MCP Server",
    deleted: "MCP Server deleted",
    test: "Test",
    testing: "Testing connection",
    loading: "Loading MCP servers",
    empty: "No MCP servers yet",
    noTools: "No tools loaded yet",
    connected: "Connected, found",
    toolUnit: "tools",
    error: "Operation failed",
    invalidArgs: "Args JSON must be an array of strings.",
    invalidEnv: "Env JSON must be an object with string values.",
    inputSchema: "Input Schema",
    workflowHint: "This server can be used by mcp.call workflow steps"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

function parseArgs(value: string): string[] {
  const parsed = JSON.parse(value || "[]");
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("invalid_args");
  }
  return parsed;
}

function parseEnv(value: string): Record<string, string> {
  const parsed = JSON.parse(value || "{}");
  if (
    !parsed ||
    Array.isArray(parsed) ||
    typeof parsed !== "object" ||
    Object.values(parsed).some((item) => typeof item !== "string")
  ) {
    throw new Error("invalid_env");
  }
  return parsed as Record<string, string>;
}

function normalizeTools(response: ListMcpToolsResponse | McpToolRecord[]): McpToolRecord[] {
  return Array.isArray(response) ? response : response.tools;
}

export function McpServersPage({ api, language = "zh-CN" }: McpServersPageProps) {
  const text = copy[language];
  const notify = useNotifications();
  const [servers, setServers] = useState<McpServerRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tools, setTools] = useState<Record<string, McpToolRecord[]>>({});
  const [status, setStatus] = useState(text.loading);
  const [name, setName] = useState("");
  const [command, setCommand] = useState("npx");
  const [argsJson, setArgsJson] = useState("[]");
  const [envJson, setEnvJson] = useState("{}");
  const [enabled, setEnabled] = useState(true);
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStatus(text.loading);
    api
      .listMcpServers()
      .then((items) => {
        if (!active) return;
        setServers(items);
        setSelectedId((current) => current ?? items[0]?.id ?? null);
        setStatus(items.length ? "" : text.empty);
      })
      .catch((error) => {
        if (!active) return;
        setStatus(formatErrorTitle(error, text.error));
      });

    return () => {
      active = false;
    };
  }, [api, text.empty, text.error, text.loading]);

  async function refreshServers() {
    const items = await api.listMcpServers();
    setServers(items);
    setSelectedId((current) => (current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null));
    setStatus(items.length ? "" : text.empty);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let input: CreateMcpServerInput;
    try {
      input = {
        name: name.trim(),
        transport: "stdio",
        command: command.trim(),
        args: parseArgs(argsJson),
        env: parseEnv(envJson),
        enabled
      };
    } catch (error) {
      const message = error instanceof Error && error.message === "invalid_env" ? text.invalidEnv : text.invalidArgs;
      setStatus(message);
      notify.error({ title: message });
      return;
    }

    setCreating(true);
    setStatus(text.creating);
    notify.info({ title: text.creating, detail: input.name });

    try {
      const created = await api.createMcpServer(input);
      setName("");
      setArgsJson("[]");
      setEnvJson("{}");
      await refreshServers();
      setSelectedId(created.id);
      const title = `${text.created}：${created.name}`;
      setStatus(title);
      notify.success({ title });
    } catch (error) {
      const notification = formatErrorNotification(error, text.error);
      setStatus(formatErrorTitle(error, text.error));
      notify.error(notification);
    } finally {
      setCreating(false);
    }
  }

  async function handleTest(server: McpServerRecord) {
    setTestingId(server.id);
    setStatus(text.testing);
    notify.info({ title: text.testing, detail: server.name });

    try {
      const testResult = await api.testMcpServer(server.id);
      const toolResponse = await api.listMcpServerTools(server.id);
      const nextTools = normalizeTools(toolResponse);
      setTools((current) => ({ ...current, [server.id]: nextTools }));
      setSelectedId(server.id);
      const title = `${text.connected} ${testResult.toolCount} ${text.toolUnit}`;
      setStatus(title);
      notify.success({ title, detail: server.name });
    } catch (error) {
      const notification = formatErrorNotification(error, text.error);
      setStatus(formatErrorTitle(error, text.error));
      notify.error(notification);
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(server: McpServerRecord) {
    setDeletingId(server.id);
    setStatus(text.deleting);
    notify.info({ title: text.deleting, detail: server.name });

    try {
      await api.deleteMcpServer(server.id);
      setTools((current) => {
        const next = { ...current };
        delete next[server.id];
        return next;
      });
      await refreshServers();
      const title = `${text.deleted}：${server.name}`;
      setStatus(title);
      notify.success({ title });
    } catch (error) {
      const notification = formatErrorNotification(error, text.error);
      setStatus(formatErrorTitle(error, text.error));
      notify.error(notification);
    } finally {
      setDeletingId(null);
    }
  }

  const selectedServer = servers.find((server) => server.id === selectedId) ?? null;
  const selectedTools = selectedServer ? tools[selectedServer.id] ?? [] : [];

  return (
    <main className="page two-column">
      <section className="page-section">
        <div className="page-heading">
          <span className="module-badge">{text.eyebrow}</span>
          <h1>{text.title}</h1>
          <p>{text.description}</p>
        </div>

        <form className="card-form" onSubmit={handleCreate}>
          <h2>{text.createTitle}</h2>
          <label>
            {text.name}
            <input required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            {text.command}
            <input required value={command} onChange={(event) => setCommand(event.target.value)} />
          </label>
          <label>
            {text.args}
            <textarea rows={4} value={argsJson} onChange={(event) => setArgsJson(event.target.value)} />
          </label>
          <label>
            {text.env}
            <textarea rows={4} value={envJson} onChange={(event) => setEnvJson(event.target.value)} />
          </label>
          <label className="checkbox-row">
            <input checked={enabled} type="checkbox" onChange={(event) => setEnabled(event.target.checked)} />
            {text.enabled}
          </label>
          <button disabled={creating} type="submit">
            {creating ? text.creating : text.create}
          </button>
        </form>
      </section>

      <section className="page-section">
        <div className="panel-heading">
          <div>
            <span className="module-badge">servers</span>
            <h2>{text.listTitle}</h2>
          </div>
          {status && <span className="status-pill">{status}</span>}
        </div>

        <div className="operation-panel resource-list">
          {servers.length === 0 && <p className="muted">{text.empty}</p>}
          {servers.map((server) => (
            <article className={`resource-card ${selectedId === server.id ? "selected" : ""}`} key={server.id}>
              <button className="resource-card-main" type="button" onClick={() => setSelectedId(server.id)}>
                <strong>{server.name}</strong>
                <span>{server.command}</span>
                <code>{server.transport}</code>
              </button>
              <div className="card-actions">
                <button disabled={testingId === server.id} type="button" onClick={() => handleTest(server)}>
                  {testingId === server.id ? text.testing : `${text.test} ${server.name}`}
                </button>
                <button
                  className="inline-action danger-action"
                  disabled={deletingId === server.id}
                  type="button"
                  onClick={() => handleDelete(server)}
                >
                  {deletingId === server.id ? text.deleting : `${text.delete} ${server.name}`}
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="operation-panel tool-panel">
          <div className="panel-heading">
            <div>
              <span className="module-badge">tools</span>
              <h2>{text.toolsTitle}</h2>
            </div>
            {selectedServer && <code>{selectedServer.name}</code>}
          </div>
          <p className="muted">{text.workflowHint}</p>
          {selectedTools.length === 0 && <p className="muted">{text.noTools}</p>}
          {selectedTools.map((tool) => (
            <article className="tool-card" key={tool.name}>
              <h3>{tool.name}</h3>
              {tool.description && <p>{tool.description}</p>}
              <span className="module-badge">{text.inputSchema}</span>
              <pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
