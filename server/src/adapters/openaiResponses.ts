import { ProviderError, type ProviderErrorCode } from "../errors/providerError.js";
import type {
  ChatRunInput,
  ChatRunResult,
  ModelAdapter,
  ModelTestResult
} from "./types.js";
import { createOpenAIChatCompletionsAdapter } from "./openaiChatCompletions.js";

interface AdapterDependencies {
  fetch?: typeof fetch;
}

interface OpenAIResponsesResponse {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

export function createOpenAIResponsesAdapter(dependencies: AdapterDependencies = {}): ModelAdapter {
  const fetchImpl = dependencies.fetch ?? fetch;

  async function runChat(input: ChatRunInput): Promise<ChatRunResult> {
    if (input.model.capability !== "chat" && input.model.capability !== "multimodal") {
      throw new ProviderError("unsupported_capability", "Model does not support Responses API chat.");
    }

    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetchImpl(responsesEndpoint(input.provider.baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(buildResponsesBody(input))
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
      content: extractResponsesText(body),
      latencyMs: Date.now() - startedAt,
      usage: {
        inputTokens: body.usage?.input_tokens,
        outputTokens: body.usage?.output_tokens
      },
      raw: body
    };
  }

  const modelListAdapter = createOpenAIChatCompletionsAdapter(dependencies);

  return {
    listModels: modelListAdapter.listModels,
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

function buildResponsesBody(input: ChatRunInput) {
  return withoutUndefined({
    model: input.model.modelId,
    input: input.messages,
    temperature: input.model.defaultParams.temperature,
    max_output_tokens: input.model.defaultParams.maxTokens
  });
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function responsesEndpoint(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/responses`;
}

function extractResponsesText(body: OpenAIResponsesResponse): string {
  if (typeof body.output_text === "string") return body.output_text;

  for (const output of body.output ?? []) {
    for (const content of output.content ?? []) {
      if (typeof content.text === "string") return content.text;
    }
  }

  return "";
}

function mapStatusToCode(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "invalid_api_key";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

async function parseJson(response: Response): Promise<OpenAIResponsesResponse> {
  try {
    return await response.json() as OpenAIResponsesResponse;
  } catch {
    return {};
  }
}
