import { useEffect, useState, type FormEvent } from "react";
import type { ApiClient } from "../api/client";
import { formatErrorNotification, formatErrorTitle } from "../api/errors";
import type { EndpointRecord, McpServerRecord, ModelRecord, WorkflowStepDefinition, WorkflowStepType } from "../api/types";
import { useNotifications } from "../components/notifications/NotificationProvider";
import type { LanguageKey } from "../components/TopNav";

interface WorkflowBuilderPageProps {
  api: Pick<ApiClient, "listModels" | "listEndpoints" | "listMcpServers" | "runWorkflow">;
  language?: LanguageKey;
}

interface BuilderStep {
  id: string;
  type: WorkflowStepType;
  modelId: string;
  endpointId: string;
  mcpServerId: string;
  toolName: string;
  inputJson: string;
}

const copy = {
  "zh-CN": {
    title: "工作流构建器",
    subtitle: "用表单创建多步骤 api-workflow，按顺序串联 LLM、Endpoint 和 MCP 工具调用。",
    badge: "builder",
    resources: "资源",
    input: "工作流输入 JSON",
    addStepType: "新增步骤类型",
    addStep: "添加步骤",
    steps: "步骤",
    noSteps: "还没有步骤",
    run: "运行工作流",
    running: "正在运行工作流",
    succeeded: "工作流运行成功",
    failed: "工作流运行失败",
    invalidJson: "JSON 格式无效",
    model: "模型",
    endpoint: "Endpoint",
    mcpServer: "MCP Server",
    toolName: "工具名",
    stepInput: "输入 JSON",
    delete: "删除",
    output: "运行输出",
    models: "模型",
    endpoints: "Endpoints",
    mcpServers: "MCP Servers"
  },
  en: {
    title: "Workflow Builder",
    subtitle: "Create multi-step api-workflows that chain LLM, Endpoint, and MCP tool calls.",
    badge: "builder",
    resources: "Resources",
    input: "Workflow Input JSON",
    addStepType: "New Step Type",
    addStep: "Add Step",
    steps: "Steps",
    noSteps: "No steps yet",
    run: "Run workflow",
    running: "Running workflow",
    succeeded: "Workflow run succeeded",
    failed: "Workflow run failed",
    invalidJson: "Invalid JSON",
    model: "Model",
    endpoint: "Endpoint",
    mcpServer: "MCP Server",
    toolName: "Tool Name",
    stepInput: "Input JSON",
    delete: "Delete",
    output: "Output",
    models: "Models",
    endpoints: "Endpoints",
    mcpServers: "MCP Servers"
  }
} satisfies Record<LanguageKey, Record<string, string>>;

export function WorkflowBuilderPage({ api, language = "zh-CN" }: WorkflowBuilderPageProps) {
  const text = copy[language];
  const notify = useNotifications();
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointRecord[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerRecord[]>([]);
  const [stepType, setStepType] = useState<WorkflowStepType>("llm.chat");
  const [steps, setSteps] = useState<BuilderStep[]>([]);
  const [workflowInputJson, setWorkflowInputJson] = useState("{\n  \"message\": \"\"\n}");
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([api.listModels(), api.listEndpoints(), api.listMcpServers()])
      .then(([modelItems, endpointItems, serverItems]) => {
        if (!active) return;
        setModels(modelItems.filter((model) => model.enabled));
        setEndpoints(endpointItems.filter((endpoint) => endpoint.enabled));
        setMcpServers(serverItems.filter((server) => server.enabled));
      })
      .catch((error) => {
        if (!active) return;
        setStatus(formatErrorTitle(error, text.failed));
        notify.error(formatErrorNotification(error, text.failed));
      });

    return () => {
      active = false;
    };
  }, [api, notify, text.failed]);

  function handleAddStep() {
    const index = steps.length + 1;
    setSteps((current) => [...current, createBuilderStep(index, stepType, models, endpoints, mcpServers)]);
  }

  function updateStep(stepId: string, patch: Partial<BuilderStep>) {
    setSteps((current) => current.map((step) => (step.id === stepId ? { ...step, ...patch } : step)));
  }

  function deleteStep(stepId: string) {
    setSteps((current) => current.filter((step) => step.id !== stepId));
  }

  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    let workflowInput: Record<string, unknown>;
    let workflowSteps: WorkflowStepDefinition[];
    try {
      workflowInput = parseJsonRecord(workflowInputJson);
      workflowSteps = steps.map(toWorkflowStepDefinition);
    } catch {
      setStatus(text.invalidJson);
      notify.error({ title: text.invalidJson });
      return;
    }

    setRunning(true);
    setStatus(text.running);
    setOutput("");
    notify.info({ title: text.running });

    try {
      const result = await api.runWorkflow({
        workflowType: "api-workflow",
        input: workflowInput,
        steps: workflowSteps
      });
      setOutput(JSON.stringify(result.outputs, null, 2));
      setStatus(result.run.status);
      notify.success({ title: text.succeeded });
    } catch (error) {
      setStatus(formatErrorTitle(error, text.failed));
      notify.error(formatErrorNotification(error, text.failed));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="page two-column workflow-builder-page">
      <section className="page-section">
        <div className="page-heading">
          <span className="module-badge">{text.badge}</span>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>

        <form className="card-form workflow-form" onSubmit={handleRun}>
          <h2>{text.resources}</h2>
          <div className="builder-resource-strip">
            <span>{text.models}: {models.length}</span>
            <span>{text.endpoints}: {endpoints.length}</span>
            <span>{text.mcpServers}: {mcpServers.length}</span>
          </div>
          <label>
            {text.input}
            <textarea
              aria-label={text.input}
              rows={5}
              value={workflowInputJson}
              onChange={(event) => setWorkflowInputJson(event.target.value)}
            />
          </label>
          <label>
            {text.addStepType}
            <select value={stepType} onChange={(event) => setStepType(event.target.value as WorkflowStepType)}>
              <option value="llm.chat">llm.chat</option>
              <option value="endpoint.call">endpoint.call</option>
              <option value="mcp.call">mcp.call</option>
            </select>
          </label>
          <button type="button" onClick={handleAddStep}>
            {text.addStep}
          </button>
          <button disabled={running || steps.length === 0} type="submit">
            {running ? text.running : text.run}
          </button>
        </form>
      </section>

      <section className="page-section">
        <div className="panel-heading">
          <div>
            <span className="module-badge">steps</span>
            <h2>{text.steps}</h2>
          </div>
          {status && <span className="status-pill">{status}</span>}
        </div>

        <div className="operation-panel builder-step-list">
          {steps.length === 0 && <p className="muted">{text.noSteps}</p>}
          {steps.map((step) => (
            <BuilderStepCard
              endpoints={endpoints}
              key={step.id}
              language={language}
              mcpServers={mcpServers}
              models={models}
              onDelete={deleteStep}
              onUpdate={updateStep}
              step={step}
              text={text}
            />
          ))}
        </div>

        <section className="operation-panel tool-panel" aria-label={text.output}>
          <div className="panel-heading">
            <div>
              <span className="module-badge">output</span>
              <h2>{text.output}</h2>
            </div>
          </div>
          {output ? <pre>{output}</pre> : <p className="muted">{text.output}</p>}
        </section>
      </section>
    </main>
  );
}

function BuilderStepCard(input: {
  step: BuilderStep;
  models: ModelRecord[];
  endpoints: EndpointRecord[];
  mcpServers: McpServerRecord[];
  language: LanguageKey;
  text: Record<string, string>;
  onUpdate: (stepId: string, patch: Partial<BuilderStep>) => void;
  onDelete: (stepId: string) => void;
}) {
  const { step, models, endpoints, mcpServers, text, onUpdate, onDelete } = input;

  return (
    <article className="builder-step-card">
      <div className="panel-heading">
        <h3>{step.id} {step.type}</h3>
        <button className="inline-action danger-action" type="button" onClick={() => onDelete(step.id)}>
          {text.delete}
        </button>
      </div>

      {step.type === "llm.chat" && (
        <label>
          {step.id} {text.model}
          <select value={step.modelId} onChange={(event) => onUpdate(step.id, { modelId: event.target.value })}>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.displayName}
              </option>
            ))}
          </select>
        </label>
      )}

      {step.type === "endpoint.call" && (
        <label>
          {step.id} {text.endpoint}
          <select value={step.endpointId} onChange={(event) => onUpdate(step.id, { endpointId: event.target.value })}>
            {endpoints.map((endpoint) => (
              <option key={endpoint.id} value={endpoint.id}>
                {endpoint.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {step.type === "mcp.call" && (
        <>
          <label>
            {step.id} {text.mcpServer}
            <select
              value={step.mcpServerId}
              onChange={(event) => onUpdate(step.id, { mcpServerId: event.target.value })}
            >
              {mcpServers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {step.id} {text.toolName}
            <input value={step.toolName} onChange={(event) => onUpdate(step.id, { toolName: event.target.value })} />
          </label>
        </>
      )}

      <label>
        {step.id} {text.stepInput}
        <textarea rows={4} value={step.inputJson} onChange={(event) => onUpdate(step.id, { inputJson: event.target.value })} />
      </label>
    </article>
  );
}

function createBuilderStep(
  index: number,
  type: WorkflowStepType,
  models: ModelRecord[],
  endpoints: EndpointRecord[],
  mcpServers: McpServerRecord[]
): BuilderStep {
  const id = `step-${index}`;

  return {
    id,
    type,
    modelId: models[0]?.id ?? "",
    endpointId: endpoints[0]?.id ?? "",
    mcpServerId: mcpServers[0]?.id ?? "",
    toolName: "",
    inputJson: defaultInputJson(type)
  };
}

function defaultInputJson(type: WorkflowStepType): string {
  if (type === "endpoint.call") return "{\n  \"prompt\": \"{{input.message}}\"\n}";
  if (type === "mcp.call") return "{\n  \"query\": \"{{input.message}}\"\n}";
  return "{\n  \"message\": \"{{input.message}}\"\n}";
}

function toWorkflowStepDefinition(step: BuilderStep): WorkflowStepDefinition {
  const input = parseJsonRecord(step.inputJson);

  if (step.type === "endpoint.call") {
    return {
      id: step.id,
      type: step.type,
      endpointId: step.endpointId,
      input
    };
  }

  if (step.type === "mcp.call") {
    return {
      id: step.id,
      type: step.type,
      mcpServerId: step.mcpServerId,
      toolName: step.toolName,
      input
    };
  }

  return {
    id: step.id,
    type: step.type,
    modelId: step.modelId,
    input
  };
}

function parseJsonRecord(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid_json");
  }
  return parsed as Record<string, unknown>;
}
