import type {
  ApiAdapter,
  ApiInvocation,
  ApiInvocationOutcome,
  LlmChatData
} from "../apiProtocol/types.js";
import { parseLlmChatInput } from "../apiProtocol/llmChat.js";
import { ProviderError } from "../errors/providerError.js";
import type { ModelAdapter } from "./types.js";

export function createModelApiBridge(id: string, modelAdapter: ModelAdapter): ApiAdapter {
  return {
    id,
    supports(operationId) {
      return operationId === "llm.chat";
    },
    async invoke(input: ApiInvocation): Promise<ApiInvocationOutcome<LlmChatData>> {
      if (input.operationId !== "llm.chat") {
        return {
          ok: false,
          code: "unsupported_operation",
          message: `Unsupported operation: ${input.operationId}`
        };
      }

      if (input.resource.kind !== "model") {
        return {
          ok: false,
          code: "invalid_api_resource",
          message: "llm.chat requires a model resource."
        };
      }

      const parsedInput = parseLlmChatInput(input.input);
      if (!parsedInput.ok) {
        return {
          ok: false,
          code: "invalid_workflow_step",
          message: parsedInput.message
        };
      }

      try {
        const result = await modelAdapter.runChat({
          provider: input.provider,
          model: input.resource.model,
          apiKey: input.apiKey,
          messages: parsedInput.input.messages
        });

        return {
          ok: true,
          data: { content: result.content },
          usage: { ...result.usage },
          latencyMs: result.latencyMs,
          raw: result.raw
        };
      } catch (error) {
        if (error instanceof ProviderError) {
          return {
            ok: false,
            code: error.code,
            message: error.message,
            providerMessage: error.providerMessage,
            statusCode: error.statusCode,
            suggestion: error.suggestion
          };
        }

        throw error;
      }
    }
  };
}
