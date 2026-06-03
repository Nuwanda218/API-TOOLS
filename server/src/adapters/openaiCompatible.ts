import { ProviderError, type ProviderErrorCode } from "../errors/providerError.js";
import type {
  AdapterProviderInput,
  ChatRunInput,
  ChatRunResult,
  ModelAdapter,
  ModelTestResult,
  RemoteModel
} from "./types.js";

interface AdapterDependencies {
  fetch?: typeof fetch;
}

interface OpenAICompatibleResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

interface OpenAICompatibleModelsResponse {
  data?: Array<{
    id?: string;
    owned_by?: string;
  }>;
  error?: {
    message?: string;
  };
}

export function createOpenAICompatibleAdapter(dependencies: AdapterDependencies = {}): ModelAdapter {
  const fetchImpl = dependencies.fetch ?? fetch;

  async function listModels(input: AdapterProviderInput): Promise<RemoteModel[]> {
    let response: Response;

    try {
      response = await fetchImpl(modelsEndpoint(input.provider.baseUrl), {
        method: "GET",
        headers: {
          authorization: `Bearer ${input.apiKey}`
        }
      });
    } catch (error) {
      throw new ProviderError("network_error", "Could not reach provider API", {
        providerMessage: error instanceof Error ? error.message : String(error),
        suggestion: "Check the provider base URL and your network connection."
      });
    }

    const body = await parseModelsJson(response);

    if (!response.ok) {
      const providerMessage = body.error?.message ?? `HTTP ${response.status}`;
      throw new ProviderError(mapStatusToCode(response.status), "Provider request failed", {
        providerMessage,
        statusCode: response.status
      });
    }

    return (body.data ?? [])
      .filter((model): model is { id: string; owned_by?: string } => typeof model.id === "string")
      .map((model) => ({
        id: model.id,
        ownedBy: model.owned_by
      }));
  }

  async function runChat(input: ChatRunInput): Promise<ChatRunResult> {
    if (input.model.capability !== "chat" && input.model.capability !== "multimodal") {
      throw new ProviderError("unsupported_capability", "Model does not support chat completions.");
    }

    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetchImpl(chatCompletionsEndpoint(input.provider.baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: input.model.modelId,
          messages: input.messages,
          temperature: input.model.defaultParams.temperature ?? 0.7,
          max_tokens: input.model.defaultParams.maxTokens
        })
      });
    } catch (error) {
      throw new ProviderError("network_error", "Could not reach provider API", {
        providerMessage: error instanceof Error ? error.message : String(error),
        suggestion: "Check the provider base URL and your network connection."
      });
    }

    const body = await parseJson(response);

    if (!response.ok) {
      const providerMessage = body.error?.message ?? `HTTP ${response.status}`;
      throw new ProviderError(mapStatusToCode(response.status), "Provider request failed", {
        providerMessage,
        statusCode: response.status
      });
    }

    return {
      content: body.choices?.[0]?.message?.content ?? "",
      latencyMs: Date.now() - startedAt,
      usage: {
        inputTokens: body.usage?.prompt_tokens,
        outputTokens: body.usage?.completion_tokens
      }
    };
  }

  return {
    listModels,
    async testModel(input): Promise<ModelTestResult> {
      const result = await runChat({
        ...input,
        messages: [{ role: "user", content: "Reply with ok." }]
      });

      return {
        ok: true,
        latencyMs: result.latencyMs,
        message: result.content,
        usage: result.usage
      };
    },
    runChat
  };
}

function chatCompletionsEndpoint(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function modelsEndpoint(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/models`;
}

function mapStatusToCode(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "invalid_api_key";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

async function parseJson(response: Response): Promise<OpenAICompatibleResponse> {
  try {
    return await response.json() as OpenAICompatibleResponse;
  } catch {
    return {};
  }
}

async function parseModelsJson(response: Response): Promise<OpenAICompatibleModelsResponse> {
  try {
    return await response.json() as OpenAICompatibleModelsResponse;
  } catch {
    return {};
  }
}
