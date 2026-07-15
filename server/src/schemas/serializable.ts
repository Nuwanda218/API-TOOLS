/**
 * Serializable type contract.
 *
 * Every domain object that is persisted to disk MUST implement this pattern:
 *   - A plain data interface (the "DTO" shape)
 *   - A `serialize()` function: object → plain JSON
 *   - A `deserialize()` function: unknown → validated object (throws on failure)
 *
 * Adapted from the Python bibliometrics project pattern:
 *   Every dataclass has to_dict() and from_dict() methods
 *   (04_model_service/llm_gateway/schemas.py)
 *
 * In TypeScript we lean on Zod for runtime validation rather than building
 * manual from_dict constructors. The `SerializableContract<T>` type groups
 * the three pieces together so callers always get them as a unit.
 */

import type { ZodType } from "zod";

// ── Core contract ──

/**
 * Groups a TypeScript type with its serialization functions.
 * Use this to declare a "serializable domain object" in one place.
 */
export interface SerializableContract<T> {
  /** Zod schema for runtime validation on deserialization. */
  schema: ZodType<T>;

  /** Serialize a value to a plain JSON-compatible object. */
  serialize(value: T): unknown;

  /** Deserialize and validate. Throws on invalid input. */
  deserialize(raw: unknown): T;
}

// ── Helpers for building contracts ──

/**
 * Create a simple SerializableContract where the value IS already
 * JSON-compatible (no transformation needed beyond identity + validation).
 */
export function identityContract<T>(schema: ZodType<T>): SerializableContract<T> {
  return {
    schema,
    serialize: (value) => value,
    deserialize: (raw) => schema.parse(raw),
  };
}

/**
 * Create a contract with custom serialize/deserialize transforms.
 * Useful when the in-memory representation differs from the persisted shape.
 */
export function transformedContract<T>(
  schema: ZodType<T>,
  options: {
    serialize: (value: T) => unknown;
    deserialize: (raw: unknown) => T;
  }
): SerializableContract<T> {
  return {
    schema,
    serialize: options.serialize,
    deserialize: options.deserialize,
  };
}

// ── File-level persistence (delegates to storage layer) ──

import { readJson, writeJson } from "../storage/jsonStore.js";

/**
 * Read a serializable object from a JSON file, validating on load.
 * Returns `null` when the file does not exist.
 */
export function loadFromFile<T>(
  filePath: string,
  contract: SerializableContract<T>
): T | null {
  const raw = readJson(filePath);
  if (raw === null) return null;
  return contract.deserialize(raw);
}

/**
 * Write a serializable object to a JSON file through its serialize() transform.
 */
export function saveToFile<T>(
  filePath: string,
  value: T,
  contract: SerializableContract<T>
): void {
  writeJson(filePath, contract.serialize(value));
}
