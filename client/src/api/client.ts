import type {
  CreateModelInput,
  CreateEndpointInput,
  CreateProviderInput,
  EndpointRecord,
  ModelRecord,
  ProviderRecord,
  RemoteModelRecord,
  RunWorkflowRequest,
  RunWorkflowResponse,
  RunRecord,
  SaveApiKeyInput,
  TestEndpointResponse,
  TestModelInput,
  TestModelResponse,
  UsageSummary
} from "./types";

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly providerMessage?: string;
  public readonly statusCode: number;
  public readonly log: string;

  constructor(input: { code: string; message: string; providerMessage?: string; statusCode: number }) {
    super(input.message);
    this.name = "ApiClientError";
    this.code = input.code;
    this.providerMessage = input.providerMessage;
    this.statusCode = input.statusCode;
    this.log = [input.code, input.message].filter(Boolean).join(": ");
    if (input.providerMessage) {
      this.log = `${this.log} | ${input.providerMessage}`;
    }
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    throw await readApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function readApiError(response: Response) {
  try {
    const body = await response.json();
    const code = typeof body?.code === "string" ? body.code : typeof body?.error === "string" ? body.error : "request_failed";
    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof body?.error === "string"
          ? body.error
          : `Request failed: ${response.status}`;
    const providerMessage = typeof body?.providerMessage === "string" ? body.providerMessage : undefined;
    const statusCode = typeof body?.statusCode === "number" ? body.statusCode : response.status;
    return new ApiClientError({ code, message, providerMessage, statusCode });
  } catch {
    return new ApiClientError({
      code: "request_failed",
      message: response.statusText || `Request failed: ${response.status}`,
      statusCode: response.status
    });
  }
}

export const apiClient = {
  listProviders() {
    return requestJson<ProviderRecord[]>("/api/providers");
  },

  createProvider(input: CreateProviderInput) {
    return requestJson<ProviderRecord>("/api/providers", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  saveApiKey(input: SaveApiKeyInput) {
    return requestJson<void>("/api/api-keys", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  deleteProvider(providerId: string) {
    return requestJson<void>(`/api/providers/${providerId}`, { method: "DELETE" });
  },

  listEndpoints(providerId?: string) {
    const search = providerId ? `?providerId=${encodeURIComponent(providerId)}` : "";
    return requestJson<EndpointRecord[]>(`/api/endpoints${search}`);
  },

  createEndpoint(input: CreateEndpointInput) {
    return requestJson<EndpointRecord>("/api/endpoints", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  updateEndpoint(endpointId: string, input: Partial<CreateEndpointInput>) {
    return requestJson<EndpointRecord>(`/api/endpoints/${endpointId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  },

  deleteEndpoint(endpointId: string) {
    return requestJson<void>(`/api/endpoints/${endpointId}`, { method: "DELETE" });
  },

  testEndpoint(endpointId: string, input: Record<string, unknown>) {
    return requestJson<TestEndpointResponse>(`/api/endpoints/${endpointId}/test`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  listRemoteModels(providerId: string) {
    return requestJson<{ ok: true; providerId: string; models: RemoteModelRecord[] }>(
      `/api/providers/${providerId}/remote-models`
    );
  },

  importModels(providerId: string, models: CreateModelInput[]) {
    return requestJson<{ created: ModelRecord[]; skipped: Array<{ modelId: string; reason: string }> }>(
      `/api/providers/${providerId}/import-models`,
      {
        method: "POST",
        body: JSON.stringify({
          models: models.map(({ providerId: _providerId, ...model }) => model)
        })
      }
    );
  },

  listModels(providerId?: string) {
    const search = providerId ? `?providerId=${encodeURIComponent(providerId)}` : "";
    return requestJson<ModelRecord[]>(`/api/models${search}`);
  },

  createModel(input: CreateModelInput) {
    return requestJson<ModelRecord>("/api/models", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },

  deleteModel(modelId: string) {
    return requestJson<void>(`/api/models/${modelId}`, { method: "DELETE" });
  },

  testModel(modelId: string, input?: TestModelInput) {
    return requestJson<TestModelResponse>(`/api/models/${modelId}/test`, {
      method: "POST",
      body: JSON.stringify(input ?? {})
    });
  },

  getUsageSummary() {
    return requestJson<UsageSummary>("/api/usage/summary");
  },

  listRuns() {
    return requestJson<RunRecord[]>("/api/runs");
  },

  getRun(runId: string) {
    return requestJson<RunRecord>(`/api/runs/${runId}`);
  },

  runWorkflow(input: RunWorkflowRequest) {
    return requestJson<RunWorkflowResponse>("/api/workflows/run", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }
};

export type ApiClient = typeof apiClient;
