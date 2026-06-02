import type { Model } from "../providers/modelRepository.js";
import type { Provider } from "../providers/providerRepository.js";

export interface AdapterModelInput {
  provider: Provider;
  model: Model;
  apiKey: string;
}

export interface AdapterUsage {
  inputTokens?: number;
  outputTokens?: number;
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
}

export interface ModelAdapter {
  testModel(input: AdapterModelInput): Promise<ModelTestResult>;
  runChat(input: ChatRunInput): Promise<ChatRunResult>;
}
