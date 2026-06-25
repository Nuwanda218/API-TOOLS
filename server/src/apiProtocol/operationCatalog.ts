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
    description: "Send a normalized HTTP request through an endpoint resource.",
    resourceKind: "endpoint",
    workflowStep: true,
    status: "implemented",
    inputContract: "method, path, optional query, headers, body, timeoutMs.",
    outputContract: "Endpoint test result with status, headers, body preview, latency, and error details.",
    usageContract: "No token usage is expected."
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
