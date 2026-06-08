export type ProviderType = "openai-compatible" | "openai-official";
export type ProviderApiFormat = "openai-chat-completions" | "openai-responses";
export type ModelCapability = "chat" | "image" | "multimodal";

export interface ProviderRecord {
  id: string;
  name: string;
  type: ProviderType;
  apiFormat: ProviderApiFormat;
  baseUrl: string;
  apiKeyEnv: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProviderInput {
  name: string;
  type: ProviderType;
  apiFormat: ProviderApiFormat;
  baseUrl: string;
  apiKeyEnv: string;
  enabled: boolean;
}

export interface RemoteModelRecord {
  id: string;
  ownedBy?: string;
}

export interface ModelRecord {
  id: string;
  providerId: string;
  displayName: string;
  modelId: string;
  capability: ModelCapability;
  enabled: boolean;
  defaultParams: Record<string, unknown>;
  pricing: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateModelInput {
  providerId: string;
  displayName: string;
  modelId: string;
  capability: ModelCapability;
  enabled: boolean;
  defaultParams: Record<string, unknown>;
  pricing: Record<string, unknown>;
}

export interface TestModelResponse {
  ok: boolean;
  latencyMs: number;
  message: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface UsageSummary {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  errorCount: number;
}

export type WorkflowStepType = "llm.chat";

export interface WorkflowStepDefinition {
  id: string;
  type: WorkflowStepType;
  modelId?: string;
  input: Record<string, unknown>;
}

export interface RunWorkflowRequest {
  sessionId?: string;
  workflowType: "api-workflow";
  input: Record<string, unknown>;
  steps: WorkflowStepDefinition[];
}

export interface RunWorkflowResponse {
  session: { id: string; title: string; workflowType: string };
  run: { id: string; status: "running" | "succeeded" | "failed" };
  outputs: Record<string, Record<string, unknown>>;
}
