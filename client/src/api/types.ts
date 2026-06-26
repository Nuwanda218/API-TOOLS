export type ProviderType = "openai-compatible" | "openai-official";
export type ProviderApiFormat = "openai-chat-completions" | "openai-responses" | "claude-messages";
export type ModelCapability = "chat" | "image" | "multimodal";

export interface ProviderRecord {
  id: string;
  name: string;
  type: ProviderType;
  apiFormat: ProviderApiFormat;
  baseUrl: string;
  apiKeyEnv: string;
  capabilities: ProviderCapabilities;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProviderCapabilities {
  supportsChat: boolean;
  supportsModelListing: boolean;
  supportsManualModelImport: boolean;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsVision: boolean;
  supportsRemoteConversation: boolean;
  requiresManualModelImport: boolean;
}

export interface CreateProviderInput {
  name: string;
  type: ProviderType;
  apiFormat: ProviderApiFormat;
  baseUrl: string;
  apiKeyEnv: string;
  capabilities?: Partial<ProviderCapabilities>;
  enabled: boolean;
}

export interface SaveApiKeyInput {
  apiKeyEnv: string;
  apiKey: string;
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

export type EndpointMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface EndpointRecord {
  id: string;
  providerId: string;
  name: string;
  operationId: string;
  method: EndpointMethod;
  path: string;
  queryTemplate: Record<string, unknown>;
  headersTemplate: Record<string, unknown>;
  bodyTemplate: unknown;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateEndpointInput {
  providerId: string;
  name: string;
  operationId: string;
  method: EndpointMethod;
  path: string;
  queryTemplate: Record<string, unknown>;
  headersTemplate: Record<string, unknown>;
  bodyTemplate?: unknown;
  enabled: boolean;
}

export interface TestEndpointResponse {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  bodyPreview: unknown;
  latencyMs: number;
}

export type McpTransport = "stdio";

export interface McpServerRecord {
  id: string;
  name: string;
  transport: McpTransport;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMcpServerInput {
  name: string;
  transport: McpTransport;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export interface McpToolRecord {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface ListMcpToolsResponse {
  ok: true;
  serverId: string;
  tools: McpToolRecord[];
}

export interface TestMcpServerResponse {
  ok: true;
  serverId: string;
  toolCount: number;
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

export interface TestModelInput {
  message?: string;
  params?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface UsageSummary {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  errorCount: number;
}

export interface RunStepRecord {
  id: string;
  runId: string;
  stepIndex: number;
  stepType: string;
  providerId: string;
  modelId: string;
  status: "running" | "succeeded" | "failed";
  inputPreview: string;
  outputPreview: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costEstimate: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunRecord {
  id: string;
  sessionId: string;
  sessionTitle: string;
  workflowType: string;
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  endedAt: string | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalCostEstimate: number | null;
  steps: RunStepRecord[];
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

export interface ExportedConfiguration {
  version: 1;
  providers: Array<Omit<ProviderRecord, "createdAt" | "updatedAt">>;
  models: Array<Omit<ModelRecord, "createdAt" | "updatedAt">>;
  endpoints: Array<Omit<EndpointRecord, "createdAt" | "updatedAt">>;
  missingApiKeyEnvs: string[];
}

export interface ImportConfigurationResponse {
  imported: {
    providers: number;
    models: number;
    endpoints: number;
  };
}
