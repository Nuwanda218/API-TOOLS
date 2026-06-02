import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic, type SqlValue } from "sql.js";
import { applySchema } from "./schema.js";

type AppNamedParams = Record<string, SqlValue>;
type AppStatementParams = SqlValue[] | [AppNamedParams];

export interface AppStatement {
  run(...params: SqlValue[]): void;
  run(params: AppNamedParams): void;
  get<T>(...params: SqlValue[]): T | undefined;
  get<T>(params: AppNamedParams): T | undefined;
  all<T>(...params: SqlValue[]): T[];
  all<T>(params: AppNamedParams): T[];
}

export interface AppDatabase {
  exec(sql: string): void;
  prepare(sql: string): AppStatement;
  close(): void;
}

let sqlRuntime: SqlJsStatic | null = null;

export async function initializeSqlRuntime() {
  sqlRuntime = await initSqlJs();
}

export function createDatabase(path: string): AppDatabase {
  if (!sqlRuntime) {
    throw new Error("SQL runtime not initialized. Call initializeSqlRuntime() before createDatabase().");
  }

  const db = path === ":memory:" || !existsSync(path)
    ? new sqlRuntime.Database()
    : new sqlRuntime.Database(readFileSync(path));
  db.run("pragma foreign_keys = ON");
  const appDb = createAppDatabase(db, path === ":memory:" ? undefined : path);
  applySchema(appDb);
  return appDb;
}

function normalizeParams(params: AppStatementParams): SqlValue[] | AppNamedParams {
  if (params.length === 1 && isPlainObject(params[0])) {
    return Object.fromEntries(
      Object.entries(params[0]).map(([key, value]) => [key.startsWith("@") ? key : `@${key}`, value])
    );
  }

  return params as SqlValue[];
}

function isPlainObject(value: unknown): value is AppNamedParams {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowsToObjects<T>(columns: string[], values: SqlValue[][]): T[] {
  return values.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])) as T);
}

function createAppDatabase(db: SqlJsDatabase, filePath?: string): AppDatabase {
  return {
    exec(sql) {
      db.run(sql);
    },
    prepare(sql) {
      function all<T>(...params: AppStatementParams) {
        const result = db.exec(sql, normalizeParams(params));
        if (result.length === 0) return [];
        return rowsToObjects<T>(result[0].columns, result[0].values);
      }

      return {
        run(...params: AppStatementParams) {
          db.run(sql, normalizeParams(params));
        },
        get<T>(...params: AppStatementParams) {
          return all<T>(...params)[0];
        },
        all
      };
    },
    close() {
      if (filePath) {
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, db.export());
      }
      db.close();
    }
  };
}
