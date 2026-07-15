/**
 * Tests for TemplateStore — lazy-loading queryable knowledge base.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeJson } from "../storage/jsonStore.js";
import { TemplateStore, type TemplateEntry } from "./TemplateStore.js";

// ── Sample types ──

interface EndpointTemplate extends TemplateEntry {
  id: string;
  category: string;
  method: string;
  path: string;
  description: string;
}

// ── Helpers ──

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tmplstore-test-"));
}

const sampleTemplates: EndpointTemplate[] = [
  { id: "openai-chat", category: "llm", method: "POST", path: "/v1/chat/completions", description: "OpenAI Chat" },
  { id: "openai-models", category: "llm", method: "GET", path: "/v1/models", description: "List models" },
  { id: "github-repos", category: "api", method: "GET", path: "/user/repos", description: "GitHub repos" },
];

// ── Tests ──

describe("TemplateStore", () => {
  let dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs) {
      fs.rmSync(d, { recursive: true, force: true });
    }
    dirs = [];
  });

  function createStore(entries?: EndpointTemplate[]): { store: TemplateStore<EndpointTemplate>; filePath: string } {
    const dir = tempDir();
    dirs.push(dir);
    const filePath = path.join(dir, "templates.json");
    if (entries) {
      writeJson(filePath, entries);
    }
    return { store: new TemplateStore<EndpointTemplate>(filePath), filePath };
  }

  describe("loading", () => {
    it("loads entries lazily on first access", () => {
      const { store } = createStore(sampleTemplates);
      expect(store.isLoaded).toBe(false);

      const entries = store.all();
      expect(store.isLoaded).toBe(true);
      expect(entries).toHaveLength(3);
    });

    it("returns empty array when file does not exist", () => {
      const { store } = createStore();
      expect(store.all()).toEqual([]);
    });

    it("reload forces re-read from disk", () => {
      const { store, filePath } = createStore(sampleTemplates);
      expect(store.count).toBe(3);

      // Write new data directly to file
      writeJson(filePath, [...sampleTemplates, {
        id: "new-one", category: "llm", method: "POST", path: "/v1/new", description: "New",
      }]);

      store.reload();
      expect(store.count).toBe(4);
    });
  });

  describe("get", () => {
    it("retrieves by dedup key (default: id)", () => {
      const { store } = createStore(sampleTemplates);
      const tmpl = store.get("openai-chat");
      expect(tmpl).toBeDefined();
      expect(tmpl!.method).toBe("POST");
    });

    it("returns undefined for missing key", () => {
      const { store } = createStore(sampleTemplates);
      expect(store.get("nonexistent")).toBeUndefined();
    });
  });

  describe("filter", () => {
    it("filters by exact field match", () => {
      const { store } = createStore(sampleTemplates);
      const results = store.filter({ method: "GET" });
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.method === "GET")).toBe(true);
    });

    it("filters by substring (case-insensitive for strings)", () => {
      const { store } = createStore(sampleTemplates);
      // "chat" appears in "OpenAI Chat" description
      const results = store.filter({ description: "chat" });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("openai-chat");
    });

    it("returns all when no criteria given", () => {
      const { store } = createStore(sampleTemplates);
      expect(store.filter({})).toHaveLength(3);
    });

    it("filters by multiple criteria (AND)", () => {
      const { store } = createStore(sampleTemplates);
      const results = store.filter({ category: "llm", method: "POST" });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("openai-chat");
    });
  });

  describe("queryDeduped", () => {
    it("deduplicates results by dedup key", () => {
      // Create entries with same id
      const entries = [
        { id: "dup", category: "a", method: "GET", path: "/a", description: "A" },
        { id: "dup", category: "b", method: "POST", path: "/b", description: "B" },
      ];
      const { store } = createStore(entries);

      const results = store.queryDeduped({});
      expect(results).toHaveLength(1);
    });
  });

  describe("groupBy", () => {
    it("groups entries by a field value", () => {
      const { store } = createStore(sampleTemplates);
      const groups = store.groupBy("category");

      expect(groups.get("llm")).toHaveLength(2);
      expect(groups.get("api")).toHaveLength(1);
    });
  });

  describe("distinctValues", () => {
    it("returns sorted distinct values for a field", () => {
      const { store } = createStore(sampleTemplates);
      const methods = store.distinctValues("method");
      expect(methods).toEqual(["GET", "POST"]);
    });
  });

  describe("toMarkdownTable", () => {
    it("formats entries as a pipe table", () => {
      const { store } = createStore(sampleTemplates);
      const table = store.toMarkdownTable(store.all(), ["id", "method", "description"]);

      expect(table).toContain("| id | method | description |");
      expect(table).toContain("| --- | --- | --- |");
      expect(table).toContain("| openai-chat | POST | OpenAI Chat |");
    });

    it("returns placeholder for empty entries", () => {
      const { store } = createStore([]);
      const table = store.toMarkdownTable(store.all(), ["id"]);
      expect(table).toBe("_No matching entries._");
    });
  });

  describe("upsert / remove", () => {
    it("upserts new entry at the end", () => {
      const { store } = createStore(sampleTemplates);
      const entry: EndpointTemplate = { id: "new", category: "api", method: "DELETE", path: "/x", description: "New" };
      store.upsert(entry);
      expect(store.count).toBe(4);
      expect(store.all()[3]).toEqual(entry);
    });

    it("upsert replaces existing entry by dedup key", () => {
      const { store } = createStore(sampleTemplates);
      store.upsert({ ...sampleTemplates[0], method: "PUT" });
      expect(store.get("openai-chat")!.method).toBe("PUT");
      expect(store.count).toBe(3); // count unchanged
    });

    it("removes by dedup key", () => {
      const { store } = createStore(sampleTemplates);
      expect(store.remove("openai-chat")).toBe(true);
      expect(store.count).toBe(2);
      expect(store.get("openai-chat")).toBeUndefined();
    });

    it("remove returns false for missing key", () => {
      const { store } = createStore(sampleTemplates);
      expect(store.remove("nope")).toBe(false);
    });
  });

  describe("saveToFile", () => {
    it("persists in-memory changes to disk", () => {
      const { store, filePath } = createStore(sampleTemplates);
      store.upsert({ id: "saved", category: "api", method: "PATCH", path: "/y", description: "Saved" });
      store.saveToFile();

      // Create a new store pointing to the same file
      const store2 = new TemplateStore<EndpointTemplate>(filePath);
      expect(store2.count).toBe(4);
      expect(store2.get("saved")).toBeDefined();
    });
  });
});
