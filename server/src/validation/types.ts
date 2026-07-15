/**
 * Validation type definitions.
 *
 * Two-tier severity system adapted from the Python bibliometrics project:
 *   03_task_agents/validate_section_json.py
 *
 *   blocking — must be fixed before the operation proceeds
 *   advisory — a warning / suggestion, but the operation may continue
 */

// ── Severity ──

export type ValidationSeverity = "blocking" | "advisory";

// ── Single Issue ──

export interface ValidationIssue {
  /** Machine-readable code (e.g. "missing_base_url", "disabled_model"). */
  code: string;
  /** Human-readable description of the problem. */
  message: string;
  /** Which field or step this issue relates to (optional). */
  field?: string;
}

// ── Aggregate Result ──

export interface ValidationResult {
  /** Issues that MUST be resolved. Operation should be rejected. */
  blocking: ValidationIssue[];
  /** Issues that SHOULD be reviewed. Operation may proceed with caution. */
  advisory: ValidationIssue[];

  /** Convenience: true when there are no blocking issues. */
  readonly ok: boolean;
}

// ── Factory helpers ──

export function createValidationResult(): ValidationResult {
  const blocking: ValidationIssue[] = [];
  const advisory: ValidationIssue[] = [];

  return {
    blocking,
    advisory,
    get ok() {
      return blocking.length === 0;
    },
  };
}

export function mergeValidationResults(...results: ValidationResult[]): ValidationResult {
  const merged = createValidationResult();
  for (const r of results) {
    merged.blocking.push(...r.blocking);
    merged.advisory.push(...r.advisory);
  }
  return merged;
}

// ── Validator type ──

/**
 * A validator is a function that takes an input of type T and returns
 * a ValidationResult. Validators may be sync or async.
 */
export type Validator<T> = (input: T) => ValidationResult | Promise<ValidationResult>;
