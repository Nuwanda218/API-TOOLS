/**
 * Generic template knowledge base with lazy loading and hierarchical queries.
 *
 * Stores and queries structured templates (e.g. API endpoint presets,
 * skill definitions, prompt templates). Templates are loaded from a JSON
 * file on first access and can be filtered by any combination of fields.
 *
 * Adapted from the Python bibliometrics project:
 *   03_task_agents/template_loader.py
 *
 * Key differences:
 *   - Generic <T> instead of domain-specific paper templates
 *   - Multi-criteria filter() with partial matching
 *   - Deduplication by configurable key
 *   - Human-readable Markdown formatting for LLM consumption
 */

import { readJsonSafe, writeJson } from "../storage/jsonStore.js";

// ── Types ──

/** A template entry must have at least an id field. */
export interface TemplateEntry {
  id: string;
  [key: string]: unknown;
}

/** Filter criteria: all provided fields must match (partial === substring match for strings). */
export type TemplateFilter<T extends TemplateEntry> = Partial<Record<keyof T, T[keyof T]>>;

// ── TemplateStore ──

export class TemplateStore<T extends TemplateEntry> {
  private entries: T[] | null = null;
  private readonly filePath: string;

  /**
   * @param filePath - Absolute path to the JSON file containing template array.
   * @param dedupKey - Field to deduplicate on (default: "id").
   */
  constructor(
    filePath: string,
    private readonly dedupKey: keyof T = "id" as keyof T
  ) {
    this.filePath = filePath;
  }

  // ── Loading ──

  /**
   * Ensure templates are loaded (idempotent).
   * Called automatically by all query methods.
   */
  load(): void {
    if (this.entries !== null) return;
    this.entries = readJsonSafe<T[]>(this.filePath, []);
  }

  /**
   * Force reload from disk (discards in-memory cache).
   */
  reload(): void {
    this.entries = null;
    this.load();
  }

  /** Whether the store has been loaded. */
  get isLoaded(): boolean {
    return this.entries !== null;
  }

  /** Number of entries currently loaded. */
  get count(): number {
    this.load();
    return this.entries!.length;
  }

  // ── Access ──

  /** Return all loaded entries. */
  all(): T[] {
    this.load();
    return [...this.entries!];
  }

  /** Get a single entry by its dedup key. */
  get(key: string): T | undefined {
    this.load();
    return this.entries!.find((e) => String(e[this.dedupKey]) === key);
  }

  // ── Query ──

  /**
   * Filter entries by matching criteria.
   *
   * For string fields, the filter value is matched as a case-insensitive
   * substring. For other types, exact equality is used.
   */
  filter(criteria: TemplateFilter<T>): T[] {
    this.load();
    if (Object.keys(criteria).length === 0) {
      return this.all();
    }

    return this.entries!.filter((entry) =>
      Object.entries(criteria).every(([key, value]) => {
        const entryValue = entry[key];
        if (typeof value === "string" && typeof entryValue === "string") {
          return entryValue.toLowerCase().includes(value.toLowerCase());
        }
        return entryValue === value;
      })
    );
  }

  /**
   * Query and deduplicate by the dedup key.
   * Returns the first match for each unique dedup key value.
   */
  queryDeduped(criteria: TemplateFilter<T>): T[] {
    const matches = this.filter(criteria);
    const seen = new Set<string>();
    return matches.filter((entry) => {
      const key = String(entry[this.dedupKey]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ── Grouping ──

  /**
   * Group entries by a field value.
   * Returns a Map of field value → matching entries.
   */
  groupBy<K extends keyof T>(field: K): Map<string, T[]> {
    this.load();
    const groups = new Map<string, T[]>();
    for (const entry of this.entries!) {
      const key = String(entry[field] ?? "undefined");
      const group = groups.get(key) ?? [];
      group.push(entry);
      groups.set(key, group);
    }
    return groups;
  }

  /**
   * List all distinct values of a field across all entries.
   */
  distinctValues<K extends keyof T>(field: K): string[] {
    this.load();
    const values = new Set<string>();
    for (const entry of this.entries!) {
      values.add(String(entry[field] ?? ""));
    }
    return [...values].sort();
  }

  // ── Formatting ──

  /**
   * Format entries as a Markdown table suitable for LLM consumption.
   * Only includes the specified columns.
   */
  toMarkdownTable(entries: T[], columns: Array<keyof T>): string {
    if (entries.length === 0) return "_No matching entries._";

    const headers = columns.map(String);
    const headerRow = `| ${headers.join(" | ")} |`;
    const separator = `| ${headers.map(() => "---").join(" | ")} |`;

    const rows = entries.map((entry) => {
      const cells = columns.map((col) => {
        const val = entry[col];
        if (val === undefined || val === null) return "";
        const str = typeof val === "string" ? val : JSON.stringify(val);
        // Escape pipe characters in cell content
        return str.replace(/\|/g, "\\|").replace(/\n/g, " ");
      });
      return `| ${cells.join(" | ")} |`;
    });

    return [headerRow, separator, ...rows].join("\n");
  }

  // ── Mutation ──

  /**
   * Add or replace an entry (keyed by dedup key).
   * Does NOT persist to disk — call saveToFile() separately.
   */
  upsert(entry: T): void {
    this.load();
    const idx = this.entries!.findIndex(
      (e) => e[this.dedupKey] === entry[this.dedupKey]
    );
    if (idx >= 0) {
      this.entries![idx] = entry;
    } else {
      this.entries!.push(entry);
    }
  }

  /**
   * Remove an entry by its dedup key value.
   * Does NOT persist to disk.
   */
  remove(key: string): boolean {
    this.load();
    const idx = this.entries!.findIndex(
      (e) => String(e[this.dedupKey]) === key
    );
    if (idx < 0) return false;
    this.entries!.splice(idx, 1);
    return true;
  }

  /**
   * Persist the current in-memory entries back to the JSON file.
   */
  saveToFile(): void {
    this.load();
    writeJson(this.filePath, this.entries);
  }
}
