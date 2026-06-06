import type { Model } from "../providers/modelRepository.js";
import type { Provider } from "../providers/providerRepository.js";
import type { ProviderErrorCode } from "../errors/providerError.js";

export type ApiOperationId =
  | "models.list"
  | "llm.chat"
  | "http.request"
  | (string & {});

export type ApiResource =
  | { kind: "model"; model: Model }
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

export interface LlmChatInput {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

export interface LlmChatData {
  content: string;
}

const coreOperations = new Set<ApiOperationId>(["models.list", "llm.chat", "http.request"]);

export function isCoreOperation(operationId: string): operationId is ApiOperationId {
  return coreOperations.has(operationId as ApiOperationId);
}
