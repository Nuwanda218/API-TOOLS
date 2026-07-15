/**
 * Workflow step validation rules.
 *
 * Checks that workflow definitions are structurally sound before execution.
 */

import type { ModelRepository } from "../../providers/modelRepository.js";
import type { ProviderRepository } from "../../providers/providerRepository.js";
import type { WorkflowStepDefinition } from "../../workflows/types.js";
import {
  createValidationResult,
  mergeValidationResults,
  type ValidationResult,
  type Validator,
} from "../types.js";

// ── Controlled vocabulary ──

const KNOWN_STEP_TYPES = ["llm.chat", "endpoint.call", "mcp.call"] as const;

// ── Rule definitions ──

/** Step type must be one of the known values. */
const stepTypeKnown: Validator<WorkflowStepDefinition> = (step) => {
  const result = createValidationResult();
  if (!KNOWN_STEP_TYPES.includes(step.type as typeof KNOWN_STEP_TYPES[number])) {
    result.blocking.push({
      code: "unknown_step_type",
      message: `Unknown step type: "${step.type}". Known types: ${KNOWN_STEP_TYPES.join(", ")}`,
      field: "type",
    });
  }
  return result;
};

/** llm.chat steps must reference a modelId. */
const llmChatHasModel: Validator<WorkflowStepDefinition> = (step) => {
  const result = createValidationResult();
  if (step.type === "llm.chat" && !("modelId" in step) || (step.type === "llm.chat" && !step.modelId)) {
    result.blocking.push({
      code: "missing_model_id",
      message: "llm.chat step requires a modelId",
      field: "modelId",
    });
  }
  return result;
};

/** endpoint.call steps must reference an endpointId. */
const endpointCallHasEndpoint: Validator<WorkflowStepDefinition> = (step) => {
  const result = createValidationResult();
  if (step.type === "endpoint.call" && !("endpointId" in step)) {
    result.blocking.push({
      code: "missing_endpoint_id",
      message: "endpoint.call step requires an endpointId",
      field: "endpointId",
    });
  }
  return result;
};

/** mcp.call steps must reference an mcpServerId and a toolName. */
const mcpCallHasServer: Validator<WorkflowStepDefinition> = (step) => {
  const result = createValidationResult();
  if (step.type === "mcp.call") {
    if (!("mcpServerId" in step) || !step.mcpServerId) {
      result.blocking.push({
        code: "missing_mcp_server_id",
        message: "mcp.call step requires an mcpServerId",
        field: "mcpServerId",
      });
    }
    if (!("toolName" in step) || !step.toolName) {
      result.blocking.push({
        code: "missing_tool_name",
        message: "mcp.call step requires a toolName",
        field: "toolName",
      });
    }
  }
  return result;
};

/** Validate that the referenced model exists and is enabled. */
function modelExistsAndEnabled(models: ModelRepository): Validator<WorkflowStepDefinition> {
  return (step) => {
    const result = createValidationResult();
    if (step.type !== "llm.chat" || !step.modelId) return result;

    const model = models.getById(step.modelId);
    if (!model) {
      result.blocking.push({
        code: "model_not_found",
        message: `Model not found: ${step.modelId}`,
        field: "modelId",
      });
    } else if (!model.enabled) {
      result.advisory.push({
        code: "disabled_model",
        message: `Model "${model.displayName}" is disabled`,
        field: "modelId",
      });
    }
    return result;
  };
}

// ── Aggregate ──

/** All workflow step validation rules (no DB access). */
export const workflowStepStructuralRules: Validator<WorkflowStepDefinition>[] = [
  stepTypeKnown,
  llmChatHasModel,
  endpointCallHasEndpoint,
  mcpCallHasServer,
];

/**
 * Create the full rule set including DB-backed checks.
 */
export function createWorkflowStepRules(
  models: ModelRepository
): Validator<WorkflowStepDefinition>[] {
  return [
    ...workflowStepStructuralRules,
    modelExistsAndEnabled(models),
  ];
}

/**
 * Run all workflow step rules against a single step.
 */
export async function validateWorkflowStep(
  step: WorkflowStepDefinition,
  models: ModelRepository
): Promise<ValidationResult> {
  const rules = createWorkflowStepRules(models);
  const results = await Promise.all(rules.map((rule) => rule(step)));
  return mergeValidationResults(...results);
}

/**
 * Run structural-only rules (no DB required) against all steps in a workflow.
 */
export function validateWorkflowStepsStructural(
  steps: WorkflowStepDefinition[]
): ValidationResult {
  const results = steps.flatMap((step) =>
    workflowStepStructuralRules.map((rule) => rule(step))
  );
  return mergeValidationResults(...results);
}
