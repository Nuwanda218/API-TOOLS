import type {
  CreateModelInput,
  CreateProviderInput,
  ModelRecord,
  ProviderRecord,
  RemoteModelRecord,
  RunWorkflowRequest,
  RunWorkflowResponse,
  TestModelResponse,
  UsageSummary
} from "./types";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json();
    if (typeof body?.message === "string") return body.message;
    if (typeof body?.error === "string") return body.error;
  } catch {
    // Response was not JSON; fall through to the status text.
  }

  return `Request failed: ${response.status}`;
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

  testModel(modelId: string) {
    return requestJson<TestModelResponse>(`/api/models/${modelId}/test`, { method: "POST" });
  },

  getUsageSummary() {
    return requestJson<UsageSummary>("/api/usage/summary");
  },

  runWorkflow(input: RunWorkflowRequest) {
    return requestJson<RunWorkflowResponse>("/api/workflows/run", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }
};

export type ApiClient = typeof apiClient;
