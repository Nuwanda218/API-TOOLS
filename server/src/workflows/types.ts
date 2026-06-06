export type WorkflowType = "api-workflow" | "model-test";
export type WorkflowStepType = "llm.chat";

export interface WorkflowStepDefinition {
  id: string;
  type: WorkflowStepType;
  modelId?: string;
  input: Record<string, unknown>;
}

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
