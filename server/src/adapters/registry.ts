import { ProviderError } from "../errors/providerError.js";
import type { Provider } from "../providers/providerRepository.js";
import type { ApiAdapter } from "../apiProtocol/types.js";
import { createModelApiBridge } from "./modelApiBridge.js";
import { createClaudeMessagesAdapter } from "./claudeMessages.js";
import { createOpenAIChatCompletionsAdapter } from "./openaiChatCompletions.js";
import { createOpenAIResponsesAdapter } from "./openaiResponses.js";
import type { AdapterRegistry, ModelAdapter } from "./types.js";

export interface AdapterRegistryDependencies {
  chatCompletionsAdapter?: ModelAdapter;
  responsesAdapter?: ModelAdapter;
  claudeMessagesAdapter?: ModelAdapter;
}

export function createAdapterRegistry(dependencies: AdapterRegistryDependencies = {}): AdapterRegistry {
  const chatCompletionsAdapter = dependencies.chatCompletionsAdapter ?? createOpenAIChatCompletionsAdapter();
  const responsesAdapter = dependencies.responsesAdapter ?? createOpenAIResponsesAdapter();
  const claudeMessagesAdapter = dependencies.claudeMessagesAdapter ?? createClaudeMessagesAdapter();
  const chatCompletionsBridge = createModelApiBridge("openai-chat-completions", chatCompletionsAdapter);
  const responsesBridge = createModelApiBridge("openai-responses", responsesAdapter);
  const claudeMessagesBridge = createModelApiBridge("claude-messages", claudeMessagesAdapter);

  function selectModelAdapter(provider: Provider): ModelAdapter {
    if (provider.apiFormat === "openai-chat-completions") return chatCompletionsAdapter;
    if (provider.apiFormat === "openai-responses") return responsesAdapter;
    if (provider.apiFormat === "claude-messages") return claudeMessagesAdapter;

    throw unsupportedProviderFormat(provider);
  }

  function selectApiAdapter(provider: Provider): ApiAdapter {
    if (provider.apiFormat === "openai-chat-completions") return chatCompletionsBridge;
    if (provider.apiFormat === "openai-responses") return responsesBridge;
    if (provider.apiFormat === "claude-messages") return claudeMessagesBridge;

    throw unsupportedProviderFormat(provider);
  }

  return {
    getModelAdapter(provider: Provider): ModelAdapter {
      return selectModelAdapter(provider);
    },
    async invoke(input) {
      const adapter = selectApiAdapter(input.provider);

      if (!adapter.supports(input.operationId)) {
        return {
          ok: false,
          code: "unsupported_operation",
          message: `Unsupported operation: ${input.operationId}`
        };
      }

      return adapter.invoke(input);
    }
  };
}

function unsupportedProviderFormat(provider: Provider) {
  return new ProviderError("provider_error", `Unsupported provider API format: ${provider.apiFormat}`, {
    statusCode: 400,
    suggestion: "Choose a supported provider apiFormat."
  });
}
