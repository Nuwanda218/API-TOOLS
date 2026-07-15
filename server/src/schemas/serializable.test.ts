/**
 * Tests for the serializable contract pattern.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  identityContract,
  loadFromFile,
  saveToFile,
  transformedContract,
} from "./serializable.js";

// ── Sample domain types ──

const CapabilitySchema = z.object({
  state: z.enum(["pass", "partial", "fail", "unknown"]),
  note: z.string(),
});

type Capability = z.infer<typeof CapabilitySchema>;

// ── Helpers ──

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "schema-test-"));
}

// ── Tests ──

describe("identityContract", () => {
  it("creates a contract with Zod validation", () => {
    const contract = identityContract(CapabilitySchema);

    const valid = contract.deserialize({ state: "pass", note: "ok" });
    expect(valid).toEqual({ state: "pass", note: "ok" });

    expect(() => contract.deserialize({ state: "invalid", note: "" })).toThrow();
  });

  it("serialize is identity (raw JSON-compatible)", () => {
    const contract = identityContract(CapabilitySchema);
    const value: Capability = { state: "pass", note: "done" };

    const serialized = contract.serialize(value);
    expect(serialized).toEqual(value);
    // identityContract returns the value as-is (it IS already JSON-compatible)
  });
});

describe("transformedContract", () => {
  const DateRecordSchema = z.object({
    label: z.string(),
    timestamp: z.number(),
  });

  interface DateRecord {
    label: string;
    timestamp: Date;
  }

  const contract = transformedContract<DateRecord>(DateRecordSchema, {
    serialize: (v) => ({ label: v.label, timestamp: v.timestamp.getTime() }),
    deserialize: (raw) => {
      const parsed = DateRecordSchema.parse(raw);
      return { label: parsed.label, timestamp: new Date(parsed.timestamp) };
    },
  });

  it("transforms between in-memory and persisted shapes", () => {
    const value: DateRecord = { label: "test", timestamp: new Date(1700000000000) };

    const serialized = contract.serialize(value);
    expect(serialized).toEqual({ label: "test", timestamp: 1700000000000 });

    const deserialized = contract.deserialize(serialized);
    expect(deserialized.timestamp).toBeInstanceOf(Date);
    expect(deserialized.timestamp.getTime()).toBe(1700000000000);
  });
});

describe("loadFromFile / saveToFile", () => {
  let dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) {
      fs.rmSync(d, { recursive: true, force: true });
    }
    dirs = [];
  });

  function createTempDir(): string {
    const d = tempDir();
    dirs.push(d);
    return d;
  }

  const contract = identityContract(CapabilitySchema);

  it("round-trips an object through file save/load", () => {
    const dir = createTempDir();
    const filePath = path.join(dir, "cap.json");
    const value: Capability = { state: "pass", note: "all good" };

    saveToFile(filePath, value, contract);
    const loaded = loadFromFile(filePath, contract);

    expect(loaded).toEqual(value);
  });

  it("returns null when file does not exist", () => {
    const dir = createTempDir();
    const result = loadFromFile(path.join(dir, "missing.json"), contract);
    expect(result).toBeNull();
  });

  it("throws when file contains invalid data", () => {
    const dir = createTempDir();
    const filePath = path.join(dir, "bad.json");
    fs.writeFileSync(filePath, '{"state": "nope", "note": ""}', "utf-8");

    expect(() => loadFromFile(filePath, contract)).toThrow();
  });
});
