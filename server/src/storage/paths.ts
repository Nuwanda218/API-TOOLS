/**
 * Centralized path management for runtime data and archives.
 *
 * All persisted runtime files (models cache, capabilities, probe history)
 * use paths derived from a single runtime root, so they stay consistent
 * across the application.
 *
 * Adapted from:
 *   04_model_service/llm_gateway/storage.py (runtime_dir, probe_runs_dir, fixed paths)
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ── Runtime roots ──

/** Absolute path to the server package root (two levels up from this file). */
function serverRoot(): string {
  return path.resolve(__dirname, "..", "..");
}

/**
 * Absolute path to the runtime_data/ directory.
 * Created automatically if it doesn't exist.
 */
export function runtimeDir(): string {
  const dir = path.join(serverRoot(), "runtime_data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Absolute path to the runtime_data/probe_runs/ archive directory.
 * Created automatically if it doesn't exist.
 */
export function probeRunsDir(): string {
  const dir = path.join(runtimeDir(), "probe_runs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Absolute path to the runtime_data/archive/ directory for general file archives.
 * Created automatically if it doesn't exist.
 */
export function archiveDir(): string {
  const dir = path.join(runtimeDir(), "archive");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Fixed paths for known runtime files ──

/** Absolute path to models.json cache. */
export function modelsPath(): string {
  return path.join(runtimeDir(), "models.json");
}

/** Absolute path to capabilities.json result file. */
export function capabilitiesPath(): string {
  return path.join(runtimeDir(), "capabilities.json");
}

/** Absolute path to the project root (three levels up from this file). */
export function projectRoot(): string {
  return path.resolve(__dirname, "..", "..", "..");
}
