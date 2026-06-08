import type { Model } from "../providers/modelRepository.js";
import type { Provider } from "../providers/providerRepository.js";
import type { ApiInvocation, ApiInvocationOutcome } from "../apiProtocol/types.js";

export type InternalOperation = "models.list" | "llm.chat";

export interface ApiInvocationContext {
  provider: Provider;
  apiKey: string;
}

export interface AdapterModelInput extends ApiInvocationContext {
  model: Model;
}

export type AdapterProviderInput = ApiInvocationContext;

export interface AdapterUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export interface RemoteModel {
  id: string;
  ownedBy?: string;
}

export interface ModelTestResult {
  ok: true;
  latencyMs: number;
  message: string;
  usage: AdapterUsage;
}

export interface ChatRunInput extends AdapterModelInput {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

export interface ChatRunResult {
  content: string;
  latencyMs: number;
  usage: AdapterUsage;
  raw?: unknown;
}

export interface ModelAdapter {
  listModels(input: AdapterProviderInput): Promise<RemoteModel[]>;
  testModel(input: AdapterModelInput): Promise<ModelTestResult>;
  runChat(input: ChatRunInput): Promise<ChatRunResult>;
}

export interface AdapterRegistry {
  getModelAdapter(provider: Provider): ModelAdapter;
  invoke(input: ApiInvocation): Promise<ApiInvocationOutcome>;
}
