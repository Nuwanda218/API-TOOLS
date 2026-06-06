# API Orchestration Phase 1 Protocol Solidification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solidify the Phase 1 API orchestration protocol by making operation contracts explicit, tightening `llm.chat` validation, and guaranteeing failed invocations create traceable `run_step` records.

**Architecture:** Keep the backend-first direction from `docs/superpowers/specs/2026-06-06-api-orchestration-framework-design.md`. Add a small operation catalog and operation-specific input validation under `server/src/apiProtocol/`, keep adapters focused on provider mapping, and refactor workflow execution only enough to satisfy the trace invariant: no invocation without a run step.

**Tech Stack:** TypeScript, Express, sql.js, Vitest, Supertest, Zod, npm workspaces.

---

## Scope check

This plan implements only Phase 1 from the new direction spec:

- Solidify protocol-level operation metadata.
- Keep `llm.chat` as the only workflow-executable operation.
- Keep `models.list` as a provider/model management operation.
- Keep `http.request` reserved but not executable.
- Tighten adapter bridge input validation.
- Guarantee failed adapter invocations are written to `run_steps` and `runs`.
- Add focused tests and documentation for these rules.

This plan does not implement:

- Frontend UI.
- `image.generate`.
- Executable `http.request`.
- Visual workflow builder.
- Multi-step dependency wiring beyond the current minimal sequential runner.
- New provider adapters.

## File structure

Create these files:

```text
server/src/apiProtocol/operationCatalog.ts
server/src/apiProtocol/operationCatalog.test.ts
server/src/apiProtocol/llmChat.ts
server/src/apiProtocol/llmChat.test.ts
docs/superpowers/specs/operations/2026-06-06-llm-chat-operation.md
docs/superpowers/specs/operations/2026-06-06-models-list-operation.md
docs/superpowers/specs/operations/2026-06-06-http-request-reserved-operation.md
```

Modify these files:

```text
server/src/apiProtocol/types.ts
server/src/apiProtocol/types.test.ts
server/src/adapters/modelApiBridge.ts
server/src/adapters/modelApiBridge.test.ts
server/src/workflows/runner.ts
server/src/workflows/runner.test.ts
```

Responsibilities:

- `server/src/apiProtocol/operationCatalog.ts`: authoritative catalog of core operation ids, resource requirements, workflow eligibility, and implementation status.
- `server/src/apiProtocol/llmChat.ts`: operation-specific `llm.chat` input/output types and runtime input parser.
- `server/src/apiProtocol/types.ts`: generic invocation/outcome/adapter types only; re-export operation ids and `llm.chat` types from focused files.
- `server/src/adapters/modelApiBridge.ts`: bridge model adapters into the generic protocol using validated `llm.chat` input.
- `server/src/workflows/runner.ts`: workflow execution and trace persistence; every attempted operation gets a `run_step`, including failures.
- `docs/superpowers/specs/operations/*`: short operation contract documents for current and reserved operations.

## Task 1: Add operation catalog

**Files:**
- Create: `server/src/apiProtocol/operationCatalog.ts`
- Create: `server/src/apiProtocol/operationCatalog.test.ts`
- Modify: `server/src/apiProtocol/types.ts`
- Modify: `server/src/apiProtocol/types.test.ts`

- [ ] **Step 1: Write failing operation catalog tests**

Create `server/src/apiProtocol/operationCatalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CORE_OPERATION_SPECS,
  getCoreOperationSpec,
  isCoreOperation,
  isWorkflowExecutableOperation
} from "./operationCatalog.js";

describe("operation catalog", () => {
  it("declares the Phase 1 core operations", () => {
    expect(Object.keys(CORE_OPERATION_SPECS).sort()).toEqual([
      "http.request",
      "llm.chat",
      "models.list"
    ]);
  });

  it("marks llm.chat as the only workflow-executable implemented operation", () => {
    expect(getCoreOperationSpec("llm.chat")).toMatchObject({
      id: "llm.chat",
      status: "implemented",
      resourceKind: "model",
      workflowStep: true
    });
    expect(isWorkflowExecutableOperation("llm.chat")).toBe(true);
    expect(isWorkflowExecutableOperation("models.list")).toBe(false);
    expect(isWorkflowExecutableOperation("http.request")).toBe(false);
  });

  it("keeps http.request reserved so it cannot accidentally execute", () => {
    expect(getCoreOperationSpec("http.request")).toMatchObject({
      id: "http.request",
      status: "reserved",
      resourceKind: "none",
      workflowStep: false
    });
  });

  it("recognizes core operation ids without accepting unknown ids", () => {
    expect(isCoreOperation("llm.chat")).toBe(true);
    expect(isCoreOperation("models.list")).toBe(true);
    expect(isCoreOperation("http.request")).toBe(true);
    expect(isCoreOperation("weather.current")).toBe(false);
    expect(getCoreOperationSpec("weather.current")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run operation catalog tests to verify they fail**

Run:

```bash
npm run test --workspace server -- src/apiProtocol/operationCatalog.test.ts
```

Expected: FAIL because `server/src/apiProtocol/operationCatalog.ts` does not exist.

- [ ] **Step 3: Implement operation catalog**

Create `server/src/apiProtocol/operationCatalog.ts`:

```ts
export type CoreOperationId = "models.list" | "llm.chat" | "http.request";
export type ApiOperationId = CoreOperationId | (string & {});
export type ApiResourceKind = "model" | "endpoint" | "none";
export type OperationImplementationStatus = "implemented" | "reserved";

export interface OperationSpec {
  id: CoreOperationId;
  description: string;
  resourceKind: ApiResourceKind;
  workflowStep: boolean;
  status: OperationImplementationStatus;
  inputContract: string;
  outputContract: string;
  usageContract: string;
}

export const CORE_OPERATION_SPECS: Record<CoreOperationId, OperationSpec> = {
  "models.list": {
    id: "models.list",
    description: "List remote models exposed by a provider.",
    resourceKind: "none",
    workflowStep: false,
    status: "implemented",
    inputContract: "Provider plus API key; no workflow resource required.",
    outputContract: "Array of provider-normalized remote model descriptors.",
    usageContract: "No token usage is expected."
  },
  "llm.chat": {
    id: "llm.chat",
    description: "Generate a chat response from a model resource.",
    resourceKind: "model",
    workflowStep: true,
    status: "implemented",
    inputContract: "messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>",
    outputContract: "{ content: string }",
    usageContract: "May include inputTokens and outputTokens."
  },
  "http.request": {
    id: "http.request",
    description: "Reserved operation for future generic HTTP execution.",
    resourceKind: "none",
    workflowStep: false,
    status: "reserved",
    inputContract: "Reserved. Future contract will define method, path, headers, and body.",
    outputContract: "Reserved. Future contract will define status, headers, and body.",
    usageContract: "Reserved."
  }
};

export function isCoreOperation(operationId: string): operationId is CoreOperationId {
  return Object.prototype.hasOwnProperty.call(CORE_OPERATION_SPECS, operationId);
}

export function getCoreOperationSpec(operationId: string): OperationSpec | undefined {
  return isCoreOperation(operationId) ? CORE_OPERATION_SPECS[operationId] : undefined;
}

export function isWorkflowExecutableOperation(operationId: string): boolean {
  const spec = getCoreOperationSpec(operationId);
  return spec?.status === "implemented" && spec.workflowStep;
}
```

- [ ] **Step 4: Update generic protocol types to use the catalog**

Modify `server/src/apiProtocol/types.ts` to this complete file:

```ts
import type { Model } from "../providers/modelRepository.js";
import type { Provider } from "../providers/providerRepository.js";
import type { ProviderErrorCode } from "../errors/providerError.js";
import type { ApiOperationId } from "./operationCatalog.js";

export type {
  ApiOperationId,
  ApiResourceKind,
  CoreOperationId,
  OperationImplementationStatus,
  OperationSpec
} from "./operationCatalog.js";
export {
  CORE_OPERATION_SPECS,
  getCoreOperationSpec,
  isCoreOperation,
  isWorkflowExecutableOperation
} from "./operationCatalog.js";
export type { LlmChatData, LlmChatInput, LlmChatMessage, LlmChatRole } from "./llmChat.js";

export type ApiResource =
  | { kind: "model"; model: Model }
  | { kind: "endpoint"; endpointId: string }
  | { kind: "none" };

export interface ApiInvocation<TInput = Record<string, unknown>> {
  operationId: ApiOperationId;
  provider: Provider;
  apiKey: string;
  resource: ApiResource;
  input: TInput;
  params?: Record<string, unknown>;
}

export interface ApiInvocationResult<TData = unknown> {
  ok: true;
  data: TData;
  usage?: Record<string, unknown>;
  latencyMs: number;
  raw?: unknown;
}

export interface ApiInvocationError {
  ok: false;
  code: ProviderErrorCode;
  message: string;
  providerMessage?: string;
  statusCode?: number;
  suggestion?: string;
  latencyMs?: number;
  raw?: unknown;
}

export type ApiInvocationOutcome<TData = unknown> =
  | ApiInvocationResult<TData>
  | ApiInvocationError;

export interface ApiAdapter {
  id: string;
  supports(operationId: ApiOperationId): boolean;
  invoke(input: ApiInvocation): Promise<ApiInvocationOutcome>;
}
```

- [ ] **Step 5: Update existing protocol type test**

Modify `server/src/apiProtocol/types.test.ts` to this complete file:

```ts
import { describe, expect, it } from "vitest";
import type { Model } from "../providers/modelRepository.js";
import type { Provider } from "../providers/providerRepository.js";
import type { ApiInvocation, ApiInvocationResult, LlmChatData, LlmChatInput } from "./types.js";
import { getCoreOperationSpec, isCoreOperation } from "./types.js";

const provider: Provider = {
  id: "provider-1",
  name: "Provider",
  type: "openai-compatible",
  apiFormat: "openai-chat-completions",
  baseUrl: "https://example.test/v1",
  apiKeyEnv: "CUSTOM_KEY",
  enabled: true,
  createdAt: "now",
  updatedAt: "now"
};

const model: Model = {
  id: "model-1",
  providerId: "provider-1",
  displayName: "Fast Chat",
  modelId: "fast-chat",
  capability: "chat",
  enabled: true,
  defaultParams: {},
  pricing: {},
  createdAt: "now",
  updatedAt: "now"
};

describe("generic API protocol types", () => {
  it("represents llm.chat as a provider-independent invocation", () => {
    const invocation: ApiInvocation<LlmChatInput> = {
      operationId: "llm.chat",
      provider,
      apiKey: "secret",
      resource: { kind: "model", model },
      input: {
        messages: [{ role: "user", content: "Hello" }]
      }
    };

    const result: ApiInvocationResult<LlmChatData> = {
      ok: true,
      data: { content: "Hi" },
      usage: { inputTokens: 1, outputTokens: 1 },
      latencyMs: 3
    };

    expect(invocation.operationId).toBe("llm.chat");
    expect(isCoreOperation(invocation.operationId)).toBe(true);
    expect(getCoreOperationSpec(invocation.operationId)?.resourceKind).toBe("model");
    expect(isCoreOperation("weather.current")).toBe(false);
    expect(invocation.resource.kind).toBe("model");
    expect(result.data.content).toBe("Hi");
  });
});
```

- [ ] **Step 6: Run protocol tests**

Run:

```bash
npm run test --workspace server -- src/apiProtocol/types.test.ts src/apiProtocol/operationCatalog.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run server typecheck**

Run:

```bash
npm run typecheck --workspace server
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/src/apiProtocol/operationCatalog.ts server/src/apiProtocol/operationCatalog.test.ts server/src/apiProtocol/types.ts server/src/apiProtocol/types.test.ts
git commit -m "feat: add api operation catalog"
```

## Task 2: Add `llm.chat` runtime input contract

**Files:**
- Create: `server/src/apiProtocol/llmChat.ts`
- Create: `server/src/apiProtocol/llmChat.test.ts`
- Modify: `server/src/apiProtocol/types.ts`

- [ ] **Step 1: Write failing `llm.chat` input parser tests**

Create `server/src/apiProtocol/llmChat.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseLlmChatInput } from "./llmChat.js";

describe("llm.chat input contract", () => {
  it("accepts valid chat messages", () => {
    const parsed = parseLlmChatInput({
      messages: [
        { role: "system", content: "Be brief." },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" }
      ]
    });

    expect(parsed).toEqual({
      ok: true,
      input: {
        messages: [
          { role: "system", content: "Be brief." },
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" }
        ]
      }
    });
  });

  it("rejects missing messages", () => {
    expect(parseLlmChatInput({})).toEqual({
      ok: false,
      message: "llm.chat requires input.messages."
    });
  });

  it("rejects empty messages", () => {
    expect(parseLlmChatInput({ messages: [] })).toEqual({
      ok: false,
      message: "llm.chat requires at least one message."
    });
  });

  it("rejects invalid roles", () => {
    expect(parseLlmChatInput({ messages: [{ role: "tool", content: "Hello" }] })).toEqual({
      ok: false,
      message: "llm.chat message at index 0 has invalid role."
    });
  });

  it("rejects non-string content", () => {
    expect(parseLlmChatInput({ messages: [{ role: "user", content: 42 }] })).toEqual({
      ok: false,
      message: "llm.chat message at index 0 requires string content."
    });
  });
});
```

- [ ] **Step 2: Run parser tests to verify they fail**

Run:

```bash
npm run test --workspace server -- src/apiProtocol/llmChat.test.ts
```

Expected: FAIL because `server/src/apiProtocol/llmChat.ts` does not exist.

- [ ] **Step 3: Implement `llm.chat` input parser**

Create `server/src/apiProtocol/llmChat.ts`:

```ts
export type LlmChatRole = "system" | "user" | "assistant";

export interface LlmChatMessage {
  role: LlmChatRole;
  content: string;
}

export interface LlmChatInput {
  messages: LlmChatMessage[];
}

export interface LlmChatData {
  content: string;
}

export type LlmChatInputParseResult =
  | { ok: true; input: LlmChatInput }
  | { ok: false; message: string };

const validRoles = new Set<LlmChatRole>(["system", "user", "assistant"]);

export function parseLlmChatInput(input: Record<string, unknown>): LlmChatInputParseResult {
  const messages = input.messages;

  if (!Array.isArray(messages)) {
    return { ok: false, message: "llm.chat requires input.messages." };
  }

  if (messages.length === 0) {
    return { ok: false, message: "llm.chat requires at least one message." };
  }

  const parsedMessages: LlmChatMessage[] = [];

  for (const [index, message] of messages.entries()) {
    if (!isRecord(message)) {
      return { ok: false, message: `llm.chat message at index ${index} must be an object.` };
    }

    if (!validRoles.has(message.role as LlmChatRole)) {
      return { ok: false, message: `llm.chat message at index ${index} has invalid role.` };
    }

    if (typeof message.content !== "string") {
      return { ok: false, message: `llm.chat message at index ${index} requires string content.` };
    }

    parsedMessages.push({
      role: message.role as LlmChatRole,
      content: message.content
    });
  }

  return { ok: true, input: { messages: parsedMessages } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
```

- [ ] **Step 4: Run parser tests**

Run:

```bash
npm run test --workspace server -- src/apiProtocol/llmChat.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run existing protocol tests**

Run:

```bash
npm run test --workspace server -- src/apiProtocol
```

Expected: PASS.

- [ ] **Step 6: Run server typecheck**

Run:

```bash
npm run typecheck --workspace server
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/apiProtocol/llmChat.ts server/src/apiProtocol/llmChat.test.ts server/src/apiProtocol/types.ts
git commit -m "feat: add llm chat operation contract"
```

## Task 3: Enforce validated `llm.chat` input in model API bridge

**Files:**
- Modify: `server/src/adapters/modelApiBridge.ts`
- Modify: `server/src/adapters/modelApiBridge.test.ts`

- [ ] **Step 1: Add failing bridge validation tests**

Append these tests inside the existing `describe("modelApiBridge", () => { ... })` block in `server/src/adapters/modelApiBridge.test.ts`:

```ts
  it("rejects llm.chat input with invalid message role before calling the model adapter", async () => {
    const modelAdapter: ModelAdapter = {
      listModels: vi.fn(async () => []),
      testModel: vi.fn(async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} })),
      runChat: vi.fn(async () => ({ content: "unused", latencyMs: 1, usage: {} }))
    };
    const bridge = createModelApiBridge("bridge", modelAdapter);

    const result = await bridge.invoke({
      operationId: "llm.chat",
      provider,
      apiKey: "secret",
      resource: { kind: "model", model },
      input: { messages: [{ role: "tool", content: "bad" }] }
    });

    expect(result).toEqual({
      ok: false,
      code: "invalid_workflow_step",
      message: "llm.chat message at index 0 has invalid role."
    });
    expect(modelAdapter.runChat).not.toHaveBeenCalled();
  });

  it("rejects llm.chat input with empty messages before calling the model adapter", async () => {
    const modelAdapter: ModelAdapter = {
      listModels: vi.fn(async () => []),
      testModel: vi.fn(async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} })),
      runChat: vi.fn(async () => ({ content: "unused", latencyMs: 1, usage: {} }))
    };
    const bridge = createModelApiBridge("bridge", modelAdapter);

    const result = await bridge.invoke({
      operationId: "llm.chat",
      provider,
      apiKey: "secret",
      resource: { kind: "model", model },
      input: { messages: [] }
    });

    expect(result).toEqual({
      ok: false,
      code: "invalid_workflow_step",
      message: "llm.chat requires at least one message."
    });
    expect(modelAdapter.runChat).not.toHaveBeenCalled();
  });
```

If `provider`, `model`, `ModelAdapter`, `vi`, or `createModelApiBridge` are not already imported or declared in the file, keep the existing file-level declarations and add only the missing imports from existing neighboring tests.

- [ ] **Step 2: Run bridge tests to verify they fail**

Run:

```bash
npm run test --workspace server -- src/adapters/modelApiBridge.test.ts
```

Expected: FAIL because `createModelApiBridge()` currently accepts any array as `messages` and casts it.

- [ ] **Step 3: Update model API bridge to use the parser**

Modify `server/src/adapters/modelApiBridge.ts` to this complete file:

```ts
import type {
  ApiAdapter,
  ApiInvocation,
  ApiInvocationOutcome,
  LlmChatData
} from "../apiProtocol/types.js";
import { parseLlmChatInput } from "../apiProtocol/llmChat.js";
import { ProviderError } from "../errors/providerError.js";
import type { ModelAdapter } from "./types.js";

export function createModelApiBridge(id: string, modelAdapter: ModelAdapter): ApiAdapter {
  return {
    id,
    supports(operationId) {
      return operationId === "llm.chat";
    },
    async invoke(input: ApiInvocation): Promise<ApiInvocationOutcome<LlmChatData>> {
      if (input.operationId !== "llm.chat") {
        return {
          ok: false,
          code: "unsupported_operation",
          message: `Unsupported operation: ${input.operationId}`
        };
      }

      if (input.resource.kind !== "model") {
        return {
          ok: false,
          code: "invalid_api_resource",
          message: "llm.chat requires a model resource."
        };
      }

      const parsedInput = parseLlmChatInput(input.input);
      if (!parsedInput.ok) {
        return {
          ok: false,
          code: "invalid_workflow_step",
          message: parsedInput.message
        };
      }

      try {
        const result = await modelAdapter.runChat({
          provider: input.provider,
          model: input.resource.model,
          apiKey: input.apiKey,
          messages: parsedInput.input.messages
        });

        return {
          ok: true,
          data: { content: result.content },
          usage: { ...result.usage },
          latencyMs: result.latencyMs,
          raw: result.raw
        };
      } catch (error) {
        if (error instanceof ProviderError) {
          return {
            ok: false,
            code: error.code,
            message: error.message,
            providerMessage: error.providerMessage,
            statusCode: error.statusCode,
            suggestion: error.suggestion
          };
        }

        throw error;
      }
    }
  };
}
```

- [ ] **Step 4: Run bridge tests**

Run:

```bash
npm run test --workspace server -- src/adapters/modelApiBridge.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all adapter and protocol tests**

Run:

```bash
npm run test --workspace server -- src/apiProtocol src/adapters
```

Expected: PASS.

- [ ] **Step 6: Run server typecheck**

Run:

```bash
npm run typecheck --workspace server
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/adapters/modelApiBridge.ts server/src/adapters/modelApiBridge.test.ts
git commit -m "fix: validate llm chat bridge input"
```

## Task 4: Record failed workflow invocations in `run_steps`

**Files:**
- Modify: `server/src/workflows/runner.ts`
- Modify: `server/src/workflows/runner.test.ts`

- [ ] **Step 1: Write failing runner test for failed adapter invocation trace**

Append this test inside the existing `describe("workflowRunner", () => { ... })` block in `server/src/workflows/runner.test.ts`:

```ts
  it("records failed run and run_step when adapter invocation fails", async () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);
    const provider = providers.create({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_KEY",
      enabled: true
    });
    const model = models.create({
      providerId: provider.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: {}
    });
    const adapterRegistry: AdapterRegistry = {
      getModelAdapter: vi.fn(() => ({
        listModels: async () => [],
        testModel: async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} }),
        runChat: async () => ({ content: "unused", latencyMs: 1, usage: {} })
      })),
      invoke: vi.fn(async () => ({
        ok: false as const,
        code: "rate_limited",
        message: "Provider request failed",
        providerMessage: "Too many requests",
        statusCode: 429,
        suggestion: "Retry later",
        latencyMs: 15
      }))
    };
    const runner = createWorkflowRunner(db, {
      adapterRegistry,
      env: { CUSTOM_KEY: "secret" }
    });

    await expect(runner.runWorkflow({
      workflowType: "api-workflow",
      input: { message: "Hello" },
      steps: [
        {
          id: "main-response",
          type: "llm.chat",
          modelId: model.id,
          input: { message: "{{input.message}}" }
        }
      ]
    })).rejects.toMatchObject({
      code: "rate_limited",
      message: "Provider request failed",
      providerMessage: "Too many requests",
      statusCode: 429,
      suggestion: "Retry later"
    });

    const runs = db.prepare("select * from runs").all<{
      status: string;
      total_input_tokens: number | null;
      total_output_tokens: number | null;
      total_cost_estimate: number | null;
    }>();
    expect(runs).toEqual([
      expect.objectContaining({
        status: "failed",
        total_input_tokens: null,
        total_output_tokens: null,
        total_cost_estimate: null
      })
    ]);

    const runSteps = db.prepare("select * from run_steps").all<{
      step_type: string;
      provider_id: string;
      model_id: string;
      status: string;
      input_preview: string;
      output_preview: string | null;
      error_code: string | null;
      error_message: string | null;
      latency_ms: number | null;
    }>();
    expect(runSteps).toEqual([
      expect.objectContaining({
        step_type: "llm.chat",
        provider_id: provider.id,
        model_id: model.id,
        status: "failed",
        input_preview: "Hello",
        output_preview: null,
        error_code: "rate_limited",
        error_message: "Provider request failed",
        latency_ms: 15
      })
    ]);

    const messages = db.prepare("select role, content from messages order by created_at asc").all<{
      role: string;
      content: string;
    }>();
    expect(messages).toEqual([{ role: "user", content: "Hello" }]);

    db.close();
  });
```

- [ ] **Step 2: Run runner test to verify it fails**

Run:

```bash
npm run test --workspace server -- src/workflows/runner.test.ts
```

Expected: FAIL because failed adapter invocations currently throw before a `run_step` is written.

- [ ] **Step 3: Add helper interfaces and functions to runner**

In `server/src/workflows/runner.ts`, add these interfaces near the existing `LlmChatStepResult` interface:

```ts
interface ResolvedLlmChatStepTarget {
  provider: Provider;
  model: Model;
  apiKey: string;
}

interface RunningRunStepInput {
  runId: string;
  stepIndex: number;
  step: WorkflowStepDefinition;
  providerId: string;
  modelId: string;
  inputPreview: string;
  startedAt: string;
}
```

Inside `createWorkflowRunner()`, before `runLlmChatStep()`, add this helper:

```ts
  function resolveLlmChatStepTarget(step: WorkflowStepDefinition): ResolvedLlmChatStepTarget {
    if (!step.modelId) {
      throw new ProviderError("invalid_workflow_step", "llm.chat step requires modelId", { statusCode: 400 });
    }

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
```

Inside `createWorkflowRunner()`, add these persistence helpers before the returned object:

```ts
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
      providerId: input.providerId,
      modelId: input.modelId,
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
```

- [ ] **Step 4: Refactor `runLlmChatStep()` to use resolved target**

Replace the existing `runLlmChatStep()` function in `server/src/workflows/runner.ts` with this version:

```ts
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
```

- [ ] **Step 5: Refactor the workflow loop to insert running step before invoking adapter**

In `server/src/workflows/runner.ts`, replace the body of the `for (const [stepIndex, step] of input.steps.entries()) { ... }` loop with this body:

```ts
        if (step.type !== "llm.chat") {
          throw new ProviderError("unsupported_workflow_step", `Unsupported workflow step type: ${step.type}`, { statusCode: 400 });
        }

        const stepMessage = resolveStepMessage(step, input.input);
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
```

Add this helper near the existing `asNumber()` function:

```ts
function getErrorLatencyMs(error: ProviderError): number | undefined {
  const value = (error as ProviderError & { latencyMs?: unknown }).latencyMs;
  return typeof value === "number" ? value : undefined;
}
```

- [ ] **Step 6: Remove old inline successful `run_steps` insert**

In `server/src/workflows/runner.ts`, delete the old inline block inside the workflow loop that starts with:

```ts
        const stepId = nanoid();
        db.prepare(`
          insert into run_steps (
```

and ends after its `.run({ ... })` call. The new `insertRunningRunStep()` plus `markRunStepSucceeded()` calls replace it.

- [ ] **Step 7: Run runner tests**

Run:

```bash
npm run test --workspace server -- src/workflows/runner.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run workflow route tests**

Run:

```bash
npm run test --workspace server -- src/routes/workflows.test.ts src/routes/usage.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run server typecheck**

Run:

```bash
npm run typecheck --workspace server
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add server/src/workflows/runner.ts server/src/workflows/runner.test.ts
git commit -m "fix: record failed workflow run steps"
```

## Task 5: Document current and reserved operation contracts

**Files:**
- Create: `docs/superpowers/specs/operations/2026-06-06-llm-chat-operation.md`
- Create: `docs/superpowers/specs/operations/2026-06-06-models-list-operation.md`
- Create: `docs/superpowers/specs/operations/2026-06-06-http-request-reserved-operation.md`

- [ ] **Step 1: Create operation docs directory and `llm.chat` contract doc**

Create `docs/superpowers/specs/operations/2026-06-06-llm-chat-operation.md`:

```md
# llm.chat Operation Contract

## Status

Implemented and workflow-executable in Phase 1.

## Purpose

`llm.chat` asks a model resource to generate a chat response from normalized chat messages.

Workflow steps use this internal operation id instead of provider-specific endpoints such as `/chat/completions` or `/responses`.

## Resource requirement

```text
resource.kind = "model"
```

The referenced model must have capability `chat` or `multimodal`.

## Input contract

```ts
interface LlmChatInput {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
}
```

Rules:

- `messages` is required.
- `messages` must contain at least one message.
- `role` must be `system`, `user`, or `assistant`.
- `content` must be a string.
- Provider-specific request fields do not belong in this contract.

## Output contract

```ts
interface LlmChatData {
  content: string;
}
```

## Usage contract

Adapters may return:

```ts
{
  inputTokens?: number;
  outputTokens?: number;
}
```

If the provider does not return usage, the fields remain absent.

## Error expectations

The adapter or bridge may return:

- `invalid_api_resource`
- `invalid_workflow_step`
- `missing_api_key`
- `invalid_api_key`
- `invalid_base_url`
- `model_not_found`
- `rate_limited`
- `quota_exceeded`
- `provider_error`
- `network_error`

The workflow runner must record a failed `run_step` for provider invocation failures.

## Trace requirements

Every `llm.chat` invocation must write one `run_step` with:

- `step_type = "llm.chat"`
- `provider_id`
- `model_id`
- `status`
- `input_preview`
- `output_preview` on success
- `error_code` and `error_message` on failure
- `latency_ms` when available
- token usage when available
```

- [ ] **Step 2: Create `models.list` contract doc**

Create `docs/superpowers/specs/operations/2026-06-06-models-list-operation.md`:

```md
# models.list Operation Contract

## Status

Implemented for provider/model management. Not workflow-executable in Phase 1.

## Purpose

`models.list` asks a provider adapter to list remote models available from the provider.

It supports the API接入 / model import workflow, but it is not a user workflow step yet.

## Resource requirement

```text
resource.kind = "none"
```

The operation uses provider connection settings and API key only.

## Input contract

No workflow input is required.

Runtime invocation requires:

- provider
- API key resolved from `provider.apiKeyEnv`

## Output contract

```ts
interface RemoteModel {
  id: string;
  ownedBy?: string;
}
```

The route may wrap this as:

```ts
{
  ok: true;
  providerId: string;
  models: RemoteModel[];
}
```

## Usage contract

No token usage is expected.

## Error expectations

The adapter may return or throw standardized provider errors including:

- `missing_api_key`
- `invalid_api_key`
- `invalid_base_url`
- `rate_limited`
- `provider_error`
- `network_error`

## Workflow rule

`models.list` must not be accepted as a workflow step in Phase 1. If a workflow tries to execute it, the runner or route must reject it with `unsupported_workflow_step` or validation failure.
```

- [ ] **Step 3: Create reserved `http.request` contract doc**

Create `docs/superpowers/specs/operations/2026-06-06-http-request-reserved-operation.md`:

```md
# http.request Reserved Operation Contract

## Status

Reserved. Not implemented and not workflow-executable in Phase 1.

## Purpose

`http.request` is reserved for future generic HTTP API execution.

It exists in the operation catalog to prevent ad-hoc endpoint-specific behavior from being introduced under another name before the contract is designed.

## Phase 1 rule

Any attempt to execute `http.request` must be rejected.

## Future input sketch

The future contract may include:

```ts
interface HttpRequestInput {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}
```

This sketch is not an implementation contract.

## Future output sketch

The future contract may include:

```ts
interface HttpRequestData {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}
```

This sketch is not an implementation contract.

## Design constraints before implementation

Before implementing this operation, a later spec or plan must decide:

- How endpoint paths are configured without leaking provider-specific details into workflow definitions.
- Whether the adapter is dedicated or config-driven.
- Which headers are allowed.
- How request and response bodies are size-limited.
- How secrets are prevented from entering trace previews.
- How errors are mapped to the standard provider error model.
```

- [ ] **Step 4: Verify operation docs contain no placeholders**

Run:

```bash
rg -n -e "TB[D]" -e "TO[D]O" -e "PLACEHOLD[ER]" -e "待[定]" -e "未[定]" docs/superpowers/specs/operations
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/operations/2026-06-06-llm-chat-operation.md docs/superpowers/specs/operations/2026-06-06-models-list-operation.md docs/superpowers/specs/operations/2026-06-06-http-request-reserved-operation.md
git commit -m "docs: add api operation contracts"
```

## Task 6: Final verification for Phase 1 protocol solidification

**Files:**
- No new files unless verification reveals a necessary fix.

- [ ] **Step 1: Run backend tests**

Run:

```bash
npm run test --workspace server
```

Expected: all server tests pass.

- [ ] **Step 2: Run backend typecheck**

Run:

```bash
npm run typecheck --workspace server
```

Expected: PASS.

- [ ] **Step 3: Run backend build**

Run:

```bash
npm run build --workspace server
```

Expected: PASS.

- [ ] **Step 4: Confirm workspace-level typecheck still fails only because client source is absent**

Run:

```bash
npm run typecheck
```

Expected: server typecheck passes, then client typecheck fails with TS18003 because `client/src`, `client/vite.config.ts`, and `client/vitest.config.ts` are not implemented yet.

If it fails for a different reason, fix that reason before continuing.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: clean working tree.

- [ ] **Step 6: Commit any verification fixes**

If verification required fixes, stage only relevant files and commit:

```bash
git add <fixed-files>
git commit -m "fix: complete protocol solidification verification"
```

Expected: no commit is created if no fixes were needed.

## Plan self-review

### Spec coverage

This plan maps to the Phase 1 requirements in `docs/superpowers/specs/2026-06-06-api-orchestration-framework-design.md`:

- Operation contract stability: Tasks 1, 2, and 5.
- Adapter contract stability: Task 3.
- Workflow step/run trace stability: Task 4.
- Error model stability: Tasks 3 and 4.
- Testing strategy: Tasks 1 through 4 and Task 6.
- No frontend scope: explicitly excluded in the scope check.
- No `image.generate` or executable `http.request`: `http.request` is reserved and documented only.

### Placeholder scan

The plan contains no unresolved placeholder text. The only generic command is `<fixed-files>` in the final verification contingency step, where the exact file list depends on whether verification reveals a fix.

### Type consistency

The plan consistently uses:

- `CoreOperationId` for built-in operation ids.
- `ApiOperationId` for built-in or future extension ids.
- `ApiResourceKind` for `model`, `endpoint`, and `none`.
- `LlmChatInput`, `LlmChatMessage`, `LlmChatData` for the `llm.chat` contract.
- `ApiInvocationOutcome` for adapter results.
- `ProviderError` for runner-level thrown errors.
- `run_steps.step_type = "llm.chat"` for workflow trace rows.
