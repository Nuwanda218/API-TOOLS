import { nanoid } from "nanoid";
import type { LlmChatData } from "../apiProtocol/types.js";
import type { AdapterRegistry } from "../adapters/types.js";
import { getRequiredApiKey } from "../config/env.js";
import type { AppDatabase } from "../db/client.js";
import { createEndpointRepository, type Endpoint } from "../endpoints/endpointRepository.js";
import { testEndpoint } from "../endpoints/endpointTester.js";
import { ProviderError } from "../errors/providerError.js";
import { createModelRepository, type Model } from "../providers/modelRepository.js";
import { createProviderRepository, type Provider } from "../providers/providerRepository.js";
import type {
  RunRecord,
  RunWorkflowInput,
  RunWorkflowResult,
  SessionRecord,
  LlmChatStepDefinition,
  WorkflowStepDefinition
} from "./types.js";

interface WorkflowRunnerDependencies {
  adapterRegistry: AdapterRegistry;
  env: NodeJS.ProcessEnv;
  endpointFetch?: typeof fetch;
}

interface LlmChatStepResult {
  provider: Provider;
  model: Model;
  content: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  costEstimate: number;
}

interface ResolvedLlmChatStepTarget {
  provider: Provider;
  model: Model;
  apiKey: string;
}

interface EndpointCallStepResult {
  provider: Provider;
  endpoint: Endpoint;
  bodyPreview: unknown;
  statusCode: number;
  latencyMs: number;
}

interface ResolvedEndpointCallStepTarget {
  provider: Provider;
  endpoint: Endpoint;
  apiKey: string;
}

interface RunningRunStepInput {
  runId: string;
  stepIndex: number;
  step: WorkflowStepDefinition;
  providerId?: string;
  modelId?: string;
  endpointId?: string;
  inputPreview: string;
  startedAt: string;
}

export function createWorkflowRunner(db: AppDatabase, dependencies: WorkflowRunnerDependencies) {
  const providers = createProviderRepository(db);
  const models = createModelRepository(db);
  const endpoints = createEndpointRepository(db);

  function resolveLlmChatStepTarget(step: LlmChatStepDefinition): ResolvedLlmChatStepTarget {
    const model = models.getById(step.modelId);
    if (!model) {
      throw new ProviderError("model_not_found", "Model not found", { statusCode: 404 });
    }

    const provider = providers.getById(model.providerId);
    if (!provider) {
      throw new ProviderError("provider_not_found", "Provider not found", { statusCode: 404 });
    }

    if (model.capability !== "chat" && model.capability !== "multimodal") {
      throw new ProviderError("unsupported_capability", "Model cannot run llm.chat workflow steps", { statusCode: 400 });
    }

    const apiKey = getRequiredApiKey(provider.apiKeyEnv, dependencies.env);

    return { provider, model, apiKey };
  }

  function resolveEndpointCallStepTarget(step: WorkflowStepDefinition): ResolvedEndpointCallStepTarget {
    if (step.type !== "endpoint.call") {
      throw new ProviderError("invalid_workflow_step", "endpoint.call step requires endpointId", { statusCode: 400 });
    }

    const endpoint = endpoints.getById(step.endpointId);
    if (!endpoint) {
      throw new ProviderError("endpoint_not_found", "Endpoint not found", { statusCode: 404 });
    }

    const provider = providers.getById(endpoint.providerId);
    if (!provider) {
      throw new ProviderError("provider_not_found", "Provider not found", { statusCode: 404 });
    }

    const apiKey = getRequiredApiKey(provider.apiKeyEnv, dependencies.env);

    return { provider, endpoint, apiKey };
  }

  async function runLlmChatStep(target: ResolvedLlmChatStepTarget, message: string): Promise<LlmChatStepResult> {
    const invocation = await dependencies.adapterRegistry.invoke({
      operationId: "llm.chat",
      provider: target.provider,
      apiKey: target.apiKey,
      resource: { kind: "model", model: target.model },
      input: {
        messages: [{ role: "user", content: message }]
      }
    });

    if (!invocation.ok) {
      const error = new ProviderError(invocation.code, invocation.message, {
        providerMessage: invocation.providerMessage,
        statusCode: invocation.statusCode,
        suggestion: invocation.suggestion
      });
      Object.defineProperty(error, "latencyMs", {
        value: invocation.latencyMs,
        enumerable: false
      });
      throw error;
    }

    const inputTokens = asNumber(invocation.usage?.inputTokens);
    const outputTokens = asNumber(invocation.usage?.outputTokens);
    const data = invocation.data as LlmChatData;

    return {
      provider: target.provider,
      model: target.model,
      content: data.content,
      latencyMs: invocation.latencyMs,
      inputTokens,
      outputTokens,
      costEstimate: estimateCost(inputTokens, outputTokens, target.model.pricing)
    };
  }

  async function runEndpointCallStep(
    target: ResolvedEndpointCallStepTarget,
    input: Record<string, unknown>
  ): Promise<EndpointCallStepResult> {
    const result = await testEndpoint({
      provider: target.provider,
      endpoint: target.endpoint,
      apiKey: target.apiKey,
      input,
      fetch: dependencies.endpointFetch
    });

    return {
      provider: target.provider,
      endpoint: target.endpoint,
      bodyPreview: result.bodyPreview,
      statusCode: result.status,
      latencyMs: result.latencyMs
    };
  }

  function insertRunningRunStep(input: RunningRunStepInput): string {
    const stepId = nanoid();

    db.prepare(`
      insert into run_steps (
        id,
        run_id,
        step_index,
        step_type,
        provider_id,
        model_id,
        endpoint_id,
        status,
        input_preview,
        created_at,
        updated_at
      )
      values (
        @id,
        @runId,
        @stepIndex,
        @stepType,
        @providerId,
        @modelId,
        @endpointId,
        'running',
        @inputPreview,
        @createdAt,
        @updatedAt
      )
    `).run({
      id: stepId,
      runId: input.runId,
      stepIndex: input.stepIndex,
      stepType: input.step.type,
      providerId: input.providerId ?? null,
      modelId: input.modelId ?? null,
      endpointId: input.endpointId ?? null,
      inputPreview: input.inputPreview,
      createdAt: input.startedAt,
      updatedAt: input.startedAt
    });

    return stepId;
  }

  function markRunStepSucceeded(input: {
    stepId: string;
    outputPreview: string;
    latencyMs: number;
    inputTokens?: number;
    outputTokens?: number;
    costEstimate: number;
    updatedAt: string;
  }) {
    db.prepare(`
      update run_steps
      set status = 'succeeded',
          output_preview = @outputPreview,
          latency_ms = @latencyMs,
          input_tokens = @inputTokens,
          output_tokens = @outputTokens,
          cost_estimate = @costEstimate,
          updated_at = @updatedAt
      where id = @stepId
    `).run({
      stepId: input.stepId,
      outputPreview: input.outputPreview,
      latencyMs: input.latencyMs,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      costEstimate: input.costEstimate,
      updatedAt: input.updatedAt
    });
  }

  function markRunStepFailed(input: {
    stepId: string;
    error: ProviderError;
    latencyMs?: number;
    updatedAt: string;
  }) {
    db.prepare(`
      update run_steps
      set status = 'failed',
          error_code = @errorCode,
          error_message = @errorMessage,
          latency_ms = @latencyMs,
          updated_at = @updatedAt
      where id = @stepId
    `).run({
      stepId: input.stepId,
      errorCode: input.error.code,
      errorMessage: input.error.message,
      latencyMs: input.latencyMs ?? null,
      updatedAt: input.updatedAt
    });
  }

  function markRunFailed(input: {
    runId: string;
    endedAt: string;
  }) {
    db.prepare(`
      update runs
      set status = 'failed', ended_at = @endedAt
      where id = @runId
    `).run({
      runId: input.runId,
      endedAt: input.endedAt
    });
  }

  return {
    async runWorkflow(input: RunWorkflowInput): Promise<RunWorkflowResult> {
      if (input.steps.length === 0) {
        throw new ProviderError("invalid_workflow_step", "Workflow must include at least one step", { statusCode: 400 });
      }

      const startedAt = nowIso();
      const sessionId = input.sessionId ?? nanoid();
      const message = resolveInputMessage(input.input);

      if (!input.sessionId) {
        db.prepare(`
          insert into sessions (id, title, workflow_type, created_at, updated_at)
          values (@id, @title, @workflowType, @createdAt, @updatedAt)
        `).run({
          id: sessionId,
          title: message.slice(0, 60) || "New workflow",
          workflowType: input.workflowType,
          createdAt: startedAt,
          updatedAt: startedAt
        });
      }

      db.prepare(`
        insert into messages (id, session_id, role, content, created_at)
        values (@id, @sessionId, 'user', @content, @createdAt)
      `).run({
        id: nanoid(),
        sessionId,
        content: message,
        createdAt: startedAt
      });

      const runId = nanoid();
      db.prepare(`
        insert into runs (id, session_id, workflow_type, status, started_at)
        values (@id, @sessionId, @workflowType, 'running', @startedAt)
      `).run({
        id: runId,
        sessionId,
        workflowType: input.workflowType,
        startedAt
      });

      const outputs: Record<string, Record<string, unknown>> = {};
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCostEstimate = 0;
      let finalModelId: string | undefined;
      let finalContent = "";

      for (const [stepIndex, step] of input.steps.entries()) {
        if (step.type === "llm.chat") {
          const stepMessage = resolveStepMessage(step, input.input, outputs);
          const target = resolveLlmChatStepTarget(step);
          const stepId = insertRunningRunStep({
            runId,
            stepIndex,
            step,
            providerId: target.provider.id,
            modelId: target.model.id,
            inputPreview: stepMessage.slice(0, 200),
            startedAt
          });

          try {
            const stepResult = await runLlmChatStep(target, stepMessage);
            const stepEndedAt = nextIso(startedAt, stepIndex + 1);

            totalInputTokens += stepResult.inputTokens ?? 0;
            totalOutputTokens += stepResult.outputTokens ?? 0;
            totalCostEstimate += stepResult.costEstimate;
            finalModelId = stepResult.model.id;
            finalContent = stepResult.content;
            outputs[step.id] = { content: stepResult.content };

            markRunStepSucceeded({
              stepId,
              outputPreview: stepResult.content.slice(0, 200),
              latencyMs: stepResult.latencyMs,
              inputTokens: stepResult.inputTokens,
              outputTokens: stepResult.outputTokens,
              costEstimate: stepResult.costEstimate,
              updatedAt: stepEndedAt
            });
          } catch (error) {
            const failedAt = nextIso(startedAt, stepIndex + 1);

            if (error instanceof ProviderError) {
              markRunStepFailed({
                stepId,
                error,
                latencyMs: getErrorLatencyMs(error),
                updatedAt: failedAt
              });
              markRunFailed({ runId, endedAt: failedAt });
            }

            throw error;
          }

          continue;
        }

        if (step.type === "endpoint.call") {
          const resolvedInput = resolveStepInput(step.input, input.input, outputs);
          const target = resolveEndpointCallStepTarget(step);
          const stepId = insertRunningRunStep({
            runId,
            stepIndex,
            step,
            providerId: target.provider.id,
            endpointId: target.endpoint.id,
            inputPreview: stringifyPreview(resolvedInput).slice(0, 200),
            startedAt
          });

          try {
            const stepResult = await runEndpointCallStep(target, resolvedInput);
            const stepEndedAt = nextIso(startedAt, stepIndex + 1);
            const outputPreview = stringifyPreview(stepResult.bodyPreview);

            finalContent = outputPreview;
            outputs[step.id] = {
              body: stepResult.bodyPreview,
              statusCode: stepResult.statusCode
            };

            markRunStepSucceeded({
              stepId,
              outputPreview: outputPreview.slice(0, 200),
              latencyMs: stepResult.latencyMs,
              costEstimate: 0,
              updatedAt: stepEndedAt
            });
          } catch (error) {
            const failedAt = nextIso(startedAt, stepIndex + 1);

            if (error instanceof ProviderError) {
              markRunStepFailed({
                stepId,
                error,
                latencyMs: getErrorLatencyMs(error),
                updatedAt: failedAt
              });
              markRunFailed({ runId, endedAt: failedAt });
            }

            throw error;
          }

          continue;
        }

        throw new ProviderError("unsupported_workflow_step", `Unsupported workflow step type: ${(step as WorkflowStepDefinition).type}`, { statusCode: 400 });
      }

      const endedAt = nextIso(startedAt, input.steps.length + 1);
      db.prepare(`
        update runs
        set status = 'succeeded',
            ended_at = @endedAt,
            total_input_tokens = @totalInputTokens,
            total_output_tokens = @totalOutputTokens,
            total_cost_estimate = @totalCostEstimate
        where id = @id
      `).run({
        id: runId,
        endedAt,
        totalInputTokens,
        totalOutputTokens,
        totalCostEstimate
      });

      db.prepare(`
        insert into messages (id, session_id, role, content, model_id, run_id, created_at)
        values (@id, @sessionId, 'assistant', @content, @modelId, @runId, @createdAt)
      `).run({
        id: nanoid(),
        sessionId,
        content: finalContent,
        modelId: finalModelId ?? null,
        runId,
        createdAt: endedAt
      });

      db.prepare("update sessions set updated_at = @updatedAt where id = @id").run({
        id: sessionId,
        updatedAt: endedAt
      });

      return {
        session: mapSession(db.prepare("select * from sessions where id = @id").get<SessionRow>({ id: sessionId }) as SessionRow),
        run: mapRun(db.prepare("select * from runs where id = @id").get<RunRow>({ id: runId }) as RunRow),
        outputs
      };
    }
  };
}

interface SessionRow {
  id: string;
  title: string;
  workflow_type: SessionRecord["workflowType"];
  created_at: string;
  updated_at: string;
}

interface RunRow {
  id: string;
  session_id: string;
  workflow_type: RunRecord["workflowType"];
  status: RunRecord["status"];
  started_at: string;
  ended_at: string | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  total_cost_estimate: number | null;
}

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    title: row.title,
    workflowType: row.workflow_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRun(row: RunRow): RunRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    workflowType: row.workflow_type,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    totalInputTokens: row.total_input_tokens ?? undefined,
    totalOutputTokens: row.total_output_tokens ?? undefined,
    totalCostEstimate: row.total_cost_estimate ?? undefined
  };
}

function resolveInputMessage(input: Record<string, unknown>) {
  const message = input.message;
  return typeof message === "string" ? message : "";
}

function resolveStepMessage(
  step: WorkflowStepDefinition,
  workflowInput: Record<string, unknown>,
  outputs: Record<string, Record<string, unknown>>
) {
  const resolvedInput = resolveStepInput(step.input, workflowInput, outputs);
  const message = resolvedInput.message;

  return typeof message === "string" ? message : resolveInputMessage(workflowInput);
}

function resolveStepInput(
  input: Record<string, unknown>,
  workflowInput: Record<string, unknown>,
  outputs: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    resolved[key] = resolveInputValue(value, workflowInput, outputs);
  }

  return resolved;
}

function resolveInputValue(
  value: unknown,
  workflowInput: Record<string, unknown>,
  outputs: Record<string, Record<string, unknown>>
): unknown {
  if (typeof value === "string") {
    return resolvePlaceholders(value, workflowInput, outputs);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveInputValue(item, workflowInput, outputs));
  }

  if (isPlainRecord(value)) {
    return resolveStepInput(value, workflowInput, outputs);
  }

  return value;
}

function resolvePlaceholders(
  value: string,
  workflowInput: Record<string, unknown>,
  outputs: Record<string, Record<string, unknown>>
): string {
  const exactInputRef = value.match(/^\{\{input\.([A-Za-z0-9_]+)\}\}$/);
  if (exactInputRef) {
    return stringifyPlaceholderValue(workflowInput[exactInputRef[1]]);
  }

  const exactStepRef = value.match(/^\{\{steps\.([^.]+)\.outputs\.([^.}]+)\}\}$/);
  if (exactStepRef) {
    return stringifyPlaceholderValue(outputs[exactStepRef[1]]?.[exactStepRef[2]]);
  }

  return value.replace(/\{\{(input\.([A-Za-z0-9_]+)|steps\.([^.]+)\.outputs\.([^.}]+))\}\}/g, (
    _match,
    _expression,
    inputKey: string | undefined,
    stepId: string | undefined,
    outputKey: string | undefined
  ) => {
    if (inputKey) {
      return stringifyPlaceholderValue(workflowInput[inputKey]);
    }

    if (stepId && outputKey) {
      return stringifyPlaceholderValue(outputs[stepId]?.[outputKey]);
    }

    return "";
  });
}

function stringifyPlaceholderValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

function stringifyPreview(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function getErrorLatencyMs(error: ProviderError): number | undefined {
  const value = (error as ProviderError & { latencyMs?: unknown }).latencyMs;
  return typeof value === "number" ? value : undefined;
}

function estimateCost(inputTokens: number | undefined, outputTokens: number | undefined, pricing: Model["pricing"]) {
  const inputPrice = pricing.inputTokenPrice ?? 0;
  const outputPrice = pricing.outputTokenPrice ?? 0;
  return ((inputTokens ?? 0) / 1_000_000) * inputPrice + ((outputTokens ?? 0) / 1_000_000) * outputPrice;
}

function nowIso() {
  return new Date().toISOString();
}

function nextIso(base: string, milliseconds: number) {
  return new Date(Date.parse(base) + milliseconds).toISOString();
}
