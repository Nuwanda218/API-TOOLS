/**
 * Tests for StepRegistry — pluggable workflow step types.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { StepRegistry } from "./StepRegistry.js";

describe("StepRegistry", () => {
  function createRegistry() {
    return new StepRegistry();
  }

  describe("register / has / get", () => {
    it("registers a step type and retrieves it", () => {
      const registry = createRegistry();
      const handler = async (input: { x: number }) => ({ doubled: input.x * 2 });

      registry.register({
        type: "math.double",
        description: "Doubles a number",
        handler,
      });

      expect(registry.has("math.double")).toBe(true);
      expect(registry.get("math.double")?.description).toBe("Doubles a number");
      expect(registry.size).toBe(1);
    });

    it("throws on duplicate registration", () => {
      const registry = createRegistry();
      registry.register({ type: "test", description: "First", handler: async () => ({}) });

      expect(() =>
        registry.register({ type: "test", description: "Second", handler: async () => ({}) })
      ).toThrow('already registered: "test"');
    });

    it("returns undefined for unknown type", () => {
      const registry = createRegistry();
      expect(registry.get("nonexistent")).toBeUndefined();
      expect(registry.has("nonexistent")).toBe(false);
    });
  });

  describe("unregister", () => {
    it("removes a registered type", () => {
      const registry = createRegistry();
      registry.register({ type: "temp", description: "", handler: async () => ({}) });

      expect(registry.unregister("temp")).toBe(true);
      expect(registry.has("temp")).toBe(false);
    });

    it("returns false for unknown type", () => {
      const registry = createRegistry();
      expect(registry.unregister("nope")).toBe(false);
    });
  });

  describe("execute", () => {
    it("calls the registered handler with input", async () => {
      const registry = createRegistry();
      registry.register({
        type: "greet",
        description: "Greets",
        handler: async (input: { name: string }) => ({ greeting: `Hello, ${input.name}` }),
      });

      const result = await registry.execute("greet", { name: "World" });
      expect(result).toEqual({ greeting: "Hello, World" });
    });

    it("throws for unregistered type", async () => {
      const registry = createRegistry();
      await expect(registry.execute("unknown", {})).rejects.toThrow('Unknown step type: "unknown"');
    });

    it("validates input when schema is provided", async () => {
      const registry = createRegistry();
      const schema = z.object({ count: z.number() });

      registry.register({
        type: "counter",
        description: "Counts",
        inputSchema: schema,
        handler: async (input) => ({ doubled: (input as { count: number }).count * 2 }),
      });

      await expect(registry.execute("counter", { count: "not-a-number" })).rejects.toThrow();
    });

    it("lists registered types in catalog", () => {
      const registry = createRegistry();
      registry.register({ type: "b", description: "Second", handler: async () => ({}) });
      registry.register({ type: "a", description: "First", handler: async () => ({}) });

      const catalog = registry.catalog();
      expect(catalog).toEqual([
        { type: "a", description: "First" },
        { type: "b", description: "Second" },
      ]);
    });

    it("listTypes returns sorted identifiers", () => {
      const registry = createRegistry();
      registry.register({ type: "z.last", description: "", handler: async () => ({}) });
      registry.register({ type: "a.first", description: "", handler: async () => ({}) });

      expect(registry.listTypes()).toEqual(["a.first", "z.last"]);
    });
  });

  describe("singleton", () => {
    it("the global stepRegistry is an instance of StepRegistry", async () => {
      const mod = await import("./StepRegistry.js");
      expect(mod.stepRegistry).toBeInstanceOf(StepRegistry);
    });
  });
});
