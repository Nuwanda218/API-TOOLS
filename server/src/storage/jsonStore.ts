/**
 * JSON file persistence with automatic archiving.
 *
 * All reads/writes auto-create parent directories. The archive function
 * copies the current file to an archive directory with a timestamped name
 * before the next write, so every change is recoverable.
 *
 * Adapted from:
 *   04_model_service/llm_gateway/storage.py (read_json, write_json, archive_json)
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ── Timestamp utilities ──

/** ISO 8601 timestamp in UTC. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Filesystem-safe timestamp (e.g. "20260715T143022"). */
export function timestampForFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

// ── JSON read/write ──

/**
 * Write a value as JSON to disk. Creates parent directories automatically.
 * Uses 2-space indent and keeps non-ASCII characters unescaped.
 */
export function writeJson(filePath: string, data: unknown, indent: number = 2): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, indent), "utf-8");
}

/**
 * Read and parse a JSON file. Returns `fallback` (default `null`) when the
 * file does not exist. Throws on parse errors so callers don't silently
 * consume corrupted data.
 */
export function readJson<T = unknown>(filePath: string): T | null;
export function readJson<T>(filePath: string, fallback: T): T;
export function readJson<T>(filePath: string, fallback: T | null = null): T | null {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

/**
 * Read a JSON file, returning `fallback` when the file is missing *or* the
 * content cannot be parsed. Use when the file may be hand-edited or
 * partially written.
 */
export function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    return readJson<T>(filePath, fallback);
  } catch {
    return fallback;
  }
}

// ── Archiving ──

/**
 * Copy a JSON file to an archive directory with a timestamped name.
 *
 * Archive filenames follow the pattern `{label}_{timestamp}.json`.
 * Returns the destination path, or `null` when the source file doesn't exist.
 *
 * Example:
 *   archiveJson("runtime_data/capabilities.json", "runtime_data/archive", "capabilities")
 *   // → "runtime_data/archive/capabilities_20260715T143022.json"
 */
export function archiveJson(
  srcPath: string,
  archiveDir: string,
  label: string = ""
): string | null {
  if (!fs.existsSync(srcPath)) {
    return null;
  }

  const ts = timestampForFilename();
  const prefix = label ? `${label}_` : "";
  const dest = path.join(archiveDir, `${prefix}${ts}.json`);

  const data = readJson(srcPath);
  writeJson(dest, data);
  return dest;
}

/**
 * Atomically write a JSON file: write to a temp file first, then rename.
 * Prevents readers from seeing a partially-written file.
 */
export function writeJsonAtomic(filePath: string, data: unknown, indent: number = 2): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, indent), "utf-8");
  fs.renameSync(tmp, filePath);
}

/**
 * Write JSON with automatic archiving: archive the existing file first,
 * then write the new content atomically.
 *
 * Returns the archive path if archiving occurred, or null.
 */
export function writeJsonArchived(
  filePath: string,
  data: unknown,
  archiveDirectory: string,
  label: string = "",
  indent: number = 2
): string | null {
  const archived = archiveJson(filePath, archiveDirectory, label);
  writeJsonAtomic(filePath, data, indent);
  return archived;
}
