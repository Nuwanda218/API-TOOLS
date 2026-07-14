/**
 * Tests for BaseAgent — the abstract agent foundation class.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BaseAgent, type CallLlmOptions } from "./BaseAgent.js";
import type { LlmClient, LlmClientDependencies } from "./LlmClient.js";
import type { CallRecord, LlmCallResult, SessionStats } from "./types.js";

// ── Concrete subclass for testing ──

class TestAgent extends BaseAgent {
  public lastRunArgs: unknown[] = [];

  async run(...args: unknown[]): Promise<string> {
    this.lastRunArgs = args;
    return "done";
  }

  // Expose protected methods for testing
  public async publicCallLlm(options: CallLlmOptions): Promise<string> {
    return this.callLlm(options);
  }

  public publicLoadPrompt(relativePath: string): string {
    return this.loadPrompt(relativePath);
  }

  public publicWriteFile(relativePath: string, content: string): void {
    return this.writeFile(relativePath, content);
  }
}

// ── Fake LlmClient ──

function fakeLlmClient(responses: string[] = []): LlmClient {
  let callIndex = 0;
  const callHistory: CallRecord[] = [];

  return {
    async ask(prompt: string, system?: string): Promise<string> {
      const idx = callIndex++;
      const content = responses[idx] ?? `echo: ${prompt}`;
      const record: CallRecord = {
        timestamp: new Date().toISOString(),
        provider: "fake",
        model: "fake-model",
        systemPrompt: system ?? "",
        userMessage: prompt,
        parameters: {},
        response: content,
        latencyMs: 100,
        usage: { inputTokens: 5, outputTokens: 10 },
      };
      callHistory.push(record);
      return content;
    },

    async call(options: {
      systemPrompt: string;
      userMessage: string;
    }): Promise<LlmCallResult> {
      const content = await this.ask(options.userMessage, options.systemPrompt);
      return {
        content,
        model: "fake-model",
        provider: "fake",
        latencyMs: 100,
        usage: { inputTokens: 5, outputTokens: 10 },
      };
    },

    get callHistory() {
      return [...callHistory];
    },

    get stats(): SessionStats {
      return {
        totalCalls: callHistory.length,
        totalTokens: callHistory.reduce(
          (acc, r) => ({
            inputTokens: acc.inputTokens + r.usage.inputTokens,
            outputTokens: acc.outputTokens + r.usage.outputTokens,
          }),
          { inputTokens: 0, outputTokens: 0 }
        ),
        totalLatencyMs: callHistory.reduce((sum, r) => sum + r.latencyMs, 0),
      };
    },

    clearHistory() {
      callHistory.length = 0;
    },
  };
}

// ── Temp directory helper ──

function tempProjectRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "base-agent-test-"));
}

// ── Tests ──

describe("BaseAgent", () => {
  let tempRoots: string[] = [];

  afterEach(() => {
    for (const dir of tempRoots) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempRoots = [];
  });

  function createTempRoot(): string {
    const dir = tempProjectRoot();
    tempRoots.push(dir);
    return dir;
  }

  describe("construction", () => {
    it("accepts a LlmClient and project root", () => {
      const client = fakeLlmClient();
      const root = createTempRoot();
      const agent = new TestAgent(client, root);

      expect(agent.projectRoot).toBe(root);
      expect(agent.totalCalls).toBe(0);
    });

    it("defaults projectRoot when not provided", () => {
      const client = fakeLlmClient();
      const agent = new TestAgent(client);

      // projectRoot should be a real path ending with the project root
      expect(agent.projectRoot).toContain("api-tools");
    });
  });

  describe("loadPrompt()", () => {
    it("reads a markdown file from project root", () => {
      const root = createTempRoot();
      const promptsDir = path.join(root, "server", "src", "agents", "prompts");
      fs.mkdirSync(promptsDir, { recursive: true });
      fs.writeFileSync(path.join(promptsDir, "test-prompt.md"), "# System\nYou are helpful.", "utf-8");

      const agent = new TestAgent(fakeLlmClient(), root);
      const content = agent.publicLoadPrompt("server/src/agents/prompts/test-prompt.md");

      expect(content).toBe("# System\nYou are helpful.");
    });

    it("throws when file does not exist", () => {
      const root = createTempRoot();
      const agent = new TestAgent(fakeLlmClient(), root);

      expect(() => agent.publicLoadPrompt("nonexistent.md")).toThrow("Prompt file not found");
    });
  });

  describe("loadLanguagePrompt()", () => {
    it("loads language_en.md by default", () => {
      const root = createTempRoot();
      const promptsDir = path.join(root, "server", "src", "agents", "prompts");
      fs.mkdirSync(promptsDir, { recursive: true });
      fs.writeFileSync(path.join(promptsDir, "language_en.md"), "Use English.", "utf-8");
      fs.writeFileSync(path.join(promptsDir, "language_zh.md"), "使用中文。", "utf-8");

      const agent = new TestAgent(fakeLlmClient(), root);

      expect(agent.loadLanguagePrompt("en")).toBe("Use English.");
      expect(agent.loadLanguagePrompt("zh")).toBe("使用中文。");
    });

    it("accepts custom prompts directory", () => {
      const root = createTempRoot();
      const promptsDir = path.join(root, "custom", "prompts");
      fs.mkdirSync(promptsDir, { recursive: true });
      fs.writeFileSync(path.join(promptsDir, "language_en.md"), "Custom EN.", "utf-8");

      const agent = new TestAgent(fakeLlmClient(), root);

      expect(agent.loadLanguagePrompt("en", "custom/prompts")).toBe("Custom EN.");
    });
  });

  describe("callLlm()", () => {
    it("calls the client and returns text content", async () => {
      const client = fakeLlmClient(["Response from LLM"]);
      const agent = new TestAgent(client);

      const result = await agent.publicCallLlm({
        systemPrompt: "You are helpful.",
        userMessage: "What is 1+1?",
        label: "math",
      });

      expect(result).toBe("Response from LLM");
    });

    it("updates session stats after a call", async () => {
      const client = fakeLlmClient(["First", "Second"]);
      const agent = new TestAgent(client);

      expect(agent.totalCalls).toBe(0);

      await agent.publicCallLlm({ systemPrompt: "S", userMessage: "Q1" });
      expect(agent.totalCalls).toBe(1);
      expect(agent.totalTokens.inputTokens).toBe(5);
      expect(agent.totalTokens.outputTokens).toBe(10);

      await agent.publicCallLlm({ systemPrompt: "S", userMessage: "Q2" });
      expect(agent.totalCalls).toBe(2);
      expect(agent.totalTokens.inputTokens).toBe(10);
      expect(agent.totalTokens.outputTokens).toBe(20);
    });

    it("passes through provider, model, temperature, maxTokens", async () => {
      // Track what the client received
      let capturedPrompt = "";
      const client = fakeLlmClient(["OK"]);
      const originalAsk = client.ask.bind(client);
      client.ask = async (prompt: string, system?: string, options?: Record<string, unknown>) => {
        capturedPrompt = JSON.stringify({ prompt: prompt.slice(0, 20), system: system?.slice(0, 20), options });
        return originalAsk(prompt, system, options);
      };

      const agent = new TestAgent(client);
      await agent.publicCallLlm({
        systemPrompt: "System here",
        userMessage: "User here",
        provider: "custom-provider",
        model: "custom-model",
        temperature: 0.7,
        maxTokens: 1024,
        label: "test",
      });

      expect(capturedPrompt).toContain("custom-provider");
      expect(capturedPrompt).toContain("custom-model");
    });
  });

  describe("writeFile()", () => {
    it("writes content to a file with auto-created directories", () => {
      const root = createTempRoot();
      const agent = new TestAgent(fakeLlmClient(), root);

      agent.publicWriteFile("output/test.txt", "Hello, world!");

      const fullPath = path.join(root, "output", "test.txt");
      expect(fs.existsSync(fullPath)).toBe(true);
      expect(fs.readFileSync(fullPath, "utf-8")).toBe("Hello, world!");
    });
  });

  describe("stats delegation", () => {
    it("delegates to client.stats", () => {
      const client = fakeLlmClient();
      const agent = new TestAgent(client);

      expect(agent.stats).toEqual(client.stats);
    });
  });

  describe("abstract run()", () => {
    it("can be overridden by subclasses", async () => {
      const agent = new TestAgent(fakeLlmClient());
      const result = await agent.run("arg1", "arg2");

      expect(result).toBe("done");
      expect(agent.lastRunArgs).toEqual(["arg1", "arg2"]);
    });
  });
});
