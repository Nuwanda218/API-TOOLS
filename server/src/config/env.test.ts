import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverProviderConfigs, findLocalEnvPath } from "./env.js";

let tempDirectory: string | undefined;

afterEach(async () => {
  if (tempDirectory) {
    await rm(tempDirectory, { recursive: true, force: true });
    tempDirectory = undefined;
  }
});

describe("env config", () => {
  it("finds a parent .env when started from a workspace package", async () => {
    tempDirectory = join(tmpdir(), `api-tools-env-${Date.now()}`);
    const serverDirectory = join(tempDirectory, "server");

    await mkdir(serverDirectory, { recursive: true });
    await writeFile(join(tempDirectory, ".env"), "OPENAI_API_KEY=sk-test\n");

    expect(findLocalEnvPath(serverDirectory)).toBe(join(tempDirectory, ".env"));
  });
});

describe("discoverProviderConfigs", () => {
  it("discovers a single provider from three required env vars", () => {
    const configs = discoverProviderConfigs({
      LLM_OPENAI_BASE_URL: "https://api.openai.com/v1",
      LLM_OPENAI_API_KEY: "sk-test",
      LLM_OPENAI_DEFAULT_MODEL: "gpt-5",
    });

    expect(configs).toHaveLength(1);
    expect(configs[0]).toMatchObject({
      name: "openai",
      type: "openai-compatible",
      apiFormat: "openai-chat-completions",
      baseUrl: "https://api.openai.com/v1",
      apiKeyEnv: "LLM_OPENAI_API_KEY",
      defaultModel: "gpt-5",
    });
  });

  it("infers claude-messages protocol when name contains ANTHROPIC", () => {
    const configs = discoverProviderConfigs({
      LLM_ANTHROPIC_BASE_URL: "https://api.deepseek.com/anthropic",
      LLM_ANTHROPIC_API_KEY: "sk-test",
      LLM_ANTHROPIC_DEFAULT_MODEL: "deepseek-v4-flash",
    });

    expect(configs).toHaveLength(1);
    expect(configs[0].apiFormat).toBe("claude-messages");
  });

  it("strips trailing slashes from base URL", () => {
    const configs = discoverProviderConfigs({
      LLM_DEEPSEEK_BASE_URL: "https://api.deepseek.com/v1///",
      LLM_DEEPSEEK_API_KEY: "sk-test",
      LLM_DEEPSEEK_DEFAULT_MODEL: "deepseek-v4-flash",
    });

    expect(configs[0].baseUrl).toBe("https://api.deepseek.com/v1");
  });

  it("skips providers missing required env vars", () => {
    // Missing API_KEY
    const configs1 = discoverProviderConfigs({
      LLM_FOO_BASE_URL: "https://example.com",
      LLM_FOO_DEFAULT_MODEL: "foo-v1",
    });
    expect(configs1).toHaveLength(0);

    // Missing DEFAULT_MODEL
    const configs2 = discoverProviderConfigs({
      LLM_BAR_BASE_URL: "https://example.com",
      LLM_BAR_API_KEY: "sk-bar",
    });
    expect(configs2).toHaveLength(0);
  });

  it("discovers multiple providers", () => {
    const configs = discoverProviderConfigs({
      LLM_OPENAI_BASE_URL: "https://api.openai.com/v1",
      LLM_OPENAI_API_KEY: "sk-openai",
      LLM_OPENAI_DEFAULT_MODEL: "gpt-5",
      LLM_DEEPSEEK_BASE_URL: "https://api.deepseek.com/v1",
      LLM_DEEPSEEK_API_KEY: "sk-deepseek",
      LLM_DEEPSEEK_DEFAULT_MODEL: "deepseek-v4-flash",
    });

    expect(configs).toHaveLength(2);
    expect(configs.map((c) => c.name).sort()).toEqual(["deepseek", "openai"]);
  });

  it("uses explicit LLM_{NAME}_PROTOCOL override", () => {
    const configs = discoverProviderConfigs({
      LLM_CUSTOM_BASE_URL: "https://example.com/v1",
      LLM_CUSTOM_API_KEY: "sk-test",
      LLM_CUSTOM_DEFAULT_MODEL: "custom-v1",
      LLM_CUSTOM_PROTOCOL: "openai-responses",
    });

    expect(configs).toHaveLength(1);
    expect(configs[0].apiFormat).toBe("openai-responses");
  });

  it("supports manual model list via LLM_{NAME}_MODELS", () => {
    const configs = discoverProviderConfigs({
      LLM_LOCAL_BASE_URL: "https://localhost/v1",
      LLM_LOCAL_API_KEY: "sk-local",
      LLM_LOCAL_DEFAULT_MODEL: "llama-3",
      LLM_LOCAL_MODELS: "llama-3,mixtral,codellama",
    });

    expect(configs).toHaveLength(1);
    expect(configs[0].manualModels).toEqual(["llama-3", "mixtral", "codellama"]);
  });

  it("empty manual models yields empty array", () => {
    const configs = discoverProviderConfigs({
      LLM_LOCAL_BASE_URL: "https://localhost/v1",
      LLM_LOCAL_API_KEY: "sk-local",
      LLM_LOCAL_DEFAULT_MODEL: "llama-3",
      LLM_LOCAL_MODELS: "",
    });

    expect(configs[0].manualModels).toEqual([]);
  });

  it("deduplicates by provider name", () => {
    const configs = discoverProviderConfigs({
      LLM_OPENAI_BASE_URL: "https://api.openai.com/v1",
      LLM_OPENAI_API_KEY: "sk-openai",
      LLM_OPENAI_DEFAULT_MODEL: "gpt-5",
      // Duplicate prefix with different casing — same name after lowercase
      LLM_OpenAI_BASE_URL: "https://other.openai.com/v1",
      LLM_OpenAI_API_KEY: "sk-other",
      LLM_OpenAI_DEFAULT_MODEL: "gpt-4",
    });

    // Only the first one wins
    expect(configs).toHaveLength(1);
  });
});
