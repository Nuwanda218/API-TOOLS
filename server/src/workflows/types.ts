export type WorkflowType = "api-workflow" | "model-test";
export type WorkflowStepType = "llm.chat" | "endpoint.call";

export interface LlmChatStepDefinition {
  id: string;
  type: "llm.chat";
  modelId: string;
  input: Record<string, unknown>;
}

export interface EndpointCallStepDefinition {
  id: string;
  type: "endpoint.call";
  endpointId: string;
  input: Record<string, unknown>;
}

export type WorkflowStepDefinition = LlmChatStepDefinition | EndpointCallStepDefinition;

export interface RunWorkflowInput {
  sessionId?: string;
  workflowType: WorkflowType;
  input: Record<string, unknown>;
  steps: WorkflowStepDefinition[];
}

export interface SessionRecord {
  id: string;
  title: string;
  workflowType: WorkflowType;
  createdAt: string;
  updatedAt: string;
}

export interface RunRecord {
  id: string;
  sessionId: string;
  workflowType: WorkflowType;
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  endedAt?: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCostEstimate?: number;
}

export interface RunWorkflowResult {
  session: SessionRecord;
  run: RunRecord;
  outputs: Record<string, Record<string, unknown>>;
}
