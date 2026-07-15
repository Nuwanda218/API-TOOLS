/**
 * Provider configuration validation rules.
 *
 * Checks that a provider's fields are valid before it is created or updated.
 */

import type { CreateProviderInput } from "../../providers/providerRepository.js";
import {
  createValidationResult,
  mergeValidationResults,
  type ValidationResult,
  type Validator,
} from "../types.js";
import { fieldRuleFor } from "../validator.js";

// ── Controlled vocabulary ──

const VALID_API_FORMATS = [
  "openai-chat-completions",
  "openai-responses",
  "claude-messages",
] as const;

const VALID_PROVIDER_TYPES = ["openai-compatible", "openai-official"] as const;

// ── Rule definitions ──

/** base_url must not be empty. */
const baseUrlNotEmpty: Validator<CreateProviderInput> = fieldRuleFor(
  "baseUrl",
  "empty_base_url",
  "blocking",
  (v) => v.length > 0,
  "Base URL must not be empty"
);

/** base_url should start with https:// (advisory only). */
const baseUrlHttps: Validator<CreateProviderInput> = (input) => {
  const result = createValidationResult();
  if (!input.baseUrl.startsWith("https://") && !input.baseUrl.startsWith("http://")) {
    result.advisory.push({
      code: "invalid_base_url_scheme",
      message: `Base URL should start with https:// (got: ${input.baseUrl.slice(0, 30)}...)`,
      field: "baseUrl",
    });
  }
  return result;
};

/** base_url should NOT contain a version path (advisory). */
const baseUrlNoVersionPath: Validator<CreateProviderInput> = (input) => {
  const result = createValidationResult();
  if (/\/v\d+/.test(input.baseUrl)) {
    result.advisory.push({
      code: "base_url_has_version",
      message: `Base URL already contains a version path: ${input.baseUrl}. API calls will append their own paths.`,
      field: "baseUrl",
    });
  }
  return result;
};

/** apiKeyEnv must reference a valid-looking env var name. */
const apiKeyEnvValid: Validator<CreateProviderInput> = fieldRuleFor(
  "apiKeyEnv",
  "invalid_api_key_env",
  "blocking",
  (v) => /^[A-Z][A-Z0-9_]*$/.test(v),
  "API Key env var must be UPPER_SNAKE_CASE (e.g. OPENAI_API_KEY)"
);

/** apiKeyEnv should not look like an actual secret value (advisory). */
const apiKeyEnvNotSecret: Validator<CreateProviderInput> = (input) => {
  const result = createValidationResult();
  if (/^sk[-_]|^key[-_]|^secret/i.test(input.apiKeyEnv)) {
    result.advisory.push({
      code: "api_key_env_looks_like_secret",
      message: `apiKeyEnv "${input.apiKeyEnv}" looks like a secret value, not an env var name. Use something like CUSTOM_API_KEY.`,
      field: "apiKeyEnv",
    });
  }
  return result;
};

/** name must not be empty. */
const nameNotEmpty: Validator<CreateProviderInput> = fieldRuleFor(
  "name",
  "empty_name",
  "blocking",
  (v) => v.trim().length > 0,
  "Provider name must not be empty"
);

/** apiFormat must be one of the known formats. */
const apiFormatValid: Validator<CreateProviderInput> = (input) => {
  const result = createValidationResult();
  if (!VALID_API_FORMATS.includes(input.apiFormat as typeof VALID_API_FORMATS[number])) {
    result.blocking.push({
      code: "invalid_api_format",
      message: `apiFormat must be one of: ${VALID_API_FORMATS.join(", ")}`,
      field: "apiFormat",
    });
  }
  return result;
};

/** type must be a valid provider type. */
const typeValid: Validator<CreateProviderInput> = (input) => {
  const result = createValidationResult();
  if (!VALID_PROVIDER_TYPES.includes(input.type as typeof VALID_PROVIDER_TYPES[number])) {
    result.blocking.push({
      code: "invalid_provider_type",
      message: `Provider type must be one of: ${VALID_PROVIDER_TYPES.join(", ")}`,
      field: "type",
    });
  }
  return result;
};

// ── Aggregate ──

/** All provider creation rules combined. */
export const providerValidationRules: Validator<CreateProviderInput>[] = [
  nameNotEmpty,
  baseUrlNotEmpty,
  baseUrlHttps,
  baseUrlNoVersionPath,
  apiKeyEnvValid,
  apiKeyEnvNotSecret,
  apiFormatValid,
  typeValid,
];

/**
 * Run all provider validation rules and return the merged result.
 */
export async function validateProviderInput(
  input: CreateProviderInput
): Promise<ValidationResult> {
  const results = await Promise.all(providerValidationRules.map((rule) => rule(input)));
  return mergeValidationResults(...results);
}
