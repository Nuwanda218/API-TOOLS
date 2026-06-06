# API Tools V0.1 Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working local API Tools prototype with project scaffolding, SQLite-backed provider/model management, OpenAI-compatible model testing, and a framework-oriented workflow workbench whose first executable step type is `llm.chat`.

**Architecture:** Use a Vite React frontend and an Express backend in one TypeScript workspace. The backend owns API keys, SQLite persistence, provider adapters, workflow execution, and usage records; the frontend calls only local `/api/*` endpoints. The implementation deliberately keeps image2, advanced usage dashboards, visual workflow editing, arbitrary HTTP API steps, and conditional branching out of this first plan so this phase can ship independently while still establishing the framework boundary.

**Tech Stack:** Node.js, TypeScript, npm workspaces, Vite, React, Express, sql.js, Vitest, React Testing Library, Supertest, Zod.

---

## Scope for this plan

This plan implements the first testable slice from `docs/superpowers/specs/2026-05-28-api-tools-design.md`:

- Project skeleton.
- Backend health endpoint.
- SQLite schema for providers, models, sessions, messages, runs, and run steps.
- `.env`-based API key lookup.
- Provider/model CRUD.
- OpenAI-compatible adapter and model test endpoint.
- Generic workflow execution with a first `llm.chat` step and run/run_step persistence.
- Frontend top navigation, API接入 page, 模型管理 page, 工作台 page, and minimal 用量检测 summary.

Deferred to later plans:

- GPT image2 adapter and UI.
- Rich usage analytics page.
- Visual workflow template editor.
- Arbitrary HTTP/API step execution.
- Conditional branching, loops, retries, and multi-step dependency wiring.
- Model comparison workflow.
- Generate/review multi-model workflows.
- Desktop packaging or private deployment.

## File structure

Create these files:

```text
package.json
.gitignore
.env.example
tsconfig.base.json
server/package.json
server/tsconfig.json
server/vitest.config.ts
server/src/app.ts
server/src/index.ts
server/src/config/env.ts
server/src/db/client.ts
server/src/db/schema.ts
server/src/db/seed.ts
server/src/errors/providerError.ts
server/src/providers/providerRepository.ts
server/src/providers/modelRepository.ts
server/src/adapters/types.ts
server/src/adapters/openaiCompatible.ts
server/src/workflows/types.ts
server/src/workflows/runner.ts
server/src/usage/usageService.ts
server/src/routes/health.ts
server/src/routes/providers.ts
server/src/routes/models.ts
server/src/routes/workflows.ts
server/src/routes/usage.ts
server/src/test/testDb.ts
server/src/**/*.test.ts
client/package.json
client/index.html
client/tsconfig.json
client/vite.config.ts
client/vitest.config.ts
client/src/main.tsx
client/src/App.tsx
client/src/api/client.ts
client/src/api/types.ts
client/src/components/TopNav.tsx
client/src/pages/WorkbenchPage.tsx
client/src/pages/ProvidersPage.tsx
client/src/pages/ModelsPage.tsx
client/src/pages/UsagePage.tsx
client/src/pages/WorkflowTemplatesPage.tsx
client/src/pages/SettingsPage.tsx
client/src/styles.css
client/src/test/setup.ts
client/src/**/*.test.tsx
```

Responsibilities:

- `server/src/app.ts`: builds the Express app for tests and runtime.
- `server/src/index.ts`: starts the local server.
- `server/src/db/*`: owns SQLite connection, schema, and seed data.
- `server/src/providers/*`: owns provider/model persistence, not API calls.
- `server/src/adapters/*`: owns external API request/response translation.
- `server/src/workflows/*`: owns basic workflow execution and run/run_step persistence.
- `server/src/routes/*`: owns HTTP routing only.
- `client/src/api/*`: typed local API client.
- `client/src/pages/*`: top-level module pages matching the design spec.
- `client/src/components/TopNav.tsx`: shared top navigation.

## Task 1: Workspace scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `tsconfig.base.json`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/index.html`

- [ ] **Step 1: Create root workspace files**

Create `package.json`:

```json
{
  "name": "api-tools",
  "private": true,
  "type": "module",
  "workspaces": [
    "server",
    "client"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev --workspace server\" \"npm run dev --workspace client\"",
    "build": "npm run build --workspace server && npm run build --workspace client",
    "test": "npm run test --workspace server && npm run test --workspace client",
    "typecheck": "npm run typecheck --workspace server && npm run typecheck --workspace client"
  },
  "devDependencies": {
    "concurrently": "^9.1.2"
  },
  "engines": {
    "node": ">=20.11.0"
  }
}
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
.env
*.db
*.db-shm
*.db-wal
.superpowers/
.vscode/
coverage/
```

Create `.env.example`:

```env
PORT=8787
DATABASE_PATH=./api-tools.db
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
CUSTOM_OPENAI_COMPATIBLE_KEY=
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 2: Create package files for server and client**

Create `server/package.json`:

```json
{
  "name": "@api-tools/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run --passWithNoTests",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "nanoid": "^5.0.9",
    "sql.js": "^1.12.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.5",
    "@types/sql.js": "^1.4.11",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

Create `server/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

Create `client/package.json`:

```json
{
  "name": "@api-tools/client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 5173",
    "build": "tsc -p tsconfig.json && vite build",
    "test": "vitest run --passWithNoTests",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.7",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

Create `client/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

Create `client/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>API Tools</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Install dependencies**

Run:

```bash
npm install
```

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 4: Run baseline commands**

Run:

```bash
npm run typecheck
```

Expected: this fails because source files do not exist yet. The failure confirms the workspace scripts are wired and later tasks must add source files.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example tsconfig.base.json server/package.json server/tsconfig.json client/package.json client/tsconfig.json client/index.html
git commit -m "chore: scaffold api tools workspace"
```

## Task 2: Backend app, health route, and test harness

**Files:**
- Create: `server/vitest.config.ts`
- Create: `server/src/app.ts`
- Create: `server/src/index.ts`
- Create: `server/src/routes/health.ts`
- Create: `server/src/app.test.ts`

- [ ] **Step 1: Write failing health endpoint test**

Create `server/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true
  }
});
```

Create `server/src/app.test.ts`:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("app", () => {
  it("returns health status", async () => {
    const app = createApp();

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: "api-tools" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test --workspace server -- src/app.test.ts
```

Expected: FAIL because `server/src/app.ts` does not exist.

- [ ] **Step 3: Implement Express app and health route**

Create `server/src/routes/health.ts`:

```ts
import { Router } from "express";

export function createHealthRouter() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ ok: true, service: "api-tools" });
  });

  return router;
}
```

Create `server/src/app.ts`:

```ts
import cors from "cors";
import express from "express";
import { createHealthRouter } from "./routes/health.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: "http://127.0.0.1:5173" }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/health", createHealthRouter());

  return app;
}
```

Create `server/src/index.ts`:

```ts
import dotenv from "dotenv";
import { createApp } from "./app.js";

dotenv.config();

const port = Number(process.env.PORT ?? 8787);
const app = createApp();

app.listen(port, () => {
  console.log(`API Tools server listening on http://127.0.0.1:${port}`);
});
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test --workspace server -- src/app.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/vitest.config.ts server/src/app.ts server/src/index.ts server/src/routes/health.ts server/src/app.test.ts
git commit -m "feat: add express health endpoint"
```

## Task 3: SQLite schema and test database

**Files:**
- Create: `server/src/db/client.ts`
- Create: `server/src/db/schema.ts`
- Create: `server/src/test/testDb.ts`
- Create: `server/src/db/schema.test.ts`

- [ ] **Step 1: Write failing schema test**

Create `server/src/db/schema.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "../test/testDb.js";

const databases: ReturnType<typeof createTestDatabase>[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.close();
  }
});

describe("schema", () => {
  it("creates core tables", () => {
    const database = createTestDatabase();
    databases.push(database);

    const rows = database
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all() as Array<{ name: string }>;

    expect(rows.map((row) => row.name)).toEqual([
      "messages",
      "models",
      "providers",
      "run_steps",
      "runs",
      "sessions"
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test --workspace server -- src/db/schema.test.ts
```

Expected: FAIL because `createTestDatabase` does not exist.

- [ ] **Step 3: Implement schema and test database helper**

Create `server/src/db/schema.ts`:

```ts
import type { AppDatabase } from "./client.js";

export function applySchema(db: AppDatabase) {
  db.exec(`
    create table if not exists providers (
      id text primary key,
      name text not null,
      type text not null check (type in ('openai-compatible', 'openai-official')),
      base_url text not null,
      api_key_env text not null,
      enabled integer not null default 1,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists models (
      id text primary key,
      provider_id text not null references providers(id) on delete cascade,
      display_name text not null,
      model_id text not null,
      capability text not null check (capability in ('chat', 'image', 'multimodal')),
      enabled integer not null default 1,
      default_params_json text not null default '{}',
      pricing_json text not null default '{}',
      created_at text not null,
      updated_at text not null
    );

    create table if not exists sessions (
      id text primary key,
      title text not null,
      workflow_type text not null check (workflow_type in ('chat', 'image-minimal', 'model-test')),
      created_at text not null,
      updated_at text not null
    );

    create table if not exists messages (
      id text primary key,
      session_id text not null references sessions(id) on delete cascade,
      role text not null check (role in ('user', 'assistant', 'system', 'tool')),
      content text not null,
      model_id text references models(id),
      run_id text references runs(id),
      created_at text not null
    );

    create table if not exists runs (
      id text primary key,
      session_id text not null references sessions(id) on delete cascade,
      workflow_type text not null check (workflow_type in ('chat', 'image-minimal', 'model-test')),
      status text not null check (status in ('running', 'succeeded', 'failed')),
      started_at text not null,
      ended_at text,
      total_input_tokens integer,
      total_output_tokens integer,
      total_cost_estimate real
    );

    create table if not exists run_steps (
      id text primary key,
      run_id text not null references runs(id) on delete cascade,
      step_index integer not null,
      step_type text not null check (step_type in ('chat-completion', 'image-generation', 'model-test', 'prompt-optimizer', 'reviewer', 'summarizer')),
      provider_id text not null references providers(id),
      model_id text not null references models(id),
      status text not null check (status in ('running', 'succeeded', 'failed')),
      input_preview text not null,
      output_preview text,
      error_code text,
      error_message text,
      latency_ms integer,
      input_tokens integer,
      output_tokens integer,
      cost_estimate real,
      created_at text not null,
      updated_at text not null
    );
  `);
}
```

Create `server/src/db/client.ts`:

```ts
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from "sql.js";
import { applySchema } from "./schema.js";

export type AppStatementParams = [] | [Record<string, unknown>] | [unknown, ...unknown[]];

export interface AppStatement {
  run(...params: AppStatementParams): void;
  get<T>(...params: AppStatementParams): T | undefined;
  all<T>(...params: AppStatementParams): T[];
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

export function createDatabase(_path: string): AppDatabase {
  if (!sqlRuntime) {
    throw new Error("SQL runtime not initialized. Call initializeSqlRuntime() before createDatabase().");
  }

  const db = new sqlRuntime.Database();
  db.run("pragma foreign_keys = ON");
  const appDb = createAppDatabase(db);
  applySchema(appDb);
  return appDb;
}

function normalizeParams(params: unknown[]): unknown[] | Record<string, unknown> {
  if (params.length === 1 && isPlainObject(params[0])) {
    return Object.fromEntries(
      Object.entries(params[0] as Record<string, unknown>).map(([key, value]) => [key.startsWith("@") ? key : `@${key}`, value])
    );
  }

  return params;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowsToObjects<T>(columns: string[], values: unknown[][]): T[] {
  return values.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index]])) as T);
}

function createAppDatabase(db: SqlJsDatabase): AppDatabase {
  return {
    exec(sql) {
      db.run(sql);
    },
    prepare(sql) {
      return {
        run(...params: unknown[]) {
          db.run(sql, normalizeParams(params));
        },
        get<T>(...params: unknown[]) {
          return this.all<T>(...params)[0];
        },
        all<T>(...params: unknown[]) {
          const result = db.exec(sql, normalizeParams(params));
          if (result.length === 0) return [];
          return rowsToObjects<T>(result[0].columns, result[0].values as unknown[][]);
        }
      };
    },
    close() {
      db.close();
    }
  };
}
```

Create `server/src/test/testDb.ts`:

```ts
import { beforeAll } from "vitest";
import { createDatabase, initializeSqlRuntime } from "../db/client.js";

beforeAll(async () => {
  await initializeSqlRuntime();
});

export function createTestDatabase() {
  return createDatabase(":memory:");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test --workspace server -- src/db/schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/client.ts server/src/db/schema.ts server/src/test/testDb.ts server/src/db/schema.test.ts
git commit -m "feat: add sqlite schema"
```

## Task 4: Provider and model repositories

**Files:**
- Create: `server/src/providers/providerRepository.ts`
- Create: `server/src/providers/modelRepository.ts`
- Create: `server/src/providers/providerRepository.test.ts`
- Create: `server/src/providers/modelRepository.test.ts`

- [x] **Step 1: Write failing provider repository test**

Create `server/src/providers/providerRepository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../test/testDb.js";
import { createProviderRepository } from "./providerRepository.js";

describe("providerRepository", () => {
  it("creates and lists providers without exposing secrets", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);

    const created = providers.create({
      name: "DeepSeek",
      type: "openai-compatible",
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      enabled: true
    });

    expect(created).toMatchObject({
      name: "DeepSeek",
      type: "openai-compatible",
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      enabled: true
    });
    expect(providers.list()).toEqual([created]);

    db.close();
  });
});
```

- [x] **Step 2: Write failing model repository test**

Create `server/src/providers/modelRepository.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../test/testDb.js";
import { createModelRepository } from "./modelRepository.js";
import { createProviderRepository } from "./providerRepository.js";

describe("modelRepository", () => {
  it("creates models for a provider", () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);
    const provider = providers.create({
      name: "OpenAI Compatible",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_OPENAI_COMPATIBLE_KEY",
      enabled: true
    });

    const created = models.create({
      providerId: provider.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: { temperature: 0.2, maxTokens: 512 },
      pricing: { inputTokenPrice: 0.1, outputTokenPrice: 0.2 }
    });

    expect(created).toMatchObject({
      providerId: provider.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: { temperature: 0.2, maxTokens: 512 },
      pricing: { inputTokenPrice: 0.1, outputTokenPrice: 0.2 }
    });
    expect(models.list()).toEqual([created]);

    db.close();
  });
});
```

- [x] **Step 3: Run tests to verify they fail**

Run:

```bash
npm run test --workspace server -- src/providers
```

Expected: FAIL because repositories do not exist.

- [x] **Step 4: Implement provider repository**

Create `server/src/providers/providerRepository.ts`:

```ts
import type { AppDatabase } from "../db/client.js";
import { nanoid } from "nanoid";

export type ProviderType = "openai-compatible" | "openai-official";

export interface ProviderRecord {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKeyEnv: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderInput {
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKeyEnv: string;
  enabled: boolean;
}

interface ProviderRow {
  id: string;
  name: string;
  type: ProviderType;
  base_url: string;
  api_key_env: string;
  enabled: 0 | 1;
  created_at: string;
  updated_at: string;
}

function mapProvider(row: ProviderRow): ProviderRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    baseUrl: row.base_url,
    apiKeyEnv: row.api_key_env,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createProviderRepository(db: AppDatabase) {
  return {
    create(input: CreateProviderInput): ProviderRecord {
      const now = new Date().toISOString();
      const record = {
        id: nanoid(),
        name: input.name,
        type: input.type,
        base_url: input.baseUrl,
        api_key_env: input.apiKeyEnv,
        enabled: input.enabled ? 1 : 0,
        created_at: now,
        updated_at: now
      };

      db.prepare(`
        insert into providers (id, name, type, base_url, api_key_env, enabled, created_at, updated_at)
        values (@id, @name, @type, @base_url, @api_key_env, @enabled, @created_at, @updated_at)
      `).run(record);

      return mapProvider(record as ProviderRow);
    },

    list(): ProviderRecord[] {
      const rows = db.prepare("select * from providers order by created_at asc").all() as ProviderRow[];
      return rows.map(mapProvider);
    },

    getById(id: string): ProviderRecord | null {
      const row = db.prepare("select * from providers where id = ?").get(id) as ProviderRow | undefined;
      return row ? mapProvider(row) : null;
    }
  };
}
```

- [x] **Step 5: Implement model repository**

Create `server/src/providers/modelRepository.ts`:

```ts
import type { AppDatabase } from "../db/client.js";
import { nanoid } from "nanoid";

export type ModelCapability = "chat" | "image" | "multimodal";

export interface ModelRecord {
  id: string;
  providerId: string;
  displayName: string;
  modelId: string;
  capability: ModelCapability;
  enabled: boolean;
  defaultParams: Record<string, unknown>;
  pricing: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateModelInput {
  providerId: string;
  displayName: string;
  modelId: string;
  capability: ModelCapability;
  enabled: boolean;
  defaultParams: Record<string, unknown>;
  pricing: Record<string, unknown>;
}

interface ModelRow {
  id: string;
  provider_id: string;
  display_name: string;
  model_id: string;
  capability: ModelCapability;
  enabled: 0 | 1;
  default_params_json: string;
  pricing_json: string;
  created_at: string;
  updated_at: string;
}

function mapModel(row: ModelRow): ModelRecord {
  return {
    id: row.id,
    providerId: row.provider_id,
    displayName: row.display_name,
    modelId: row.model_id,
    capability: row.capability,
    enabled: row.enabled === 1,
    defaultParams: JSON.parse(row.default_params_json) as Record<string, unknown>,
    pricing: JSON.parse(row.pricing_json) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createModelRepository(db: AppDatabase) {
  return {
    create(input: CreateModelInput): ModelRecord {
      const now = new Date().toISOString();
      const record = {
        id: nanoid(),
        provider_id: input.providerId,
        display_name: input.displayName,
        model_id: input.modelId,
        capability: input.capability,
        enabled: input.enabled ? 1 : 0,
        default_params_json: JSON.stringify(input.defaultParams),
        pricing_json: JSON.stringify(input.pricing),
        created_at: now,
        updated_at: now
      };

      db.prepare(`
        insert into models (id, provider_id, display_name, model_id, capability, enabled, default_params_json, pricing_json, created_at, updated_at)
        values (@id, @provider_id, @display_name, @model_id, @capability, @enabled, @default_params_json, @pricing_json, @created_at, @updated_at)
      `).run(record);

      return mapModel(record as ModelRow);
    },

    list(): ModelRecord[] {
      const rows = db.prepare("select * from models order by created_at asc").all() as ModelRow[];
      return rows.map(mapModel);
    },

    getById(id: string): ModelRecord | null {
      const row = db.prepare("select * from models where id = ?").get(id) as ModelRow | undefined;
      return row ? mapModel(row) : null;
    }
  };
}
```

- [x] **Step 6: Run tests to verify they pass**

Run:

```bash
npm run test --workspace server -- src/providers
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add server/src/providers/providerRepository.ts server/src/providers/modelRepository.ts server/src/providers/providerRepository.test.ts server/src/providers/modelRepository.test.ts
git commit -m "feat: add provider and model repositories"
```

## Task 5: Provider and model HTTP routes

**Files:**
- Modify: `server/src/app.ts`
- Modify: `server/src/index.ts`
- Modify: `server/src/app.test.ts`
- Create: `server/src/routes/providers.ts`
- Create: `server/src/routes/models.ts`
- Create: `server/src/routes/providers.test.ts`
- Create: `server/src/routes/models.test.ts`

- [x] **Step 1: Write failing provider route test**

Create `server/src/routes/providers.test.ts`:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("provider routes", () => {
  it("creates and lists providers", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const createResponse = await request(app).post("/api/providers").send({
      name: "DeepSeek",
      type: "openai-compatible",
      baseUrl: "https://api.deepseek.com/v1",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      enabled: true
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.name).toBe("DeepSeek");

    const listResponse = await request(app).get("/api/providers");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([createResponse.body]);

    db.close();
  });
});
```

- [x] **Step 2: Write failing model route test**

Create `server/src/routes/models.test.ts`:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("model routes", () => {
  it("creates and lists models", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_OPENAI_COMPATIBLE_KEY",
      enabled: true
    });

    const modelResponse = await request(app).post("/api/models").send({
      providerId: providerResponse.body.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: { temperature: 0.2 },
      pricing: { inputTokenPrice: 0.1, outputTokenPrice: 0.2 }
    });

    expect(modelResponse.status).toBe(201);
    expect(modelResponse.body.displayName).toBe("Fast Chat");

    const listResponse = await request(app).get("/api/models");

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([modelResponse.body]);

    db.close();
  });
});
```

- [x] **Step 3: Run route tests to verify they fail**

Run:

```bash
npm run test --workspace server -- src/routes/providers.test.ts src/routes/models.test.ts
```

Expected: FAIL because `createApp` does not accept `db` and routes are not registered.

- [x] **Step 4: Implement provider route**

Create `server/src/routes/providers.ts`:

```ts
import type { AppDatabase } from "../db/client.js";
import { Router } from "express";
import { z } from "zod";
import { createProviderRepository } from "../providers/providerRepository.js";

const createProviderSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["openai-compatible", "openai-official"]),
  baseUrl: z.string().url(),
  apiKeyEnv: z.string().min(1),
  enabled: z.boolean()
});

export function createProvidersRouter(db: AppDatabase) {
  const router = Router();
  const providers = createProviderRepository(db);

  router.get("/", (_req, res) => {
    res.json(providers.list());
  });

  router.post("/", (req, res) => {
    const input = createProviderSchema.parse(req.body);
    const created = providers.create(input);
    res.status(201).json(created);
  });

  return router;
}
```

- [x] **Step 5: Implement model route**

Create `server/src/routes/models.ts`:

```ts
import type { AppDatabase } from "../db/client.js";
import { Router } from "express";
import { z } from "zod";
import { createModelRepository } from "../providers/modelRepository.js";

const createModelSchema = z.object({
  providerId: z.string().min(1),
  displayName: z.string().min(1),
  modelId: z.string().min(1),
  capability: z.enum(["chat", "image", "multimodal"]),
  enabled: z.boolean(),
  defaultParams: z.record(z.unknown()).default({}),
  pricing: z.record(z.unknown()).default({})
});

export function createModelsRouter(db: AppDatabase) {
  const router = Router();
  const models = createModelRepository(db);

  router.get("/", (_req, res) => {
    res.json(models.list());
  });

  router.post("/", (req, res) => {
    const input = createModelSchema.parse(req.body);
    const created = models.create(input);
    res.status(201).json(created);
  });

  return router;
}
```

- [x] **Step 6: Update app dependency injection and runtime database setup**

Modify `server/src/app.ts` to this complete file. From this task onward, `createApp` requires an `AppDatabase`; tests pass an in-memory database, and runtime creates the database only after initializing the sql.js runtime.

```ts
import type { AppDatabase } from "./db/client.js";
import cors from "cors";
import express from "express";
import { createHealthRouter } from "./routes/health.js";
import { createModelsRouter } from "./routes/models.js";
import { createProvidersRouter } from "./routes/providers.js";

export interface AppDependencies {
  db: AppDatabase;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  const { db } = dependencies;

  app.use(cors({ origin: "http://127.0.0.1:5173" }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/health", createHealthRouter());
  app.use("/api/providers", createProvidersRouter(db));
  app.use("/api/models", createModelsRouter(db));

  return app;
}
```

Modify `server/src/index.ts` to this complete file:

```ts
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createDatabase, initializeSqlRuntime } from "./db/client.js";

dotenv.config();

const port = Number(process.env.PORT ?? 8787);

await initializeSqlRuntime();
const db = createDatabase(process.env.DATABASE_PATH ?? "./api-tools.db");
const app = createApp({ db });

app.listen(port, () => {
  console.log(`API Tools server listening on http://127.0.0.1:${port}`);
});
```

Modify `server/src/app.test.ts` to this complete file so the health test still passes after `createApp` requires a database:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createTestDatabase } from "./test/testDb.js";

describe("app", () => {
  it("returns health status", async () => {
    const db = createTestDatabase();
    const app = createApp({ db });

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: "api-tools" });

    db.close();
  });
});
```

- [x] **Step 7: Run route tests to verify they pass**

Run:

```bash
npm run test --workspace server -- src/routes/providers.test.ts src/routes/models.test.ts
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add server/src/app.ts server/src/index.ts server/src/routes/providers.ts server/src/routes/models.ts server/src/routes/providers.test.ts server/src/routes/models.test.ts server/src/app.test.ts
git commit -m "feat: add provider and model routes"
```

## Task 6: OpenAI-compatible model test adapter

**Files:**
- Create: `server/src/config/env.ts`
- Create: `server/src/errors/providerError.ts`
- Create: `server/src/adapters/types.ts`
- Create: `server/src/adapters/openaiCompatible.ts`
- Modify: `server/src/routes/models.ts`
- Create: `server/src/adapters/openaiCompatible.test.ts`
- Create: `server/src/routes/modelTest.test.ts`

- [x] **Step 1: Write failing adapter tests**

Create `server/src/adapters/openaiCompatible.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createOpenAICompatibleAdapter } from "./openaiCompatible.js";

describe("openaiCompatibleAdapter", () => {
  it("tests a model using chat completions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 4, completion_tokens: 1 }
      })
    });
    const adapter = createOpenAICompatibleAdapter({ fetch: fetchMock });

    const result = await adapter.testModel({
      provider: {
        id: "provider-1",
        name: "Custom",
        type: "openai-compatible",
        baseUrl: "https://example.test/v1",
        apiKeyEnv: "CUSTOM_KEY",
        enabled: true,
        createdAt: "now",
        updatedAt: "now"
      },
      model: {
        id: "model-1",
        providerId: "provider-1",
        displayName: "Fast Chat",
        modelId: "fast-chat",
        capability: "chat",
        enabled: true,
        defaultParams: {},
        pricing: {},
        createdAt: "now",
        updatedAt: "now"
      },
      apiKey: "secret"
    });

    expect(result).toEqual({
      ok: true,
      latencyMs: expect.any(Number),
      message: "ok",
      usage: { inputTokens: 4, outputTokens: 1 }
    });
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/v1/chat/completions", expect.objectContaining({ method: "POST" }));
  });

  it("standardizes provider errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "invalid key" } })
    });
    const adapter = createOpenAICompatibleAdapter({ fetch: fetchMock });

    await expect(adapter.testModel({
      provider: {
        id: "provider-1",
        name: "Custom",
        type: "openai-compatible",
        baseUrl: "https://example.test/v1",
        apiKeyEnv: "CUSTOM_KEY",
        enabled: true,
        createdAt: "now",
        updatedAt: "now"
      },
      model: {
        id: "model-1",
        providerId: "provider-1",
        displayName: "Fast Chat",
        modelId: "fast-chat",
        capability: "chat",
        enabled: true,
        defaultParams: {},
        pricing: {},
        createdAt: "now",
        updatedAt: "now"
      },
      apiKey: "secret"
    })).rejects.toMatchObject({
      code: "invalid_api_key",
      statusCode: 401,
      providerMessage: "invalid key"
    });
  });
});
```

- [x] **Step 2: Run adapter tests to verify they fail**

Run:

```bash
npm run test --workspace server -- src/adapters/openaiCompatible.test.ts
```

Expected: FAIL because adapter files do not exist.

- [x] **Step 3: Implement adapter types and provider error**

Create `server/src/errors/providerError.ts`:

```ts
export type ProviderErrorCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "invalid_base_url"
  | "model_not_found"
  | "rate_limited"
  | "quota_exceeded"
  | "unsupported_capability"
  | "provider_error"
  | "network_error";

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly details: {
      providerMessage?: string;
      statusCode?: number;
      suggestion?: string;
    } = {}
  ) {
    super(message);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      providerMessage: this.details.providerMessage,
      statusCode: this.details.statusCode,
      suggestion: this.details.suggestion
    };
  }
}
```

Create `server/src/adapters/types.ts`:

```ts
import type { ModelRecord } from "../providers/modelRepository.js";
import type { ProviderRecord } from "../providers/providerRepository.js";

export interface AdapterModelInput {
  provider: ProviderRecord;
  model: ModelRecord;
  apiKey: string;
}

export interface ModelTestResult {
  ok: true;
  latencyMs: number;
  message: string;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface ChatRunInput extends AdapterModelInput {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

export interface ChatRunResult {
  content: string;
  latencyMs: number;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface ModelAdapter {
  testModel(input: AdapterModelInput): Promise<ModelTestResult>;
  runChat(input: ChatRunInput): Promise<ChatRunResult>;
}
```

Create `server/src/config/env.ts`:

```ts
import { ProviderError } from "../errors/providerError.js";

export function getRequiredApiKey(apiKeyEnv: string, env: NodeJS.ProcessEnv = process.env) {
  const value = env[apiKeyEnv];

  if (!value) {
    throw new ProviderError("missing_api_key", `Missing API key env var: ${apiKeyEnv}`, {
      suggestion: `Add ${apiKeyEnv}=... to your local .env file and restart the server.`
    });
  }

  return value;
}
```

- [x] **Step 4: Implement OpenAI-compatible adapter**

Create `server/src/adapters/openaiCompatible.ts`:

```ts
import { ProviderError } from "../errors/providerError.js";
import type { ChatRunInput, ChatRunResult, ModelAdapter, ModelTestResult } from "./types.js";

interface AdapterDependencies {
  fetch?: typeof fetch;
}

interface OpenAICompatibleResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: {
    message?: string;
  };
}

function endpoint(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function mapStatusToCode(status: number) {
  if (status === 401 || status === 403) return "invalid_api_key";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  return "provider_error";
}

async function parseJson(response: Response): Promise<OpenAICompatibleResponse> {
  try {
    return (await response.json()) as OpenAICompatibleResponse;
  } catch {
    return {};
  }
}

export function createOpenAICompatibleAdapter(dependencies: AdapterDependencies = {}): ModelAdapter {
  const fetchImpl = dependencies.fetch ?? fetch;

  async function runChat(input: ChatRunInput): Promise<ChatRunResult> {
    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetchImpl(endpoint(input.provider.baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: input.model.modelId,
          messages: input.messages,
          temperature: input.model.defaultParams.temperature ?? 0.7,
          max_tokens: input.model.defaultParams.maxTokens
        })
      });
    } catch (error) {
      throw new ProviderError("network_error", "Could not reach provider API", {
        providerMessage: error instanceof Error ? error.message : String(error),
        suggestion: "Check the provider base URL and your network connection."
      });
    }

    const body = await parseJson(response);

    if (!response.ok) {
      const providerMessage = body.error?.message ?? `HTTP ${response.status}`;
      throw new ProviderError(mapStatusToCode(response.status), "Provider request failed", {
        providerMessage,
        statusCode: response.status
      });
    }

    const content = body.choices?.[0]?.message?.content ?? "";

    return {
      content,
      latencyMs: Date.now() - startedAt,
      usage: {
        inputTokens: body.usage?.prompt_tokens,
        outputTokens: body.usage?.completion_tokens
      }
    };
  }

  return {
    async testModel(input): Promise<ModelTestResult> {
      const result = await runChat({
        ...input,
        messages: [{ role: "user", content: "Reply with ok." }]
      });

      return {
        ok: true,
        latencyMs: result.latencyMs,
        message: result.content,
        usage: result.usage
      };
    },
    runChat
  };
}
```

- [x] **Step 5: Run adapter tests to verify they pass**

Run:

```bash
npm run test --workspace server -- src/adapters/openaiCompatible.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add server/src/config/env.ts server/src/errors/providerError.ts server/src/adapters/types.ts server/src/adapters/openaiCompatible.ts server/src/adapters/openaiCompatible.test.ts
git commit -m "feat: add openai compatible adapter"
```

## Task 7: Model test route with run_step recording

**Files:**
- Modify: `server/src/routes/models.ts`
- Create: `server/src/routes/modelTest.test.ts`

- [x] **Step 1: Write failing route test for missing API key**

Create `server/src/routes/modelTest.test.ts`:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("model test route", () => {
  it("reports missing API key without exposing a secret", async () => {
    const db = createTestDatabase();
    const app = createApp({ db, env: {} });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_OPENAI_COMPATIBLE_KEY",
      enabled: true
    });
    const modelResponse = await request(app).post("/api/models").send({
      providerId: providerResponse.body.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: {}
    });

    const testResponse = await request(app).post(`/api/models/${modelResponse.body.id}/test`);

    expect(testResponse.status).toBe(400);
    expect(testResponse.body).toMatchObject({
      code: "missing_api_key",
      message: "Missing API key env var: CUSTOM_OPENAI_COMPATIBLE_KEY"
    });
    expect(JSON.stringify(testResponse.body)).not.toContain("sk-");

    db.close();
  });
});
```

- [x] **Step 2: Run route test to verify it fails**

Run:

```bash
npm run test --workspace server -- src/routes/modelTest.test.ts
```

Expected: FAIL because `createApp` does not accept `env` and `/api/models/:id/test` is not implemented.

- [x] **Step 3: Update app dependencies**

Modify `server/src/app.ts` to this complete file:

```ts
import type { AppDatabase } from "./db/client.js";
import cors from "cors";
import express from "express";
import { ProviderError } from "./errors/providerError.js";
import { createHealthRouter } from "./routes/health.js";
import { createModelsRouter } from "./routes/models.js";
import { createProvidersRouter } from "./routes/providers.js";

export interface AppDependencies {
  db: AppDatabase;
  env?: NodeJS.ProcessEnv;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  const { db } = dependencies;
  const env = dependencies.env ?? process.env;

  app.use(cors({ origin: "http://127.0.0.1:5173" }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/health", createHealthRouter());
  app.use("/api/providers", createProvidersRouter(db));
  app.use("/api/models", createModelsRouter(db, { env }));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ProviderError) {
      res.status(error.details.statusCode && error.details.statusCode >= 500 ? 502 : 400).json(error.toJSON());
      return;
    }

    res.status(500).json({ code: "internal_error", message: "Internal server error" });
  });

  return app;
}
```

Keep `server/src/index.ts` as the runtime owner of database creation:

```ts
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createDatabase, initializeSqlRuntime } from "./db/client.js";

dotenv.config();

const port = Number(process.env.PORT ?? 8787);

await initializeSqlRuntime();
const db = createDatabase(process.env.DATABASE_PATH ?? "./api-tools.db");
const app = createApp({ db });

app.listen(port, () => {
  console.log(`API Tools server listening on http://127.0.0.1:${port}`);
});
```

- [x] **Step 4: Add model test route**

Modify `server/src/routes/models.ts` to this complete file:

```ts
import type { AppDatabase } from "../db/client.js";
import { Router } from "express";
import { z } from "zod";
import { createOpenAICompatibleAdapter } from "../adapters/openaiCompatible.js";
import { getRequiredApiKey } from "../config/env.js";
import { ProviderError } from "../errors/providerError.js";
import { createModelRepository } from "../providers/modelRepository.js";
import { createProviderRepository } from "../providers/providerRepository.js";

const createModelSchema = z.object({
  providerId: z.string().min(1),
  displayName: z.string().min(1),
  modelId: z.string().min(1),
  capability: z.enum(["chat", "image", "multimodal"]),
  enabled: z.boolean(),
  defaultParams: z.record(z.unknown()).default({}),
  pricing: z.record(z.unknown()).default({})
});

interface ModelsRouterDependencies {
  env: NodeJS.ProcessEnv;
}

export function createModelsRouter(db: AppDatabase, dependencies: ModelsRouterDependencies) {
  const router = Router();
  const models = createModelRepository(db);
  const providers = createProviderRepository(db);
  const adapter = createOpenAICompatibleAdapter();

  router.get("/", (_req, res) => {
    res.json(models.list());
  });

  router.post("/", (req, res) => {
    const input = createModelSchema.parse(req.body);
    const created = models.create(input);
    res.status(201).json(created);
  });

  router.post("/:id/test", async (req, res, next) => {
    try {
      const model = models.getById(req.params.id);
      if (!model) {
        throw new ProviderError("model_not_found", "Model not found", { statusCode: 404 });
      }
      const provider = providers.getById(model.providerId);
      if (!provider) {
        throw new ProviderError("provider_error", "Provider not found", { statusCode: 404 });
      }
      if (model.capability !== "chat" && model.capability !== "multimodal") {
        throw new ProviderError("unsupported_capability", "Model cannot run chat completion tests");
      }

      const apiKey = getRequiredApiKey(provider.apiKeyEnv, dependencies.env);
      const result = await adapter.testModel({ provider, model, apiKey });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

- [x] **Step 5: Run route test to verify it passes**

Run:

```bash
npm run test --workspace server -- src/routes/modelTest.test.ts
```

Expected: PASS.

- [x] **Step 6: Run all backend tests**

Run:

```bash
npm run test --workspace server
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add server/src/app.ts server/src/routes/models.ts server/src/routes/modelTest.test.ts
git commit -m "feat: add model test route"
```

## Task 7.5: Remote model discovery

**Files:**
- Modify: `server/src/adapters/types.ts`
- Modify: `server/src/adapters/openaiCompatible.ts`
- Modify: `server/src/adapters/openaiCompatible.test.ts`
- Modify: `server/src/app.ts`
- Modify: `server/src/routes/providers.ts`
- Create: `server/src/routes/providerRemoteModels.test.ts`

- [x] **Step 1: Write failing adapter test for remote model listing**

Extend `server/src/adapters/openaiCompatible.test.ts` with coverage for `adapter.listModels({ provider, apiKey })`.

Expected behavior:

- Calls `GET {baseUrl}/models`.
- Sends `Authorization: Bearer <apiKey>`.
- Returns normalized model objects with `id` and optional `ownedBy`.
- Standardizes provider errors the same way chat completions does.

- [x] **Step 2: Write failing provider route test**

Create `server/src/routes/providerRemoteModels.test.ts`.

Expected behavior:

- `GET /api/providers/:id/remote-models` returns `{ ok: true, providerId, models }` for a valid provider/key.
- Missing env var returns `missing_api_key` without exposing other secrets.
- Missing provider returns `model_not_found` status `404`.

- [x] **Step 3: Run tests to verify they fail**

Run:

```bash
npm run test --workspace server -- src/adapters/openaiCompatible.test.ts src/routes/providerRemoteModels.test.ts
```

Expected: FAIL because `listModels` and `/api/providers/:id/remote-models` do not exist yet.

- [x] **Step 4: Implement adapter listModels**

Update `server/src/adapters/types.ts` with:

```ts
export interface RemoteModel {
  id: string;
  ownedBy?: string;
}

export interface AdapterProviderInput {
  provider: Provider;
  apiKey: string;
}
```

Extend `ModelAdapter` with:

```ts
listModels(input: AdapterProviderInput): Promise<RemoteModel[]>;
```

Update `server/src/adapters/openaiCompatible.ts` to call `GET {baseUrl}/models`, parse OpenAI-compatible `data` arrays, and reuse the existing provider error mapping.

- [x] **Step 5: Implement provider remote-models route**

Update `server/src/app.ts` so `createProvidersRouter(db, { env })` receives env dependencies.

Update `server/src/routes/providers.ts` to add:

```text
GET /api/providers/:id/remote-models
```

The route looks up the provider, reads its key using `getRequiredApiKey`, calls `createOpenAICompatibleAdapter().listModels`, and returns:

```json
{
  "ok": true,
  "providerId": "provider-id",
  "models": []
}
```

- [x] **Step 6: Run route and adapter tests**

Run:

```bash
npm run test --workspace server -- src/adapters/openaiCompatible.test.ts src/routes/providerRemoteModels.test.ts
```

Expected: PASS.

- [x] **Step 7: Run all backend tests and typecheck**

Run:

```bash
npm run test --workspace server
npm run typecheck --workspace server
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add docs/superpowers/plans/2026-05-29-api-tools-v0-1-workbench.md server/src/adapters/types.ts server/src/adapters/openaiCompatible.ts server/src/adapters/openaiCompatible.test.ts server/src/app.ts server/src/routes/providers.ts server/src/routes/providerRemoteModels.test.ts
git commit -m "feat: add remote model discovery"
```

## Task 7.6: Import remote models into local model registry

**Goal:** Let one provider create many local model records from remote model ids discovered by `GET /api/providers/:id/remote-models`. This turns remote discovery into usable local model configuration for model tests and later chat workflows.

**Files:**
- Modify: `server/src/providers/modelRepository.ts`
- Modify: `server/src/providers/modelRepository.test.ts`
- Modify: `server/src/routes/providers.ts`
- Create: `server/src/routes/providerImportModels.test.ts`

- [x] **Step 1: Write failing repository test for provider/model lookup**

Extend `server/src/providers/modelRepository.test.ts` with a test for:

```ts
models.findByProviderAndModelId(providerId, modelId)
```

Expected behavior:

- Returns the existing local model when provider id and model id match.
- Returns `undefined` for a different provider.
- This method is used by the import route to skip duplicate model ids for the same provider.

- [x] **Step 2: Write failing route test for importing multiple remote models**

Create `server/src/routes/providerImportModels.test.ts`.

Expected behavior:

- Create one provider.
- POST to `/api/providers/:id/import-models` with two model definitions.
- Response status is `201`.
- Response body contains `created` with two local model records and `skipped` as an empty array.
- `GET /api/models?providerId=<providerId>` returns both records.

Example request:

```json
{
  "models": [
    {
      "modelId": "gpt-5.2-chat-latest",
      "displayName": "GPT-5.2 Chat Latest",
      "capability": "chat"
    },
    {
      "modelId": "gpt-5.4-mini",
      "displayName": "GPT-5.4 Mini",
      "capability": "chat"
    }
  ]
}
```

- [x] **Step 3: Write failing route test for duplicate imports**

Extend `server/src/routes/providerImportModels.test.ts`.

Expected behavior:

- Import a model once.
- Import the same `modelId` for the same provider again.
- Response has `created: []`.
- Response has `skipped: [{ modelId, reason: "already_exists" }]`.
- Database still has exactly one local model for that provider/model id.

- [x] **Step 4: Write failing route tests for invalid input and missing provider**

Extend `server/src/routes/providerImportModels.test.ts`.

Expected behavior:

- Missing provider returns status `404` and `{ code: "provider_not_found" }`.
- Empty `models` array returns status `400`.
- Invalid capability returns status `400`.

- [x] **Step 5: Run tests to verify they fail**

Run:

```bash
npm run test --workspace server -- src/providers/modelRepository.test.ts src/routes/providerImportModels.test.ts
```

Expected: FAIL because `findByProviderAndModelId` and `/api/providers/:id/import-models` do not exist yet.

- [x] **Step 6: Implement repository lookup**

Update `server/src/providers/modelRepository.ts`:

```ts
findByProviderAndModelId(providerId: string, modelId: string): Model | undefined {
  const row = this.db.prepare(`
    select * from models
    where provider_id = @providerId and model_id = @modelId
  `).get<ModelRow>({ providerId, modelId });

  return row ? mapModelRow(row) : undefined;
}
```

- [x] **Step 7: Implement provider import-models route**

Update `server/src/routes/providers.ts`:

- Import `createModelRepository`.
- Add a Zod schema:

```ts
const importModelsSchema = z.object({
  models: z.array(z.object({
    modelId: z.string().min(1),
    displayName: z.string().min(1),
    capability: z.enum(["chat", "image", "multimodal"]).default("chat"),
    enabled: z.boolean().default(true),
    defaultParams: z.record(z.unknown()).default({}),
    pricing: z.record(z.unknown()).default({})
  })).min(1)
});
```

- Add:

```text
POST /api/providers/:id/import-models
```

Behavior:

- Look up provider.
- If missing, throw `ProviderError("provider_not_found", "Provider not found", { statusCode: 404 })`.
- For each requested model:
  - If `findByProviderAndModelId(provider.id, model.modelId)` exists, add `{ modelId, reason: "already_exists" }` to `skipped`.
  - Otherwise create a local model with that provider id and add it to `created`.
- Return status `201` with `{ created, skipped }`.

- [x] **Step 8: Run targeted tests**

Run:

```bash
npm run test --workspace server -- src/providers/modelRepository.test.ts src/routes/providerImportModels.test.ts
```

Expected: PASS.

- [x] **Step 9: Run all backend tests and typecheck**

Run:

```bash
npm run test --workspace server
npm run typecheck --workspace server
```

Expected: PASS.

- [x] **Step 10: Commit**

```bash
git add docs/superpowers/plans/2026-05-29-api-tools-v0-1-workbench.md server/src/providers/modelRepository.ts server/src/providers/modelRepository.test.ts server/src/routes/providers.ts server/src/routes/providerImportModels.test.ts
git commit -m "feat: import remote models"
```

## Task 7.7: Persist sql.js database on graceful shutdown

**Goal:** Provider/model data created through HTTP APIs must survive normal backend restarts. Current sql.js writes database files on `db.close()`, so the runtime must call `db.close()` when the server exits normally.

**Files:**
- Modify: `server/src/index.ts`
- Modify: `server/src/db/client.ts`
- Create: `server/src/serverLifecycle.test.ts`

- [x] **Step 1: Write failing lifecycle test for database close on shutdown**

Create `server/src/serverLifecycle.test.ts`.

Expected behavior:

- Build a server lifecycle helper that can be tested without binding a real network port.
- Provide a fake `AppDatabase` with a spy `close()`.
- Trigger the lifecycle shutdown handler.
- Assert `db.close()` is called exactly once.
- Assert calling shutdown twice still calls `db.close()` once.

- [x] **Step 2: Write failing persistence smoke test**

Extend `server/src/serverLifecycle.test.ts`.

Expected behavior:

- Create a temporary database file path.
- Open database, insert provider through repository, call `db.close()`.
- Reopen the same path, assert provider still exists.
- This locks in the existing sql.js persistence contract before wiring runtime shutdown.

- [x] **Step 3: Run lifecycle tests to verify they fail**

Run:

```bash
npm run test --workspace server -- src/serverLifecycle.test.ts
```

Expected: FAIL because lifecycle helpers do not exist yet.

- [x] **Step 4: Add explicit database flush helper if needed**

Review `server/src/db/client.ts`.

Current behavior:

- File-backed `AppDatabase.close()` writes `db.export()` to disk.

If tests reveal this is enough, keep `client.ts` unchanged. If a clearer public helper is needed, add:

```ts
export function closeDatabase(db: AppDatabase) {
  db.close();
}
```

Do not change schema or repository behavior in this task.

- [x] **Step 5: Refactor runtime into testable lifecycle functions**

Update `server/src/index.ts` to separate:

- env loading
- SQL runtime initialization
- database creation
- Express app creation
- server listen
- graceful shutdown

The runtime should:

- Call `loadLocalEnv()` before reading env vars.
- Call `initializeSqlRuntime()`.
- Create the file-backed database.
- Create the app with `{ db }`.
- Keep a reference to the HTTP server returned by `app.listen`.
- On `SIGINT` and `SIGTERM`, close the HTTP server and call `db.close()` once.
- Set `process.exitCode = 0` for graceful signal shutdown.

- [x] **Step 6: Run lifecycle tests**

Run:

```bash
npm run test --workspace server -- src/serverLifecycle.test.ts
```

Expected: PASS.

- [x] **Step 7: Run all backend tests and typecheck**

Run:

```bash
npm run test --workspace server
npm run typecheck --workspace server
```

Expected: PASS.

- [x] **Step 8: Manual verification**

Manually verify persistence:

```powershell
cd "F:\website\API Tools\.claude\worktrees\api-tools-v0-1-workbench"
npm run dev --workspace server
```

In another shell:

```powershell
$provider = Invoke-RestMethod -Method Post http://127.0.0.1:8787/api/providers -ContentType "application/json" -Body '{"name":"Persistence Probe","type":"openai-compatible","baseUrl":"https://example.test/v1","apiKeyEnv":"CUSTOM_OPENAI_COMPATIBLE_KEY","enabled":true}'
```

Stop server with `Ctrl+C`, restart it, then verify:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/providers
```

Expected: `Persistence Probe` still exists.

- [x] **Step 9: Commit**

```bash
git add docs/superpowers/plans/2026-05-29-api-tools-v0-1-workbench.md server/src/index.ts server/src/db/client.ts server/src/serverLifecycle.test.ts
git commit -m "fix: persist database on shutdown"
```

## Task 8: Workflow runner core with llm.chat step

**Files:**
- Modify: `server/src/db/schema.ts`
- Modify: `server/src/db/schema.test.ts`
- Create: `server/src/workflows/types.ts`
- Create: `server/src/workflows/runner.ts`
- Create: `server/src/workflows/runner.test.ts`

- [x] **Step 1: Write failing generic workflow runner test**

Create `server/src/workflows/runner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ModelAdapter } from "../adapters/types.js";
import { createModelRepository } from "../providers/modelRepository.js";
import { createProviderRepository } from "../providers/providerRepository.js";
import { createTestDatabase } from "../test/testDb.js";
import { createWorkflowRunner } from "./runner.js";

describe("workflowRunner", () => {
  it("runs an llm.chat workflow step and records messages, run, and step", async () => {
    const db = createTestDatabase();
    const providers = createProviderRepository(db);
    const models = createModelRepository(db);
    const provider = providers.create({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_KEY",
      enabled: true
    });
    const model = models.create({
      providerId: provider.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: { inputTokenPrice: 0.1, outputTokenPrice: 0.2 }
    });
    const adapter: ModelAdapter = {
      testModel: async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} }),
      runChat: async () => ({
        content: "Hello from model",
        latencyMs: 12,
        usage: { inputTokens: 10, outputTokens: 4 }
      })
    };
    const runner = createWorkflowRunner(db, {
      adapter,
      env: { CUSTOM_KEY: "secret" }
    });

    const result = await runner.runWorkflow({
      workflowType: "api-workflow",
      sessionId: undefined,
      input: { message: "Hello" },
      steps: [
        {
          id: "main-response",
          type: "llm.chat",
          modelId: model.id,
          input: { message: "{{input.message}}" }
        }
      ]
    });

    expect(result.outputs["main-response"].content).toBe("Hello from model");
    expect(result.run.status).toBe("succeeded");
    expect(result.run.totalInputTokens).toBe(10);
    expect(result.run.totalOutputTokens).toBe(4);

    const runSteps = db.prepare("select * from run_steps").all();
    expect(runSteps).toHaveLength(1);
    expect(runSteps[0].step_type).toBe("llm.chat");

    db.close();
  });
});
```

- [x] **Step 2: Run runner test to verify it fails**

Run:

```bash
npm run test --workspace server -- src/workflows/runner.test.ts
```

Expected: FAIL because generic workflow runner does not exist.

- [x] **Step 3: Update schema constraints and implement framework-oriented workflow types**

Modify `server/src/db/schema.ts` and `server/src/db/schema.test.ts` so:

- `sessions.workflow_type` and `runs.workflow_type` allow `api-workflow` and `model-test`.
- `run_steps.step_type` allows `llm.chat` and `model-test`.
- Existing model test behavior still works.
- V0.1 does not implement schema migrations. If an existing local database was created with the old CHECK constraints, delete the local test database file and recreate/import provider/model data.

Create `server/src/workflows/types.ts`:

```ts
export type WorkflowType = "api-workflow" | "model-test";
export type WorkflowStepType = "llm.chat";

export interface WorkflowStepDefinition {
  id: string;
  type: WorkflowStepType;
  modelId?: string;
  input: Record<string, unknown>;
}

export interface RunWorkflowInput {
  sessionId?: string;
  workflowType: WorkflowType;
  input: Record<string, unknown>;
  steps: WorkflowStepDefinition[];
}

export interface SessionRecord {
  id: string;
  title: string;
  workflowType: WorkflowType;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  modelId?: string;
  runId?: string;
  createdAt: string;
}

export interface RunRecord {
  id: string;
  sessionId: string;
  workflowType: WorkflowType;
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  endedAt?: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  totalCostEstimate?: number;
}

export interface RunWorkflowResult {
  session: SessionRecord;
  run: RunRecord;
  outputs: Record<string, Record<string, unknown>>;
}
```

- [x] **Step 4: Implement runner core and the first llm.chat step executor**

Create `server/src/workflows/runner.ts`:

```ts
import type { AppDatabase } from "../db/client.js";
import { nanoid } from "nanoid";
import type { ModelAdapter } from "../adapters/types.js";
import { getRequiredApiKey } from "../config/env.js";
import { ProviderError } from "../errors/providerError.js";
import { createModelRepository } from "../providers/modelRepository.js";
import { createProviderRepository } from "../providers/providerRepository.js";
import type {
  MessageRecord,
  RunRecord,
  RunWorkflowInput,
  RunWorkflowResult,
  SessionRecord,
  WorkflowStepDefinition
} from "./types.js";

interface WorkflowRunnerDependencies {
  adapter: ModelAdapter;
  env: NodeJS.ProcessEnv;
}

function nowIso() {
  return new Date().toISOString();
}

function estimateCost(inputTokens: number | undefined, outputTokens: number | undefined, pricing: Record<string, unknown>) {
  const inputPrice = typeof pricing.inputTokenPrice === "number" ? pricing.inputTokenPrice : 0;
  const outputPrice = typeof pricing.outputTokenPrice === "number" ? pricing.outputTokenPrice : 0;
  return ((inputTokens ?? 0) / 1_000_000) * inputPrice + ((outputTokens ?? 0) / 1_000_000) * outputPrice;
}

function mapSession(row: Record<string, unknown>): SessionRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    workflowType: row.workflow_type as SessionRecord["workflowType"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapRun(row: Record<string, unknown>): RunRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    workflowType: row.workflow_type as RunRecord["workflowType"],
    status: row.status as RunRecord["status"],
    startedAt: String(row.started_at),
    endedAt: row.ended_at ? String(row.ended_at) : undefined,
    totalInputTokens: row.total_input_tokens == null ? undefined : Number(row.total_input_tokens),
    totalOutputTokens: row.total_output_tokens == null ? undefined : Number(row.total_output_tokens),
    totalCostEstimate: row.total_cost_estimate == null ? undefined : Number(row.total_cost_estimate)
  };
}

function mapMessage(row: Record<string, unknown>): MessageRecord {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    role: row.role as MessageRecord["role"],
    content: String(row.content),
    modelId: row.model_id ? String(row.model_id) : undefined,
    runId: row.run_id ? String(row.run_id) : undefined,
    createdAt: String(row.created_at)
  };
}

export function createWorkflowRunner(db: AppDatabase, dependencies: WorkflowRunnerDependencies) {
  const providers = createProviderRepository(db);
  const models = createModelRepository(db);

  async function runLlmChatStep(step: WorkflowStepDefinition, message: string) {
    if (!step.modelId) {
      throw new ProviderError("invalid_workflow_step", "llm.chat step requires modelId", { statusCode: 400 });
    }
    const model = models.getById(step.modelId);
    if (!model) {
      throw new ProviderError("model_not_found", "Model not found", { statusCode: 404 });
    }
    const provider = providers.getById(model.providerId);
    if (!provider) {
      throw new ProviderError("provider_error", "Provider not found", { statusCode: 404 });
    }
    const apiKey = getRequiredApiKey(provider.apiKeyEnv, dependencies.env);
    const chatResult = await dependencies.adapter.runChat({
      provider,
      model,
      apiKey,
      messages: [{ role: "user", content: message }]
    });
    return { provider, model, chatResult };
  }

  return {
    async runWorkflow(input: RunWorkflowInput): Promise<RunWorkflowResult> {
      const timestamp = nowIso();

      const sessionId = input.sessionId ?? nanoid();
      if (!input.sessionId) {
        db.prepare(`
          insert into sessions (id, title, workflow_type, created_at, updated_at)
          values (?, ?, ?, ?, ?)
        `).run(sessionId, String(input.input.message ?? "New workflow").slice(0, 60), input.workflowType, timestamp, timestamp);
      }

      const userMessageId = nanoid();
      const message = String(input.input.message ?? "");
      db.prepare(`
        insert into messages (id, session_id, role, content, created_at)
        values (?, ?, 'user', ?, ?)
      `).run(userMessageId, sessionId, message, timestamp);

      const runId = nanoid();
      db.prepare(`
        insert into runs (id, session_id, workflow_type, status, started_at)
        values (?, ?, ?, 'running', ?)
      `).run(runId, sessionId, input.workflowType, timestamp);

      const outputs: Record<string, Record<string, unknown>> = {};
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let totalCostEstimate = 0;

      for (const [stepIndex, step] of input.steps.entries()) {
        if (step.type !== "llm.chat") {
          throw new ProviderError("unsupported_workflow_step", `Unsupported workflow step type: ${step.type}`, { statusCode: 400 });
        }

        const stepId = nanoid();
        db.prepare(`
          insert into run_steps (id, run_id, step_index, step_type, status, input_preview, created_at, updated_at)
          values (?, ?, ?, ?, 'running', ?, ?, ?)
        `).run(stepId, runId, stepIndex, step.type, message.slice(0, 200), timestamp, timestamp);

        const { provider, model, chatResult } = await runLlmChatStep(step, message);
        const stepEndedAt = nowIso();
        const costEstimate = estimateCost(chatResult.usage.inputTokens, chatResult.usage.outputTokens, model.pricing);
        totalInputTokens += chatResult.usage.inputTokens ?? 0;
        totalOutputTokens += chatResult.usage.outputTokens ?? 0;
        totalCostEstimate += costEstimate;
        outputs[step.id] = { content: chatResult.content };

        db.prepare(`
          update run_steps
          set provider_id = ?, model_id = ?, status = 'succeeded', output_preview = ?, latency_ms = ?, input_tokens = ?, output_tokens = ?, cost_estimate = ?, updated_at = ?
          where id = ?
        `).run(
          provider.id,
          model.id,
          chatResult.content.slice(0, 200),
          chatResult.latencyMs,
          chatResult.usage.inputTokens ?? null,
          chatResult.usage.outputTokens ?? null,
          costEstimate,
          stepEndedAt,
          stepId
        );
      }

      const endedAt = nowIso();

      db.prepare(`
        update runs
        set status = 'succeeded', ended_at = ?, total_input_tokens = ?, total_output_tokens = ?, total_cost_estimate = ?
        where id = ?
      `).run(endedAt, totalInputTokens, totalOutputTokens, totalCostEstimate, runId);

      const assistantMessageId = nanoid();
      const finalOutput = Object.values(outputs).at(-1);
      db.prepare(`
        insert into messages (id, session_id, role, content, model_id, run_id, created_at)
        values (?, ?, 'assistant', ?, ?, ?, ?)
      `).run(assistantMessageId, sessionId, String(finalOutput?.content ?? ""), null, runId, endedAt);

      db.prepare("update sessions set updated_at = ? where id = ?").run(endedAt, sessionId);

      return {
        session: mapSession(db.prepare("select * from sessions where id = ?").get(sessionId) as Record<string, unknown>),
        run: mapRun(db.prepare("select * from runs where id = ?").get(runId) as Record<string, unknown>),
        outputs
      };
    }
  };
}
```

- [x] **Step 5: Run runner test to verify it passes**

Run:

```bash
npm run test --workspace server -- src/workflows/runner.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add server/src/db/schema.ts server/src/db/schema.test.ts server/src/workflows/types.ts server/src/workflows/runner.ts server/src/workflows/runner.test.ts
git commit -m "feat: add workflow runner core"
```

## Task 9: Workflow execution route and usage summary

**Files:**
- Modify: `server/src/app.ts`
- Modify: `server/src/index.ts`
- Create: `server/src/routes/workflows.ts`
- Create: `server/src/routes/usage.ts`
- Create: `server/src/usage/usageService.ts`
- Create: `server/src/routes/workflows.test.ts`
- Create: `server/src/routes/usage.test.ts`

- [ ] **Step 1: Write failing generic workflow execution route test**

Create `server/src/routes/workflows.test.ts`:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { ModelAdapter } from "../adapters/types.js";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("workflow routes", () => {
  it("runs an llm.chat workflow", async () => {
    const db = createTestDatabase();
    const adapter: ModelAdapter = {
      testModel: async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} }),
      runChat: async () => ({ content: "Model reply", latencyMs: 8, usage: { inputTokens: 6, outputTokens: 3 } })
    };
    const app = createApp({ db, env: { CUSTOM_KEY: "secret" }, adapter });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_KEY",
      enabled: true
    });
    const modelResponse = await request(app).post("/api/models").send({
      providerId: providerResponse.body.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: {}
    });

    const response = await request(app).post("/api/workflows/run").send({
      workflowType: "api-workflow",
      input: { message: "Hello" },
      steps: [
        {
          id: "main-response",
          type: "llm.chat",
          modelId: modelResponse.body.id,
          input: { message: "{{input.message}}" }
        }
      ]
    });

    expect(response.status).toBe(200);
    expect(response.body.outputs["main-response"].content).toBe("Model reply");
    expect(response.body.run.status).toBe("succeeded");

    db.close();
  });
});
```

- [ ] **Step 2: Write failing usage summary test**

Create `server/src/routes/usage.test.ts`:

```ts
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { ModelAdapter } from "../adapters/types.js";
import { createApp } from "../app.js";
import { createTestDatabase } from "../test/testDb.js";

describe("usage routes", () => {
  it("summarizes runs", async () => {
    const db = createTestDatabase();
    const adapter: ModelAdapter = {
      testModel: async () => ({ ok: true, latencyMs: 1, message: "ok", usage: {} }),
      runChat: async () => ({ content: "Model reply", latencyMs: 8, usage: { inputTokens: 6, outputTokens: 3 } })
    };
    const app = createApp({ db, env: { CUSTOM_KEY: "secret" }, adapter });

    const providerResponse = await request(app).post("/api/providers").send({
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKeyEnv: "CUSTOM_KEY",
      enabled: true
    });
    const modelResponse = await request(app).post("/api/models").send({
      providerId: providerResponse.body.id,
      displayName: "Fast Chat",
      modelId: "fast-chat",
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: {}
    });
    await request(app).post("/api/workflows/run").send({
      workflowType: "api-workflow",
      input: { message: "Hello" },
      steps: [{ id: "main-response", type: "llm.chat", modelId: modelResponse.body.id, input: { message: "{{input.message}}" } }]
    });

    const response = await request(app).get("/api/usage/summary");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      requestCount: 1,
      inputTokens: 6,
      outputTokens: 3,
      estimatedCost: 0,
      errorCount: 0
    });

    db.close();
  });
});
```

- [ ] **Step 3: Run route tests to verify they fail**

Run:

```bash
npm run test --workspace server -- src/routes/workflows.test.ts src/routes/usage.test.ts
```

Expected: FAIL because generic workflow execution and usage routes are not implemented.

- [ ] **Step 4: Implement usage service**

Create `server/src/usage/usageService.ts`:

```ts
import type { AppDatabase } from "../db/client.js";

export interface UsageSummary {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  errorCount: number;
}

export function createUsageService(db: AppDatabase) {
  return {
    getSummary(): UsageSummary {
      const row = db.prepare(`
        select
          count(*) as request_count,
          coalesce(sum(total_input_tokens), 0) as input_tokens,
          coalesce(sum(total_output_tokens), 0) as output_tokens,
          coalesce(sum(total_cost_estimate), 0) as estimated_cost,
          coalesce(sum(case when status = 'failed' then 1 else 0 end), 0) as error_count
        from runs
      `).get() as {
        request_count: number;
        input_tokens: number;
        output_tokens: number;
        estimated_cost: number;
        error_count: number;
      };

      return {
        requestCount: row.request_count,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        estimatedCost: row.estimated_cost,
        errorCount: row.error_count
      };
    }
  };
}
```

- [ ] **Step 5: Implement workflow and usage routes**

Create `server/src/routes/workflows.ts`:

```ts
import type { AppDatabase } from "../db/client.js";
import { Router } from "express";
import { z } from "zod";
import type { ModelAdapter } from "../adapters/types.js";
import { createWorkflowRunner } from "../workflows/runner.js";

const workflowStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("llm.chat"),
  modelId: z.string().min(1).optional(),
  input: z.record(z.unknown()).default({})
});

const runWorkflowSchema = z.object({
  sessionId: z.string().optional(),
  workflowType: z.literal("api-workflow").default("api-workflow"),
  input: z.record(z.unknown()).default({}),
  steps: z.array(workflowStepSchema).min(1)
});

interface WorkflowsRouterDependencies {
  adapter: ModelAdapter;
  env: NodeJS.ProcessEnv;
}

export function createWorkflowsRouter(db: AppDatabase, dependencies: WorkflowsRouterDependencies) {
  const router = Router();
  const runner = createWorkflowRunner(db, dependencies);

  router.get("/", (_req, res) => {
    res.json([
      { id: "single-llm-chat", name: "单步 LLM Chat", steps: [{ id: "main-response", type: "llm.chat" }] }
    ]);
  });

  router.post("/run", async (req, res, next) => {
    try {
      const input = runWorkflowSchema.parse(req.body);
      const result = await runner.runWorkflow(input);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

Create `server/src/routes/usage.ts`:

```ts
import type { AppDatabase } from "../db/client.js";
import { Router } from "express";
import { createUsageService } from "../usage/usageService.js";

export function createUsageRouter(db: AppDatabase) {
  const router = Router();
  const usage = createUsageService(db);

  router.get("/summary", (_req, res) => {
    res.json(usage.getSummary());
  });

  return router;
}
```

- [ ] **Step 6: Register routes in app**

Modify `server/src/app.ts` to this complete file:

```ts
import type { AppDatabase } from "./db/client.js";
import cors from "cors";
import express from "express";
import { createOpenAICompatibleAdapter } from "./adapters/openaiCompatible.js";
import type { ModelAdapter } from "./adapters/types.js";
import { ProviderError } from "./errors/providerError.js";
import { createHealthRouter } from "./routes/health.js";
import { createModelsRouter } from "./routes/models.js";
import { createProvidersRouter } from "./routes/providers.js";
import { createUsageRouter } from "./routes/usage.js";
import { createWorkflowsRouter } from "./routes/workflows.js";

export interface AppDependencies {
  db: AppDatabase;
  env?: NodeJS.ProcessEnv;
  adapter?: ModelAdapter;
}

export function createApp(dependencies: AppDependencies) {
  const app = express();
  const { db } = dependencies;
  const env = dependencies.env ?? process.env;
  const adapter = dependencies.adapter ?? createOpenAICompatibleAdapter();

  app.use(cors({ origin: "http://127.0.0.1:5173" }));
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/health", createHealthRouter());
  app.use("/api/providers", createProvidersRouter(db));
  app.use("/api/models", createModelsRouter(db, { env }));
  app.use("/api/workflows", createWorkflowsRouter(db, { adapter, env }));
  app.use("/api/usage", createUsageRouter(db));

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ProviderError) {
      res.status(error.details.statusCode && error.details.statusCode >= 500 ? 502 : 400).json(error.toJSON());
      return;
    }

    res.status(500).json({ code: "internal_error", message: "Internal server error" });
  });

  return app;
}
```

Keep `server/src/index.ts` as the runtime owner of database creation:

```ts
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createDatabase, initializeSqlRuntime } from "./db/client.js";

dotenv.config();

const port = Number(process.env.PORT ?? 8787);

await initializeSqlRuntime();
const db = createDatabase(process.env.DATABASE_PATH ?? "./api-tools.db");
const app = createApp({ db });

app.listen(port, () => {
  console.log(`API Tools server listening on http://127.0.0.1:${port}`);
});
```

- [ ] **Step 7: Run route tests to verify they pass**

Run:

```bash
npm run test --workspace server -- src/routes/workflows.test.ts src/routes/usage.test.ts
```

Expected: PASS.

- [ ] **Step 8: Run all backend tests**

Run:

```bash
npm run test --workspace server
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add server/src/app.ts server/src/index.ts server/src/routes/workflows.ts server/src/routes/usage.ts server/src/usage/usageService.ts server/src/routes/workflows.test.ts server/src/routes/usage.test.ts
git commit -m "feat: add workflow execution route"
```

## Task 10: Frontend app shell and top navigation

**Files:**
- Create: `client/vite.config.ts`
- Create: `client/vitest.config.ts`
- Create: `client/src/test/setup.ts`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`
- Create: `client/src/components/TopNav.tsx`
- Create: `client/src/styles.css`
- Create: `client/src/App.test.tsx`

- [ ] **Step 1: Write failing app shell test**

Create `client/vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  }
});
```

Create `client/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"]
  }
});
```

Create `client/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `client/src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders top-level modules and switches pages", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "工作台" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "API接入" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "用量检测" }));

    expect(screen.getByRole("heading", { name: "用量检测" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test --workspace client -- src/App.test.tsx
```

Expected: FAIL because `App.tsx` does not exist.

- [ ] **Step 3: Implement app shell**

Create `client/src/components/TopNav.tsx`:

```tsx
export type PageKey = "workbench" | "providers" | "models" | "usage" | "workflows" | "settings";

interface TopNavProps {
  currentPage: PageKey;
  onPageChange: (page: PageKey) => void;
}

const navItems: Array<{ key: PageKey; label: string }> = [
  { key: "workbench", label: "工作台" },
  { key: "providers", label: "API接入" },
  { key: "models", label: "模型管理" },
  { key: "usage", label: "用量检测" },
  { key: "workflows", label: "工作流模板" },
  { key: "settings", label: "设置" }
];

export function TopNav({ currentPage, onPageChange }: TopNavProps) {
  return (
    <header className="top-nav">
      <div className="brand">API Tools</div>
      <nav aria-label="主导航">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={item.key === currentPage ? "active" : ""}
            type="button"
            onClick={() => onPageChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
```

Create `client/src/App.tsx`:

```tsx
import { useState } from "react";
import { TopNav, type PageKey } from "./components/TopNav";
import "./styles.css";

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <main className="page">
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  );
}

export function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>("workbench");

  return (
    <div className="app-shell">
      <TopNav currentPage={currentPage} onPageChange={setCurrentPage} />
      {currentPage === "workbench" && <PlaceholderPage title="工作台" description="创建会话、运行 workflow 并查看运行详情。" />}
      {currentPage === "providers" && <PlaceholderPage title="API接入" description="管理 provider、base URL 和 API Key 环境变量名。" />}
      {currentPage === "models" && <PlaceholderPage title="模型管理" description="管理模型 ID、能力、默认参数和价格。" />}
      {currentPage === "usage" && <PlaceholderPage title="用量检测" description="查看请求数、token、成本估算和错误数。" />}
      {currentPage === "workflows" && <PlaceholderPage title="工作流模板" description="查看内置工作流和模块链路。" />}
      {currentPage === "settings" && <PlaceholderPage title="设置" description="管理本地工具偏好。" />}
    </div>
  );
}
```

Create `client/src/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(<App />);
```

Create `client/src/styles.css`:

```css
:root {
  color: #111827;
  background: #f8fafc;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
}

.top-nav {
  align-items: center;
  background: #111827;
  color: white;
  display: flex;
  gap: 32px;
  padding: 14px 22px;
}

.brand {
  font-weight: 700;
}

.top-nav nav {
  display: flex;
  gap: 8px;
}

.top-nav button {
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: #d1d5db;
  cursor: pointer;
  padding: 8px 10px;
}

.top-nav button.active,
.top-nav button:hover {
  background: #374151;
  color: white;
}

.page {
  padding: 24px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm run test --workspace client -- src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/vite.config.ts client/vitest.config.ts client/src/test/setup.ts client/src/main.tsx client/src/App.tsx client/src/components/TopNav.tsx client/src/styles.css client/src/App.test.tsx
git commit -m "feat: add frontend app shell"
```

## Task 11: Frontend API client and management pages

**Files:**
- Create: `client/src/api/types.ts`
- Create: `client/src/api/client.ts`
- Create: `client/src/pages/ProvidersPage.tsx`
- Create: `client/src/pages/ModelsPage.tsx`
- Create: `client/src/pages/UsagePage.tsx`
- Modify: `client/src/App.tsx`
- Create: `client/src/pages/ProvidersPage.test.tsx`

- [ ] **Step 1: Write failing providers page test**

Create `client/src/pages/ProvidersPage.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProvidersPage } from "./ProvidersPage";

describe("ProvidersPage", () => {
  it("creates a provider", async () => {
    const api = {
      listProviders: vi.fn().mockResolvedValue([]),
      createProvider: vi.fn().mockResolvedValue({
        id: "provider-1",
        name: "DeepSeek",
        type: "openai-compatible",
        baseUrl: "https://api.deepseek.com/v1",
        apiKeyEnv: "DEEPSEEK_API_KEY",
        enabled: true
      })
    };

    render(<ProvidersPage api={api} />);

    await userEvent.type(screen.getByLabelText("名称"), "DeepSeek");
    await userEvent.type(screen.getByLabelText("Base URL"), "https://api.deepseek.com/v1");
    await userEvent.type(screen.getByLabelText("API Key 环境变量"), "DEEPSEEK_API_KEY");
    await userEvent.click(screen.getByRole("button", { name: "添加 Provider" }));

    await waitFor(() => expect(api.createProvider).toHaveBeenCalled());
    expect(await screen.findByText("DeepSeek")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test --workspace client -- src/pages/ProvidersPage.test.tsx
```

Expected: FAIL because page and API files do not exist.

- [ ] **Step 3: Implement API types and client**

Create `client/src/api/types.ts`:

```ts
export interface ProviderRecord {
  id: string;
  name: string;
  type: "openai-compatible" | "openai-official";
  baseUrl: string;
  apiKeyEnv: string;
  enabled: boolean;
}

export interface ModelRecord {
  id: string;
  providerId: string;
  displayName: string;
  modelId: string;
  capability: "chat" | "image" | "multimodal";
  enabled: boolean;
  defaultParams: Record<string, unknown>;
  pricing: Record<string, unknown>;
}

export interface UsageSummary {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  errorCount: number;
}

export type WorkflowStepType = "llm.chat";

export interface WorkflowStepDefinition {
  id: string;
  type: WorkflowStepType;
  modelId?: string;
  input: Record<string, unknown>;
}

export interface RunWorkflowRequest {
  sessionId?: string;
  workflowType: "api-workflow";
  input: Record<string, unknown>;
  steps: WorkflowStepDefinition[];
}

export interface RunWorkflowResponse {
  session: { id: string; title: string; workflowType: string };
  run: { id: string; status: "running" | "succeeded" | "failed" };
  outputs: Record<string, Record<string, unknown>>;
}
```

Create `client/src/api/client.ts`:

```ts
import type { ModelRecord, ProviderRecord, RunWorkflowRequest, RunWorkflowResponse, UsageSummary } from "./types";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  listProviders() {
    return requestJson<ProviderRecord[]>("/api/providers");
  },
  createProvider(input: Omit<ProviderRecord, "id">) {
    return requestJson<ProviderRecord>("/api/providers", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  listModels() {
    return requestJson<ModelRecord[]>("/api/models");
  },
  createModel(input: Omit<ModelRecord, "id">) {
    return requestJson<ModelRecord>("/api/models", {
      method: "POST",
      body: JSON.stringify(input)
    });
  },
  testModel(modelId: string) {
    return requestJson<{ ok: true; latencyMs: number; message: string }>(`/api/models/${modelId}/test`, { method: "POST" });
  },
  getUsageSummary() {
    return requestJson<UsageSummary>("/api/usage/summary");
  },
  runWorkflow(input: RunWorkflowRequest) {
    return requestJson<RunWorkflowResponse>("/api/workflows/run", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }
};

export type ApiClient = typeof apiClient;
```

- [ ] **Step 4: Implement providers page**

Create `client/src/pages/ProvidersPage.tsx`:

```tsx
import { FormEvent, useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import type { ProviderRecord } from "../api/types";

interface ProvidersPageProps {
  api: Pick<ApiClient, "listProviders" | "createProvider">;
}

export function ProvidersPage({ api }: ProvidersPageProps) {
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKeyEnv, setApiKeyEnv] = useState("");

  useEffect(() => {
    void api.listProviders().then(setProviders);
  }, [api]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const created = await api.createProvider({
      name,
      type: "openai-compatible",
      baseUrl,
      apiKeyEnv,
      enabled: true
    });
    setProviders((current) => [...current, created]);
    setName("");
    setBaseUrl("");
    setApiKeyEnv("");
  }

  return (
    <main className="page two-column">
      <section>
        <h1>API接入</h1>
        <form className="card-form" onSubmit={handleSubmit}>
          <label>
            名称
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Base URL
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
          </label>
          <label>
            API Key 环境变量
            <input value={apiKeyEnv} onChange={(event) => setApiKeyEnv(event.target.value)} />
          </label>
          <button type="submit">添加 Provider</button>
        </form>
      </section>
      <section>
        <h2>已接入 API</h2>
        <ul className="list">
          {providers.map((provider) => (
            <li key={provider.id}>
              <strong>{provider.name}</strong>
              <span>{provider.baseUrl}</span>
              <span>{provider.apiKeyEnv}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Implement model and usage pages**

Create `client/src/pages/ModelsPage.tsx`:

```tsx
import { FormEvent, useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import type { ModelRecord, ProviderRecord } from "../api/types";

interface ModelsPageProps {
  api: Pick<ApiClient, "listProviders" | "listModels" | "createModel" | "testModel">;
}

export function ModelsPage({ api }: ModelsPageProps) {
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [providerId, setProviderId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [modelId, setModelId] = useState("");
  const [testResult, setTestResult] = useState("");

  useEffect(() => {
    void Promise.all([api.listProviders(), api.listModels()]).then(([providerRows, modelRows]) => {
      setProviders(providerRows);
      setModels(modelRows);
      setProviderId(providerRows[0]?.id ?? "");
    });
  }, [api]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const created = await api.createModel({
      providerId,
      displayName,
      modelId,
      capability: "chat",
      enabled: true,
      defaultParams: {},
      pricing: {}
    });
    setModels((current) => [...current, created]);
    setDisplayName("");
    setModelId("");
  }

  async function handleTest(id: string) {
    try {
      const result = await api.testModel(id);
      setTestResult(`成功：${result.message}，延迟 ${result.latencyMs}ms`);
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : "测试失败");
    }
  }

  return (
    <main className="page two-column">
      <section>
        <h1>模型管理</h1>
        <form className="card-form" onSubmit={handleSubmit}>
          <label>
            Provider
            <select value={providerId} onChange={(event) => setProviderId(event.target.value)}>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
          </label>
          <label>
            显示名称
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label>
            Model ID
            <input value={modelId} onChange={(event) => setModelId(event.target.value)} />
          </label>
          <button type="submit" disabled={!providerId}>添加模型</button>
        </form>
        {testResult && <p className="notice">{testResult}</p>}
      </section>
      <section>
        <h2>模型列表</h2>
        <ul className="list">
          {models.map((model) => (
            <li key={model.id}>
              <strong>{model.displayName}</strong>
              <span>{model.modelId}</span>
              <button type="button" onClick={() => void handleTest(model.id)}>测试模型</button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

Create `client/src/pages/UsagePage.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import type { UsageSummary } from "../api/types";

interface UsagePageProps {
  api: Pick<ApiClient, "getUsageSummary">;
}

export function UsagePage({ api }: UsagePageProps) {
  const [summary, setSummary] = useState<UsageSummary | null>(null);

  useEffect(() => {
    void api.getUsageSummary().then(setSummary);
  }, [api]);

  return (
    <main className="page">
      <h1>用量检测</h1>
      <div className="metrics-grid">
        <div className="metric"><span>请求数</span><strong>{summary?.requestCount ?? 0}</strong></div>
        <div className="metric"><span>输入 Token</span><strong>{summary?.inputTokens ?? 0}</strong></div>
        <div className="metric"><span>输出 Token</span><strong>{summary?.outputTokens ?? 0}</strong></div>
        <div className="metric"><span>估算成本</span><strong>${summary?.estimatedCost ?? 0}</strong></div>
        <div className="metric"><span>错误数</span><strong>{summary?.errorCount ?? 0}</strong></div>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Update app to use real pages**

Modify `client/src/App.tsx` to this complete file:

```tsx
import { useState } from "react";
import { apiClient } from "./api/client";
import { TopNav, type PageKey } from "./components/TopNav";
import { ModelsPage } from "./pages/ModelsPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { UsagePage } from "./pages/UsagePage";
import "./styles.css";

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <main className="page">
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  );
}

export function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>("workbench");

  return (
    <div className="app-shell">
      <TopNav currentPage={currentPage} onPageChange={setCurrentPage} />
      {currentPage === "workbench" && <PlaceholderPage title="工作台" description="创建会话、运行 workflow 并查看运行详情。" />}
      {currentPage === "providers" && <ProvidersPage api={apiClient} />}
      {currentPage === "models" && <ModelsPage api={apiClient} />}
      {currentPage === "usage" && <UsagePage api={apiClient} />}
      {currentPage === "workflows" && <PlaceholderPage title="工作流模板" description="查看内置工作流和模块链路。" />}
      {currentPage === "settings" && <PlaceholderPage title="设置" description="管理本地工具偏好。" />}
    </div>
  );
}
```

- [ ] **Step 7: Extend styles for forms and metrics**

Append to `client/src/styles.css`:

```css
.two-column {
  display: grid;
  gap: 24px;
  grid-template-columns: 360px 1fr;
}

.card-form {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  display: grid;
  gap: 14px;
  padding: 18px;
}

.card-form label {
  display: grid;
  gap: 6px;
  font-weight: 600;
}

.card-form input,
.card-form select {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 9px 10px;
}

.card-form button,
.list button {
  background: #111827;
  border: 0;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  padding: 9px 12px;
}

.list {
  display: grid;
  gap: 10px;
  list-style: none;
  padding: 0;
}

.list li {
  align-items: center;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 14px;
}

.notice {
  background: #ecfeff;
  border: 1px solid #a5f3fc;
  border-radius: 10px;
  padding: 10px 12px;
}

.metrics-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.metric {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  display: grid;
  gap: 8px;
  padding: 18px;
}

.metric span {
  color: #6b7280;
}

.metric strong {
  font-size: 28px;
}
```

- [ ] **Step 8: Run providers page test**

Run:

```bash
npm run test --workspace client -- src/pages/ProvidersPage.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Run all frontend tests**

Run:

```bash
npm run test --workspace client
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add client/src/api/types.ts client/src/api/client.ts client/src/pages/ProvidersPage.tsx client/src/pages/ModelsPage.tsx client/src/pages/UsagePage.tsx client/src/App.tsx client/src/pages/ProvidersPage.test.tsx client/src/styles.css
git commit -m "feat: add api management pages"
```

## Task 12: Frontend workflow workbench page

**Files:**
- Create: `client/src/pages/WorkbenchPage.tsx`
- Modify: `client/src/App.tsx`
- Create: `client/src/pages/WorkbenchPage.test.tsx`

- [ ] **Step 1: Write failing workbench test**

Create `client/src/pages/WorkbenchPage.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkbenchPage } from "./WorkbenchPage";

describe("WorkbenchPage", () => {
  it("runs a single llm.chat workflow", async () => {
    const api = {
      listModels: vi.fn().mockResolvedValue([
        {
          id: "model-1",
          providerId: "provider-1",
          displayName: "Fast Chat",
          modelId: "fast-chat",
          capability: "chat",
          enabled: true,
          defaultParams: {},
          pricing: {}
        }
      ]),
      runWorkflow: vi.fn().mockResolvedValue({
        outputs: { "main-response": { content: "Hello from model" } },
        run: { id: "run-1", status: "succeeded" }
      })
    };

    render(<WorkbenchPage api={api} />);

    await screen.findByText("Fast Chat");
    await userEvent.type(screen.getByLabelText("消息"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => expect(api.runWorkflow).toHaveBeenCalledWith({
      workflowType: "api-workflow",
      input: { message: "Hello" },
      steps: [
        {
          id: "main-response",
          type: "llm.chat",
          modelId: "model-1",
          input: { message: "{{input.message}}" }
        }
      ]
    }));
    expect(await screen.findByText("Hello from model")).toBeInTheDocument();
    expect(screen.getByText("succeeded")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test --workspace client -- src/pages/WorkbenchPage.test.tsx
```

Expected: FAIL because `WorkbenchPage.tsx` does not exist.

- [ ] **Step 3: Implement workbench page**

Create `client/src/pages/WorkbenchPage.tsx`:

```tsx
import { FormEvent, useEffect, useState } from "react";
import type { ApiClient } from "../api/client";
import type { ModelRecord } from "../api/types";

interface WorkbenchPageProps {
  api: Pick<ApiClient, "listModels" | "runWorkflow">;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function WorkbenchPage({ api }: WorkbenchPageProps) {
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [runStatus, setRunStatus] = useState("idle");

  useEffect(() => {
    void api.listModels().then((rows) => {
      const chatModels = rows.filter((model) => model.capability === "chat" || model.capability === "multimodal");
      setModels(chatModels);
      setSelectedModelId(chatModels[0]?.id ?? "");
    });
  }, [api]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedModelId || !message.trim()) return;

    const userMessage = message.trim();
    setMessages((current) => [...current, { role: "user", content: userMessage }]);
    setMessage("");
    setRunStatus("running");

    try {
      const result = await api.runWorkflow({
        workflowType: "api-workflow",
        input: { message: userMessage },
        steps: [
          {
            id: "main-response",
            type: "llm.chat",
            modelId: selectedModelId,
            input: { message: "{{input.message}}" }
          }
        ]
      });
      setMessages((current) => [...current, { role: "assistant", content: String(result.outputs["main-response"]?.content ?? "") }]);
      setRunStatus(result.run.status);
    } catch (error) {
      setRunStatus(error instanceof Error ? error.message : "failed");
    }
  }

  return (
    <main className="workbench-page">
      <aside className="workbench-sidebar">
        <h2>会话列表</h2>
        <button type="button">+ 单步 LLM Chat</button>
        <button type="button" disabled>HTTP Request 占位</button>
        <button type="button" disabled>多步骤编排占位</button>
      </aside>
      <section className="workflow-panel">
        <h1>工作台</h1>
        <label>
          当前模型
          <select value={selectedModelId} onChange={(event) => setSelectedModelId(event.target.value)}>
            {models.map((model) => (
              <option key={model.id} value={model.id}>{model.displayName}</option>
            ))}
          </select>
        </label>
        <div className="messages" aria-label="消息列表">
          {messages.map((item, index) => (
            <div key={`${item.role}-${index}`} className={`message ${item.role}`}>
              <strong>{item.role === "user" ? "你" : "模型"}</strong>
              <p>{item.content}</p>
            </div>
          ))}
        </div>
        <form className="workflow-input" onSubmit={handleSubmit}>
          <label>
            消息
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} />
          </label>
          <button type="submit" disabled={!selectedModelId}>发送</button>
        </form>
      </section>
      <aside className="run-panel">
        <h2>运行详情</h2>
        <dl>
          <dt>Workflow</dt>
          <dd>单步 LLM Chat</dd>
          <dt>Run 状态</dt>
          <dd>{runStatus}</dd>
        </dl>
      </aside>
    </main>
  );
}
```

- [ ] **Step 4: Update app to render workbench page**

Modify `client/src/App.tsx` to this complete file:

```tsx
import { useState } from "react";
import { apiClient } from "./api/client";
import { TopNav, type PageKey } from "./components/TopNav";
import { ModelsPage } from "./pages/ModelsPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { UsagePage } from "./pages/UsagePage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import "./styles.css";

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <main className="page">
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  );
}

export function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>("workbench");

  return (
    <div className="app-shell">
      <TopNav currentPage={currentPage} onPageChange={setCurrentPage} />
      {currentPage === "workbench" && <WorkbenchPage api={apiClient} />}
      {currentPage === "providers" && <ProvidersPage api={apiClient} />}
      {currentPage === "models" && <ModelsPage api={apiClient} />}
      {currentPage === "usage" && <UsagePage api={apiClient} />}
      {currentPage === "workflows" && <PlaceholderPage title="工作流模板" description="查看内置工作流和模块链路。" />}
      {currentPage === "settings" && <PlaceholderPage title="设置" description="管理本地工具偏好。" />}
    </div>
  );
}
```

- [ ] **Step 5: Add workbench styles**

Append to `client/src/styles.css`:

```css
.workbench-page {
  display: grid;
  gap: 16px;
  grid-template-columns: 240px 1fr 280px;
  min-height: calc(100vh - 60px);
  padding: 16px;
}

.workbench-sidebar,
.workflow-panel,
.run-panel {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 16px;
}

.workbench-sidebar {
  align-content: start;
  display: grid;
  gap: 10px;
}

.workbench-sidebar button,
.workflow-input button {
  background: #111827;
  border: 0;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  padding: 9px 12px;
}

.workbench-sidebar button:disabled,
.workflow-input button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.workflow-panel {
  display: grid;
  gap: 16px;
  grid-template-rows: auto auto 1fr auto;
}

.workflow-panel label,
.workflow-input label {
  display: grid;
  gap: 6px;
  font-weight: 600;
}

.workflow-panel select,
.workflow-input textarea {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 9px 10px;
}

.messages {
  background: #f9fafb;
  border-radius: 12px;
  display: grid;
  gap: 10px;
  min-height: 240px;
  padding: 12px;
}

.message {
  border-radius: 10px;
  padding: 10px;
}

.message.user {
  background: #eff6ff;
}

.message.assistant {
  background: #ecfdf5;
}

.workflow-input {
  display: grid;
  gap: 10px;
}

.workflow-input textarea {
  min-height: 90px;
  resize: vertical;
}

.run-panel dl {
  display: grid;
  gap: 8px;
}

.run-panel dt {
  color: #6b7280;
  font-weight: 700;
}

.run-panel dd {
  margin: 0;
}
```

- [ ] **Step 6: Run workbench test**

Run:

```bash
npm run test --workspace client -- src/pages/WorkbenchPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run all frontend tests**

Run:

```bash
npm run test --workspace client
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/WorkbenchPage.tsx client/src/pages/WorkbenchPage.test.tsx client/src/App.tsx client/src/styles.css
git commit -m "feat: add workflow workbench"
```

## Task 13: Workflow templates and settings placeholders

**Files:**
- Create: `client/src/pages/WorkflowTemplatesPage.tsx`
- Create: `client/src/pages/SettingsPage.tsx`
- Modify: `client/src/App.tsx`
- Create: `client/src/pages/WorkflowTemplatesPage.test.tsx`

- [ ] **Step 1: Write failing workflow templates test**

Create `client/src/pages/WorkflowTemplatesPage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkflowTemplatesPage } from "./WorkflowTemplatesPage";

describe("WorkflowTemplatesPage", () => {
  it("shows built-in workflow step templates", () => {
    render(<WorkflowTemplatesPage />);

    expect(screen.getByRole("heading", { name: "工作流模板" })).toBeInTheDocument();
    expect(screen.getByText("单步 LLM Chat")).toBeInTheDocument();
    expect(screen.getByText("llm.chat step")).toBeInTheDocument();
    expect(screen.getByText("HTTP Request 占位")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm run test --workspace client -- src/pages/WorkflowTemplatesPage.test.tsx
```

Expected: FAIL because page does not exist.

- [ ] **Step 3: Implement workflow templates and settings pages**

Create `client/src/pages/WorkflowTemplatesPage.tsx`:

```tsx
const workflows = [
  {
    name: "单步 LLM Chat",
    description: "用户输入经过一个 llm.chat step，返回模型输出。",
    modules: ["llm.chat step"]
  },
  {
    name: "HTTP Request 占位",
    description: "后续用于把任意 REST API 封装成 http.request step。",
    modules: ["http.request step"]
  },
  {
    name: "多步骤 API 编排占位",
    description: "后续用于串联 API 请求、数据转换、LLM 分析和 webhook 输出。",
    modules: ["http.request step", "json.transform step", "llm.chat step"]
  }
];

export function WorkflowTemplatesPage() {
  return (
    <main className="page">
      <h1>工作流模板</h1>
      <div className="workflow-grid">
        {workflows.map((workflow) => (
          <article className="workflow-card" key={workflow.name}>
            <h2>{workflow.name}</h2>
            <p>{workflow.description}</p>
            <ol>
              {workflow.modules.map((moduleName) => (
                <li key={moduleName}>{moduleName}</li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </main>
  );
}
```

Create `client/src/pages/SettingsPage.tsx`:

```tsx
export function SettingsPage() {
  return (
    <main className="page">
      <h1>设置</h1>
      <div className="settings-card">
        <h2>本地个人模式</h2>
        <p>API Key 从后端 `.env` 读取；前端只显示环境变量名，不显示完整密钥。</p>
        <p>SQLite 数据库路径由 `DATABASE_PATH` 控制。</p>
        <p>Workflow 默认执行策略先保持顺序执行；后续再加入重试、条件分支和并发。</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Update app to use pages**

Modify `client/src/App.tsx` to this complete file:

```tsx
import { useState } from "react";
import { apiClient } from "./api/client";
import { TopNav, type PageKey } from "./components/TopNav";
import { ModelsPage } from "./pages/ModelsPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsagePage } from "./pages/UsagePage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import { WorkflowTemplatesPage } from "./pages/WorkflowTemplatesPage";
import "./styles.css";

export function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>("workbench");

  return (
    <div className="app-shell">
      <TopNav currentPage={currentPage} onPageChange={setCurrentPage} />
      {currentPage === "workbench" && <WorkbenchPage api={apiClient} />}
      {currentPage === "providers" && <ProvidersPage api={apiClient} />}
      {currentPage === "models" && <ModelsPage api={apiClient} />}
      {currentPage === "usage" && <UsagePage api={apiClient} />}
      {currentPage === "workflows" && <WorkflowTemplatesPage />}
      {currentPage === "settings" && <SettingsPage />}
    </div>
  );
}
```

- [ ] **Step 5: Add template styles**

Append to `client/src/styles.css`:

```css
.workflow-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.workflow-card,
.settings-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 18px;
}
```

- [ ] **Step 6: Run workflow templates test**

Run:

```bash
npm run test --workspace client -- src/pages/WorkflowTemplatesPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run all frontend tests**

Run:

```bash
npm run test --workspace client
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/WorkflowTemplatesPage.tsx client/src/pages/SettingsPage.tsx client/src/App.tsx client/src/pages/WorkflowTemplatesPage.test.tsx client/src/styles.css
git commit -m "feat: add workflow template pages"
```

## Task 14: Final verification for V0.1 plan

**Files:**
- Modify: `docs/superpowers/plans/2026-05-29-api-tools-v0-1-workbench.md` only if execution reveals plan corrections are needed.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: server and client tests pass.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: server and client TypeScript checks pass.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: server TypeScript build and client Vite build pass.

- [ ] **Step 4: Start the local app**

Create `.env` from `.env.example` and set at least one usable API key variable. Then run:

```bash
npm run dev
```

Expected:

- Server starts on `http://127.0.0.1:8787`.
- Client starts on `http://127.0.0.1:5173`.

- [ ] **Step 5: Manual verification in browser**

Open `http://127.0.0.1:5173` and verify:

1. Top navigation includes 工作台, API接入, 模型管理, 用量检测, 工作流模板, 设置.
2. API接入 can create a provider.
3. 模型管理 can create or import a model usable by `llm.chat`.
4. 模型管理 can test the model and show success or a standardized error.
5. 工作台 can select a model, run a single-step `llm.chat` workflow, and display the model output.
6. 运行详情 shows the generic workflow run status.
7. 用量检测 shows request count and tokens after a workflow run.
8. Frontend never displays a full API key.

- [ ] **Step 6: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intentionally untracked local files remain, such as `.env`.

- [ ] **Step 7: Commit any final fixes**

If verification required fixes, stage only relevant files and commit:

```bash
git add <fixed-files>
git commit -m "fix: complete v0.1 verification"
```

Expected: no commit is created if no fixes were needed.

## Plan self-review

- Spec coverage: this plan covers scaffold, API接入, 模型管理, OpenAI-compatible chat, model testing, generic workflow execution with a first `llm.chat` step, run/run_step records, a workflow workbench, and minimal usage summary. It intentionally defers image2, arbitrary HTTP/API step execution, advanced usage analytics, and full visual workflow editing to later plans.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain. Deferred scope is explicitly named as later plans.
- Type consistency: provider/model/session/run/run_step names match the design spec and remain consistent across repositories, routes, runner, workflow step types, and frontend API types.
