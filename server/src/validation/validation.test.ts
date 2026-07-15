/**
 * Tests for validation system: types, validator composability, and domain rules.
 */

import { describe, expect, it } from "vitest";
import { createProviderRepository } from "../providers/providerRepository.js";
import { createModelRepository } from "../providers/modelRepository.js";
import { createTestDatabase } from "../test/testDb.js";
import {
  createValidationResult,
  mergeValidationResults,
  type ValidationResult,
} from "./types.js";
import { enumRule, fieldRule, fieldRuleFor, runValidators, runValidatorsSync } from "./validator.js";
import { providerValidationRules, validateProviderInput } from "./rules/providerRules.js";
import {
  createWorkflowStepRules,
  validateWorkflowStep,
  validateWorkflowStepsStructural,
  workflowStepStructuralRules,
} from "./rules/workflowRules.js";
import type { WorkflowStepDefinition } from "../workflows/types.js";

// ── Types ──

describe("ValidationResult", () => {
  it("ok is true when blocking is empty", () => {
    const r = createValidationResult();
    expect(r.ok).toBe(true);
  });

  it("ok is false when blocking has issues", () => {
    const r = createValidationResult();
    r.blocking.push({ code: "err", message: "bad" });
    expect(r.ok).toBe(false);
  });

  it("ok is true with advisory-only issues", () => {
    const r = createValidationResult();
    r.advisory.push({ code: "warn", message: "meh" });
    expect(r.ok).toBe(true);
  });
});

describe("mergeValidationResults", () => {
  it("combines blocking and advisory from multiple results", () => {
    const a = createValidationResult();
    a.blocking.push({ code: "e1", message: "Error 1" });

    const b = createValidationResult();
    b.advisory.push({ code: "w1", message: "Warning 1" });

    const c = createValidationResult();
    c.blocking.push({ code: "e2", message: "Error 2" });
    c.advisory.push({ code: "w2", message: "Warning 2" });

    const merged = mergeValidationResults(a, b, c);
    expect(merged.blocking).toHaveLength(2);
    expect(merged.advisory).toHaveLength(2);
    expect(merged.ok).toBe(false);
  });
});

// ── Validator runners ──

describe("runValidators", () => {
  it("runs all validators and merges results", async () => {
    const rules = [
      fieldRule("not_empty", "blocking", (s: string) => s.length > 0, "Must not be empty"),
      fieldRule("not_too_long", "advisory", (s: string) => s.length <= 100, "Too long"),
    ];

    const ok = await runValidators("hello", rules);
    expect(ok.ok).toBe(true);

    const fail = await runValidators("", rules);
    expect(fail.ok).toBe(false);
    expect(fail.blocking).toHaveLength(1);
    expect(fail.blocking[0].code).toBe("not_empty");
  });
});

describe("runValidatorsSync", () => {
  it("runs sync validators", () => {
    const rules = [
      fieldRule("min", "blocking", (n: number) => n > 0, "Must be positive"),
      fieldRule("even", "advisory", (n: number) => n % 2 === 0, "Should be even"),
    ];

    const ok = runValidatorsSync(2, rules);
    expect(ok.ok).toBe(true);
    expect(ok.advisory).toHaveLength(0);

    const warn = runValidatorsSync(1, rules);
    expect(warn.ok).toBe(true);
    expect(warn.advisory).toHaveLength(1);
  });
});

describe("fieldRuleFor", () => {
  it("checks a specific field and includes field name", () => {
    interface Foo { name: string; count: number }
    const rule = fieldRuleFor<Foo>("name", "bad_name", "blocking", (v) => v.length > 0, "Name required");

    const ok = rule({ name: "test", count: 1 });
    expect(ok.ok).toBe(true);

    const bad = rule({ name: "", count: 1 });
    expect(bad.blocking[0].field).toBe("name");
  });
});

describe("enumRule", () => {
  it("validates that a field value is in the allowed set", () => {
    interface Step { type: string }
    const rule = enumRule<Step>("type", "bad_type", "blocking", ["chat", "image"]);

    expect(rule({ type: "chat" }).ok).toBe(true);
    expect(rule({ type: "video" }).ok).toBe(false);
  });
});

// ── Provider rules ──

describe("providerValidationRules", () => {
  const validInput = {
    name: "Test Provider",
    type: "openai-compatible" as const,
    apiFormat: "openai-chat-completions" as const,
    baseUrl: "https://api.example.com",
    apiKeyEnv: "EXAMPLE_API_KEY",
  };

  it("passes a valid provider config", async () => {
    const result = await validateProviderInput(validInput);
    expect(result.ok).toBe(true);
  });

  it("blocks empty baseUrl", async () => {
    const result = await validateProviderInput({ ...validInput, baseUrl: "" });
    expect(result.ok).toBe(false);
    expect(result.blocking.some((i) => i.code === "empty_base_url")).toBe(true);
  });

  it("blocks invalid apiKeyEnv format", async () => {
    const result = await validateProviderInput({ ...validInput, apiKeyEnv: "my key" });
    expect(result.ok).toBe(false);
    expect(result.blocking.some((i) => i.code === "invalid_api_key_env")).toBe(true);
  });

  it("advisory on non-https baseUrl", async () => {
    const result = await validateProviderInput({ ...validInput, baseUrl: "ftp://files.example" });
    expect(result.ok).toBe(true);
    expect(result.advisory.some((i) => i.code === "invalid_base_url_scheme")).toBe(true);
  });

  it("advisory on apiKeyEnv that looks like a secret", async () => {
    // Must still be valid UPPER_SNAKE_CASE, but starts with "sk-" pattern
    const result = await validateProviderInput({ ...validInput, apiKeyEnv: "SK_PROJECT_KEY" });
    expect(result.ok).toBe(true);
    expect(result.advisory.some((i) => i.code === "api_key_env_looks_like_secret")).toBe(true);
  });

  it("advisory when baseUrl already contains version path", async () => {
    const result = await validateProviderInput({ ...validInput, baseUrl: "https://api.example.com/v1" });
    expect(result.advisory.some((i) => i.code === "base_url_has_version")).toBe(true);
  });
});

// ── Workflow rules ──

describe("workflowStepStructuralRules", () => {
  function step(overrides: Partial<WorkflowStepDefinition> = {}): WorkflowStepDefinition {
    return {
      id: "s1",
      type: "llm.chat",
      modelId: "m1",
      input: {},
      ...overrides,
    } as WorkflowStepDefinition;
  }

  it("passes a valid llm.chat step", () => {
    const rulesResult = runValidatorsSync(step(), workflowStepStructuralRules);
    expect(rulesResult.ok).toBe(true);
  });

  it("blocks unknown step type", () => {
    const s = step({ type: "unknown.type" as WorkflowStepDefinition["type"] });
    const result = runValidatorsSync(s, workflowStepStructuralRules);
    expect(result.ok).toBe(false);
    expect(result.blocking[0].code).toBe("unknown_step_type");
  });

  it("blocks llm.chat without modelId", () => {
    const s = { ...step(), modelId: undefined } as WorkflowStepDefinition;
    const result = runValidatorsSync(s, workflowStepStructuralRules);
    expect(result.ok).toBe(false);
    expect(result.blocking.some((i) => i.code === "missing_model_id")).toBe(true);
  });

  it("blocks mcp.call without server or tool", () => {
    const s = step({ type: "mcp.call", mcpServerId: "", toolName: "" }) as WorkflowStepDefinition;
    const result = runValidatorsSync(s, workflowStepStructuralRules);
    expect(result.ok).toBe(false);
    expect(result.blocking.length).toBeGreaterThanOrEqual(2);
  });
});

describe("modelExistsAndEnabled (DB-backed)", () => {
  it("blocks when referenced model does not exist", () => {
    const db = createTestDatabase();
    const models = createModelRepository(db);
    const rules = createWorkflowStepRules(models);

    const s: WorkflowStepDefinition = {
      id: "s1", type: "llm.chat", modelId: "nonexistent", input: {},
    } as WorkflowStepDefinition;

    const result = runValidatorsSync(s, rules);
    expect(result.ok).toBe(false);
    expect(result.blocking.some((i) => i.code === "model_not_found")).toBe(true);
  });

  it("advisory when model is disabled", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);

    const p = providers.create({
      name: "P", type: "openai-compatible", apiFormat: "openai-chat-completions",
      baseUrl: "https://a.b", apiKeyEnv: "K",
    });
    const m = models.create({
      providerId: p.id, displayName: "M", modelId: "m1", capability: "chat", enabled: false,
    });

    const rules = createWorkflowStepRules(models);
    const s: WorkflowStepDefinition = {
      id: "s1", type: "llm.chat", modelId: m.id, input: {},
    } as WorkflowStepDefinition;

    const result = runValidatorsSync(s, rules);
    expect(result.ok).toBe(true);
    expect(result.advisory.some((i) => i.code === "disabled_model")).toBe(true);
  });
});

describe("validateWorkflowStepsStructural", () => {
  it("validates all steps and merges results", () => {
    const steps: WorkflowStepDefinition[] = [
      { id: "1", type: "llm.chat", modelId: "m1", input: {} } as WorkflowStepDefinition,
      { id: "2", type: "unknown", modelId: "m2", input: {} } as WorkflowStepDefinition,
    ];

    const result = validateWorkflowStepsStructural(steps);
    expect(result.ok).toBe(false);
    expect(result.blocking).toHaveLength(1);
  });
});
