/**
 * Composable validator runner.
 *
 * Runs multiple Validator<T> functions against the same input and merges
 * their results. Pattern matches the Python project's approach where
 * multiple check functions populate a shared issues list.
 *
 * Adapted from:
 *   03_task_agents/validate_section_json.py (severity-tiered issue accumulation)
 */

import {
  createValidationResult,
  mergeValidationResults,
  type ValidationIssue,
  type ValidationResult,
  type Validator,
} from "./types.js";

// ── Runner ──

/**
 * Run all validators against the input (order preserved).
 * Returns the merged ValidationResult. Short-circuits on the first
 * thrown error (not on validation failures — those accumulate).
 */
export async function runValidators<T>(
  input: T,
  validators: Validator<T>[]
): Promise<ValidationResult> {
  const results: ValidationResult[] = [];

  for (const validator of validators) {
    const result = await validator(input);
    results.push(result);
  }

  return mergeValidationResults(...results);
}

/**
 * Sync version for validators that don't need async.
 */
export function runValidatorsSync<T>(
  input: T,
  validators: Array<(input: T) => ValidationResult>
): ValidationResult {
  const results = validators.map((v) => v(input));
  return mergeValidationResults(...results);
}

// ── Rule builders ──

/**
 * Create a simple field validator.
 *
 * @param code - Issue code (e.g. "empty_field")
 * @param severity - "blocking" or "advisory"
 * @param check - Return true if the value is valid
 * @param message - Description when the check fails
 */
export function fieldRule<T>(
  code: string,
  severity: ValidationIssue["message"] extends string ? "blocking" | "advisory" : never,
  check: (input: T) => boolean,
  message: string
): Validator<T> {
  return (input: T): ValidationResult => {
    const result = createValidationResult();
    if (!check(input)) {
      const issue: ValidationIssue = { code, message };
      if (severity === "blocking") {
        result.blocking.push(issue);
      } else {
        result.advisory.push(issue);
      }
    }
    return result;
  };
}

/**
 * Create a validator that checks a single field of the input object.
 *
 * @param field - Field name for error context
 * @param code - Issue code
 * @param severity - "blocking" or "advisory"
 * @param check - Return true if the field value is valid
 * @param message - Description when the check fails
 */
export function fieldRuleFor<T, K extends keyof T>(
  field: K,
  code: string,
  severity: "blocking" | "advisory",
  check: (value: T[K]) => boolean,
  message: string
): Validator<T> {
  return (input: T): ValidationResult => {
    const result = createValidationResult();
    if (!check(input[field])) {
      const issue: ValidationIssue = { code, message, field: String(field) };
      if (severity === "blocking") {
        result.blocking.push(issue);
      } else {
        result.advisory.push(issue);
      }
    }
    return result;
  };
}

/**
 * Create a validator from a controlled vocabulary check.
 * Value must be one of the allowed entries.
 */
export function enumRule<T, K extends keyof T>(
  field: K,
  code: string,
  severity: "blocking" | "advisory",
  allowed: ReadonlyArray<T[K]>,
): Validator<T> {
  return fieldRuleFor(field, code, severity, (v) => allowed.includes(v), `"${String(field)}" must be one of: ${allowed.map(String).join(", ")}`);
}
