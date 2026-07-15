/**
 * Pluggable step type registry for workflow extensibility.
 *
 * Currently the workflow runner only supports three hardcoded step types
 * (llm.chat, endpoint.call, mcp.call). The registry allows any module to
 * register additional step types without modifying the runner source.
 *
 * Adapted from the Python bibliometrics project:
 *   05_data_preprocessing/data_probe.py (decorator-based probe registration)
 *
 * TypeScript adaptation uses a class-based registry instead of decorators
 * to avoid experimentalDecorators configuration.
 */

import type { ZodType } from "zod";

// ── Step handler type ──

/**
 * A step handler receives validated input and returns a result.
 * The shape of input/output is defined by the step type's schema.
 */
export type StepHandler<TInput = Record<string, unknown>, TOutput = Record<string, unknown>> = (
  input: TInput
) => Promise<TOutput>;

// ── Step type definition ──

export interface StepTypeDefinition<TInput = Record<string, unknown>, TOutput = Record<string, unknown>> {
  /** Unique step type identifier (e.g. "image.generate", "data.transform"). */
  type: string;
  /** Human-readable description shown in the UI catalog. */
  description: string;
  /** Zod schema for validating step input at registration time. */
  inputSchema?: ZodType<TInput>;
  /** The handler function. */
  handler: StepHandler<TInput, TOutput>;
}

// ── Registry ──

export class StepRegistry {
  private readonly types = new Map<string, StepTypeDefinition>();

  /**
   * Register a new step type. Throws if the type name is already registered.
   *
   * @returns The registry instance (for chaining).
   */
  register<TInput = Record<string, unknown>, TOutput = Record<string, unknown>>(
    definition: StepTypeDefinition<TInput, TOutput>
  ): this {
    if (this.types.has(definition.type)) {
      throw new Error(`Step type already registered: "${definition.type}"`);
    }
    this.types.set(definition.type, definition as StepTypeDefinition);
    return this;
  }

  /**
   * Unregister a step type. Returns false if not found.
   */
  unregister(type: string): boolean {
    return this.types.delete(type);
  }

  /**
   * Check whether a step type is registered.
   */
  has(type: string): boolean {
    return this.types.has(type);
  }

  /**
   * Get a step type definition. Returns undefined if not found.
   */
  get(type: string): StepTypeDefinition | undefined {
    return this.types.get(type);
  }

  /**
   * Execute a step by type name, throwing if the type is not registered.
   */
  async execute(type: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const def = this.types.get(type);
    if (!def) {
      throw new Error(`Unknown step type: "${type}". Registered types: ${this.listTypes().join(", ")}`);
    }

    // Validate input if a schema is provided
    if (def.inputSchema) {
      def.inputSchema.parse(input);
    }

    return def.handler(input);
  }

  /**
   * List all registered step type identifiers.
   */
  listTypes(): string[] {
    return [...this.types.keys()].sort();
  }

  /**
   * Return a human-readable catalog of all registered step types,
   * suitable for display in a UI or API response.
   */
  catalog(): Array<{ type: string; description: string }> {
    return [...this.types.values()]
      .map((def) => ({ type: def.type, description: def.description }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }

  /**
   * Number of registered step types.
   */
  get size(): number {
    return this.types.size;
  }
}

// ── Singleton ──

/** Global step registry instance. Modules import this to register step types. */
export const stepRegistry = new StepRegistry();
