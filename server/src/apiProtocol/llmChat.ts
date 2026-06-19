export type LlmChatRole = "system" | "user" | "assistant";

export interface LlmChatMessage {
  role: LlmChatRole;
  content: string;
}

export interface LlmChatInput {
  messages: LlmChatMessage[];
}

export interface LlmChatData {
  content: string;
}
