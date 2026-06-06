import { ProviderError } from "../errors/providerError.js";
import type { Provider } from "../providers/providerRepository.js";
import { createOpenAIChatCompletionsAdapter } from "./openaiChatCompletions.js";
import { createOpenAIResponsesAdapter } from "./openaiResponses.js";
import type { AdapterRegistry, ModelAdapter } from "./types.js";

export interface AdapterRegistryDependencies {
  chatCompletionsAdapter?: ModelAdapter;
  responsesAdapter?: ModelAdapter;
}

export function createAdapterRegistry(dependencies: AdapterRegistryDependencies = {}): AdapterRegistry {
  const chatCompletionsAdapter = dependencies.chatCompletionsAdapter ?? createOpenAIChatCompletionsAdapter();
  const responsesAdapter = dependencies.responsesAdapter ?? createOpenAIResponsesAdapter();

  return {
    getModelAdapter(provider: Provider): ModelAdapter {
      if (provider.apiFormat === "openai-chat-completions") return chatCompletionsAdapter;
      if (provider.apiFormat === "openai-responses") return responsesAdapter;

      throw new ProviderError("provider_error", `Unsupported provider API format: ${provider.apiFormat}`, {
        statusCode: 400,
        suggestion: "Choose a supported provider apiFormat."
      });
    }
  };
}
