import { describe, expect, it } from "vitest";
import { parseLlmChatInput } from "./llmChat.js";

describe("llm.chat input contract", () => {
  it("accepts valid chat messages", () => {
    const parsed = parseLlmChatInput({
      messages: [
        { role: "system", content: "Be brief." },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" }
      ]
    });

    expect(parsed).toEqual({
      ok: true,
      input: {
        messages: [
          { role: "system", content: "Be brief." },
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi" }
        ]
      }
    });
  });

  it("rejects missing messages", () => {
    expect(parseLlmChatInput({})).toEqual({
      ok: false,
      message: "llm.chat requires input.messages."
    });
  });

  it("rejects empty messages", () => {
    expect(parseLlmChatInput({ messages: [] })).toEqual({
      ok: false,
      message: "llm.chat requires at least one message."
    });
  });

  it("rejects invalid roles", () => {
    expect(parseLlmChatInput({ messages: [{ role: "tool", content: "Hello" }] })).toEqual({
      ok: false,
      message: "llm.chat message at index 0 has invalid role."
    });
  });

  it("rejects non-string content", () => {
    expect(parseLlmChatInput({ messages: [{ role: "user", content: 42 }] })).toEqual({
      ok: false,
      message: "llm.chat message at index 0 requires string content."
    });
  });
});
