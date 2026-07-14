/**
 * BaseAgent — foundation class for all agents.
 *
 * Provides prompt loading, LLM calling with progress display, file writing,
 * and session-level statistics. All agents extend this class and implement
 * their own `run()` or task-specific logic.
 *
 * Migrated from the Python bibliometrics project:
 *   F:\26暑期实习\文献计量学论文主体部分\03_task_agents\agents\base_agent.py
 *
 * Key adaptations:
 *   - async/await instead of Python threading for the progress ticker
 *   - TypeScript strict types throughout
 *   - LlmClient wrapping the existing AdapterRegistry (instead of raw requests)
 *   - Node.js fs/path for file operations (instead of Python pathlib)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { LlmClient } from "./LlmClient.js";
import type { LlmCallOptions, SessionStats } from "./types.js";

// ── Call options ──

export interface CallLlmOptions extends LlmCallOptions {
  /** System prompt text (required). */
  systemPrompt: string;
  /** User message text (required). */
  userMessage: string;
}

// ── BaseAgent ──

export abstract class BaseAgent {
  protected readonly client: LlmClient;
  protected readonly projectRoot: string;

  /**
   * @param client - LlmClient instance for making LLM calls.
   * @param projectRoot - Absolute path to the project root directory.
   *   Defaults to the worktree root (three levels up from this file).
   */
  constructor(client: LlmClient, projectRoot?: string) {
    this.client = client;
    // __dirname is .../server/src/agents/ → go up three levels to project root
    this.projectRoot = projectRoot ?? path.resolve(__dirname, "..", "..", "..");
  }

  // ── Prompt Loading ──

  /**
   * Read a markdown prompt file and return its contents.
   *
   * @param relativePath - Path relative to project root.
   *   E.g. "server/src/agents/prompts/reviewer.md"
   */
  loadPrompt(relativePath: string): string {
    const fullPath = path.resolve(this.projectRoot, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Prompt file not found: ${fullPath}`);
    }
    return fs.readFileSync(fullPath, "utf-8");
  }

  /**
   * Load a language-specific prompt file.
   *
   * @param language - "en" or "zh". Filename pattern: `language_{lang}.md`
   * @param promptsDir - Directory containing language prompt files,
   *   relative to project root. Defaults to "server/src/agents/prompts".
   */
  loadLanguagePrompt(language: string = "en", promptsDir?: string): string {
    const dir = promptsDir ?? "server/src/agents/prompts";
    const filePath = `${dir}/language_${language}.md`;
    return this.loadPrompt(filePath);
  }

  // ── LLM Calling ──

  /**
   * Single LLM call with progress display and token tracking.
   *
   * Displays a real-time "thinking... Ns" ticker during the call,
   * then prints a summary line with latency, character count, and token usage.
   *
   * @returns The model's text response.
   */
  async callLlm(options: CallLlmOptions): Promise<string> {
    const label = options.label ?? "llm";
    const userMessage = options.userMessage;
    const inputChars = userMessage.length;
    const inputTokensEst = Math.floor(inputChars / 4);
    const prefix = `  [${label}]`;

    console.log(`${prefix} 发送 ${inputChars.toLocaleString()} 字符 (~${inputTokensEst.toLocaleString()} tokens)`);

    const startedAt = Date.now();
    let ticker: ReturnType<typeof setInterval> | null = null;

    // Dynamic ticker: prints "thinking... Ns" every ~200ms
    try {
      ticker = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        process.stdout.write(`  [${label}] thinking... ${elapsed}s\r`);
      }, 200);

      const content = await this.client.ask(userMessage, options.systemPrompt, {
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });

      const elapsed = (Date.now() - startedAt) / 1000;
      const outputChars = content.length;
      const stats = this.client.stats;
      // Grab the last call's usage for this line
      const lastRecord = this.client.callHistory[this.client.callHistory.length - 1];
      const inTok = lastRecord?.usage.inputTokens ?? 0;
      const outTok = lastRecord?.usage.outputTokens ?? 0;
      const ok = outputChars > 0;
      const status = ok ? "✅" : "❌ 空返回";

      console.log(`${prefix} ${status} (${elapsed.toFixed(1)}s, ${outputChars.toLocaleString()} 字符, in=${inTok.toLocaleString()} out=${outTok.toLocaleString()})`);

      return content;
    } finally {
      if (ticker !== null) {
        clearInterval(ticker);
        // Clear the ticker line
        process.stdout.write(" ".repeat(60) + "\r");
      }
    }
  }

  // ── File Writing ──

  /**
   * Write content to a file, creating parent directories as needed.
   *
   * @param relativePath - Path relative to project root.
   * @param content - Text content to write.
   */
  writeFile(relativePath: string, content: string): void {
    const fullPath = path.resolve(this.projectRoot, relativePath);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
    console.log(`  [write] ${relativePath} (${content.length} 字符)`);
  }

  // ── Session Statistics ──

  /** Cumulative session statistics (calls, tokens, latency). */
  get stats(): SessionStats {
    return this.client.stats;
  }

  /** Total LLM calls made in this session. */
  get totalCalls(): number {
    return this.client.stats.totalCalls;
  }

  /** Cumulative token usage for this session. */
  get totalTokens(): { inputTokens: number; outputTokens: number } {
    return this.client.stats.totalTokens;
  }

  // ── Lifecycle ──

  /**
   * Override in subclasses to implement the agent's main logic.
   * Base implementation throws — subclasses MUST override.
   */
  abstract run(...args: unknown[]): Promise<unknown>;
}
