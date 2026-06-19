import { ProviderError, type ProviderErrorCode } from "../errors/providerError.js";
import type {
  ChatRunInput,
  ChatRunResult,
  ModelAdapter,
  ModelTestResult
} from "./types.js";

interface AdapterDependencies {
  fetch?: typeof fetch;
}

interface ClaudeMessagesResponse {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

export function createClaudeMessagesAdapter(dependencies: AdapterDependencies = {}): ModelAdapter {
  const fetchImpl = dependencies.fetch ?? fetch;

  async function runChat(input: ChatRunInput): Promise<ChatRunResult> {
    if (input.model.capability !== "chat" && input.model.capability !== "multimodal") {
      throw new ProviderError("unsupported_capability", "Model does not support Claude Messages chat.");
    }

    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetchImpl(messagesEndpoint(input.provider.baseUrl), {
        method: "POST",
        headers: {
          "x-api-key": input.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify(buildMessagesBody(input))
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
      content: extractText(body),
      latencyMs: Date.now() - startedAt,
      usage: {
        inputTokens: body.usage?.input_tokens,
        outputTokens: body.usage?.output_tokens
      },
      raw: body
    };
  }

  return {
    async listModels() {
      return [];
    },
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

function buildMessagesBody(input: ChatRunInput) {
  const system = input.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const messages = input.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role,
      content: message.content
    }));

  return withoutUndefined({
    model: input.model.modelId,
    max_tokens: input.model.defaultParams.maxTokens ?? 1024,
    temperature: input.model.defaultParams.temperature,
    system: system || undefined,
    messages
  });
}

function messagesEndpoint(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/messages`;
}

function extractText(body: ClaudeMessagesResponse): string {
  for (const content of body.content ?? []) {
    if (content.type === "text" && typeof content.text === "string") return content.text;
  }

  return "";
}

function mapStatusToCode(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "invalid_api_key";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

async function parseJson(response: Response): Promise<ClaudeMessagesResponse> {
  try {
    return await response.json() as ClaudeMessagesResponse;
  } catch {
    return {};
  }
}
