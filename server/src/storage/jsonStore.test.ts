/**
 * Tests for jsonStore — JSON persistence with archiving.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  archiveJson,
  nowIso,
  readJson,
  readJsonSafe,
  timestampForFilename,
  writeJson,
  writeJsonArchived,
  writeJsonAtomic,
} from "./jsonStore.js";

// ── Helpers ──

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "jsonstore-test-"));
}

// ── Tests ──

describe("jsonStore", () => {
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

  describe("writeJson / readJson", () => {
    it("writes and reads a JSON object with auto-created directories", () => {
      const dir = createTempDir();
      const filePath = path.join(dir, "deep", "nested", "data.json");

      writeJson(filePath, { hello: "world", count: 42 });

      expect(fs.existsSync(filePath)).toBe(true);
      const data = readJson<{ hello: string; count: number }>(filePath);
      expect(data).toEqual({ hello: "world", count: 42 });
    });

    it("returns null when file does not exist", () => {
      const dir = createTempDir();
      const result = readJson(path.join(dir, "nonexistent.json"));
      expect(result).toBeNull();
    });

    it("returns custom fallback when file does not exist", () => {
      const dir = createTempDir();
      const fallback = { default: true };
      const result = readJson(path.join(dir, "nonexistent.json"), fallback);
      expect(result).toBe(fallback);
    });
  });

  describe("readJsonSafe", () => {
    it("returns fallback on corrupted JSON", () => {
      const dir = createTempDir();
      const filePath = path.join(dir, "corrupt.json");
      fs.writeFileSync(filePath, "{not valid json!!!", "utf-8");

      const result = readJsonSafe(filePath, { safe: true });
      expect(result).toEqual({ safe: true });
    });

    it("returns parsed data when JSON is valid", () => {
      const dir = createTempDir();
      const filePath = path.join(dir, "valid.json");
      writeJson(filePath, { ok: true });

      const result = readJsonSafe(filePath, { safe: false });
      expect(result).toEqual({ ok: true });
    });

    it("returns fallback when file is missing", () => {
      const dir = createTempDir();
      const result = readJsonSafe(path.join(dir, "gone.json"), []);
      expect(result).toEqual([]);
    });
  });

  describe("archiveJson", () => {
    it("copies source to archive dir with timestamped filename", () => {
      const dir = createTempDir();
      const archiveDir = path.join(dir, "archive");
      const srcPath = path.join(dir, "data.json");

      writeJson(srcPath, { version: 1 });

      const dest = archiveJson(srcPath, archiveDir, "data");

      expect(dest).not.toBeNull();
      expect(dest!).toMatch(/data_\d{8}T\d{6}\.json$/);
      expect(fs.existsSync(dest!)).toBe(true);

      const archived = readJson<{ version: number }>(dest!);
      expect(archived).toEqual({ version: 1 });
    });

    it("returns null when source file does not exist", () => {
      const dir = createTempDir();
      const result = archiveJson(path.join(dir, "missing.json"), path.join(dir, "archive"));
      expect(result).toBeNull();
    });

    it("works without a label prefix", () => {
      const dir = createTempDir();
      const archiveDir = path.join(dir, "archive");
      const srcPath = path.join(dir, "data.json");

      writeJson(srcPath, { x: 1 });
      const dest = archiveJson(srcPath, archiveDir);

      expect(dest).not.toBeNull();
      expect(dest!).toMatch(/\d{8}T\d{6}\.json$/);
    });
  });

  describe("writeJsonAtomic", () => {
    it("does not leave a .tmp file after writing", () => {
      const dir = createTempDir();
      const filePath = path.join(dir, "atomic.json");

      writeJsonAtomic(filePath, { atomic: true });

      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.existsSync(filePath + ".tmp")).toBe(false);

      const data = readJson<{ atomic: boolean }>(filePath);
      expect(data).toEqual({ atomic: true });
    });
  });

  describe("writeJsonArchived", () => {
    it("archives old content before writing new content", () => {
      const dir = createTempDir();
      const archiveDir = path.join(dir, "archive");
      const filePath = path.join(dir, "config.json");

      // First write (no archive yet — archive dir may not exist)
      writeJson(filePath, { version: 1 });
      // archiveJson will create the archive dir on first call, so
      // it is fine for it to not exist yet at this point.

      // Second write with archiving
      const archivedPath = writeJsonArchived(filePath, { version: 2 }, archiveDir, "config");

      expect(archivedPath).not.toBeNull();
      expect(fs.existsSync(archivedPath!)).toBe(true);

      // Current file has new content
      const current = readJson<{ version: number }>(filePath);
      expect(current).toEqual({ version: 2 });

      // Archived file has old content
      const archived = readJson<{ version: number }>(archivedPath!);
      expect(archived).toEqual({ version: 1 });
    });

    it("returns null archive path when source doesn't exist yet", () => {
      const dir = createTempDir();
      const archiveDir = path.join(dir, "archive");
      const filePath = path.join(dir, "new.json");

      const archivedPath = writeJsonArchived(filePath, { first: true }, archiveDir, "new");

      expect(archivedPath).toBeNull();
      expect(readJson<{ first: boolean }>(filePath)).toEqual({ first: true });
    });
  });

  describe("timestamp utilities", () => {
    it("nowIso returns valid ISO 8601", () => {
      const iso = nowIso();
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("timestampForFilename returns compact format", () => {
      const ts = timestampForFilename();
      expect(ts).toMatch(/^\d{8}T\d{6}$/);
    });
  });
});
