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

export type LlmChatInputParseResult =
  | { ok: true; input: LlmChatInput }
  | { ok: false; message: string };

const validRoles = new Set<LlmChatRole>(["system", "user", "assistant"]);

export function parseLlmChatInput(input: Record<string, unknown>): LlmChatInputParseResult {
  const messages = input.messages;

  if (!Array.isArray(messages)) {
    return { ok: false, message: "llm.chat requires input.messages." };
  }

  if (messages.length === 0) {
    return { ok: false, message: "llm.chat requires at least one message." };
  }

  const parsedMessages: LlmChatMessage[] = [];

  for (const [index, message] of messages.entries()) {
    if (!isRecord(message)) {
      return { ok: false, message: `llm.chat message at index ${index} must be an object.` };
    }

    if (!validRoles.has(message.role as LlmChatRole)) {
      return { ok: false, message: `llm.chat message at index ${index} has invalid role.` };
    }

    if (typeof message.content !== "string") {
      return { ok: false, message: `llm.chat message at index ${index} requires string content.` };
    }

    parsedMessages.push({
      role: message.role as LlmChatRole,
      content: message.content
    });
  }

  return { ok: true, input: { messages: parsedMessages } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
