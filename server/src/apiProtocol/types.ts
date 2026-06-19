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
