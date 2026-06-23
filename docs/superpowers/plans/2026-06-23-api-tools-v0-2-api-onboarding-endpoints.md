# API Tools v0.2 API Onboarding and Endpoint Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize provider/model onboarding, add capability-aware API management, expose call traces, and introduce the first generic HTTP endpoint foundation while leaving conversation memory as a separate design track.

**Architecture:** The backend remains Express + SQLite repositories + adapter bridges. Provider capability metadata becomes the decision layer for UI affordances and route behavior. Endpoint support is introduced as a separate resource next to providers/models, using `http.request` as the internal operation contract but keeping workflow execution for endpoints out of this phase unless endpoint testing needs shared invocation code.

**Tech Stack:** TypeScript, Express, better-sqlite3, Vitest, React, React Testing Library, Vite, CSS modules/global CSS already present in the client.

---

## Scope

This phase implements:

- Conversation memory strategy as a documented backlog item, not runtime behavior.
- Provider capability profiles.
- Provider detail/status improvements.
- Standardized remote model listing errors.
- Productized manual model import.
- Enhanced model test console.
- Run history / run step trace UI.
- `http.request` operation contract update.
- Endpoint schema, repository, routes, test execution, and frontend management.
- Key safety rules.
- Configuration import/export without secret values.
- Full verification.

This phase does not implement:

- Long-term memory, vector memory, summary memory, or provider-specific thread execution.
- Agent tool use.
- Endpoint execution inside multi-step workflows.
- File upload, RAG, or prompt template marketplace.

---

## Dependency Order

1. Memory strategy backlog documentation.
2. Provider capability profile.
3. Provider detail/status surfaces.
4. Remote model listing error standardization.
5. Manual model import productization.
6. Model test console improvements.
7. Run history and trace views.
8. `http.request` operation contract.
9. Endpoint database/repository.
10. Endpoint CRUD routes.
11. Endpoint test execution.
12. Endpoint frontend page.
13. Key safety hardening.
14. Configuration import/export.
15. Final verification.

---

## Task 1: Add conversation memory strategy backlog

**Files:**
- Create: `docs/superpowers/specs/2026-06-23-conversation-memory-strategy-backlog.md`
- Modify: `docs/superpowers/plans/2026-06-23-api-tools-v0-2-api-onboarding-endpoints.md`

- [x] **Step 1: Create the backlog document**

Create `docs/superpowers/specs/2026-06-23-conversation-memory-strategy-backlog.md` with these sections:

```md
# Conversation Memory Strategy Backlog

## Status

Deferred from API Tools v0.2 runtime implementation. This document records the design work required before memory behavior is added.

## Reason

Conversation memory affects session storage, adapter inputs, provider metadata, workflow traces, privacy, and UI behavior. Implementing one memory model before the project has a clear strategy would make future provider support harder.

## Candidate Strategies

### Local message replay

The system stores all messages locally and sends selected prior messages to `llm.chat` on each request.

### Remote conversation identifier

The system stores a provider-specific `remoteConversationId` or equivalent metadata when a provider exposes one.

### Summary memory

The system periodically summarizes old messages and sends the summary plus recent turns.

### Long-term structured memory

The system stores durable user/project facts outside individual sessions.

### Vector memory

The system embeds and retrieves relevant conversation fragments.

## Design Questions

- Which memory mode is the default for providers that expose only Chat Completions?
- How does the UI show what memory was used for a request?
- How are remote conversation identifiers stored without leaking provider-specific concepts into the core protocol?
- Which data is safe to store long term?
- How can a user clear local and remote memory?

## Phase Boundary

API Tools v0.2 may store ordinary messages and run traces, but it must not implement long-term memory, vector retrieval, summary memory, or provider-specific remote thread behavior.
```

- [x] **Step 2: Run placeholder scan**

Run:

```bash
rg -n -e "TB[D]" -e "TO[D]O" -e "PLACEHOLD[ER]" -e "待[定]" -e "未[定]" docs/superpowers/specs/2026-06-23-conversation-memory-strategy-backlog.md
```

Expected: no output.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-06-23-conversation-memory-strategy-backlog.md docs/superpowers/plans/2026-06-23-api-tools-v0-2-api-onboarding-endpoints.md
git commit -m "docs: add conversation memory strategy backlog"
```

---

## Task 2: Add provider capability profile

**Files:**
- Modify: `server/src/db/schema.ts`
- Modify: `server/src/providers/providerRepository.ts`
- Modify: `server/src/providers/providerRepository.test.ts`
- Modify: `server/src/routes/providers.test.ts`
- Modify: `client/src/api/client.ts`

- [x] **Step 1: Add failing repository test**

Add a test that creates a provider and expects capability defaults:

```ts
expect(provider.capabilities).toEqual({
  supportsChat: true,
  supportsModelListing: true,
  supportsManualModelImport: true,
  supportsStreaming: false,
  supportsToolCalling: false,
  supportsVision: false,
  supportsRemoteConversation: false,
  requiresManualModelImport: false
});
```

Run:

```bash
npm run test --workspace server -- src/providers/providerRepository.test.ts
```

Expected: FAIL because `capabilities` is not returned.

- [x] **Step 2: Add schema column**

Add `capabilities_json text not null default '{}'` to `providers`.

Store provider capabilities as JSON to avoid repeated migrations while the capability matrix evolves.

- [x] **Step 3: Add provider capability types and defaults**

Add `ProviderCapabilities` and `DEFAULT_PROVIDER_CAPABILITIES` in `providerRepository.ts`.

Default values:

```ts
{
  supportsChat: true,
  supportsModelListing: true,
  supportsManualModelImport: true,
  supportsStreaming: false,
  supportsToolCalling: false,
  supportsVision: false,
  supportsRemoteConversation: false,
  requiresManualModelImport: false
}
```

- [x] **Step 4: Map capabilities in create/list/get**

Ensure provider create input accepts optional `capabilities`, persists it, and row mapping merges stored values over defaults.

- [x] **Step 5: Update route tests**

Update provider route tests to assert returned JSON includes `capabilities`.

- [x] **Step 6: Update client API type**

Update the frontend provider type to include the capability object.

- [x] **Step 7: Verify**

Run:

```bash
npm run test --workspace server -- src/providers/providerRepository.test.ts src/routes/providers.test.ts
npm run typecheck --workspace server
npm run typecheck --workspace client
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add server/src/db/schema.ts server/src/providers/providerRepository.ts server/src/providers/providerRepository.test.ts server/src/routes/providers.test.ts client/src/api/client.ts
git commit -m "feat: add provider capability profile"
```

---

## Task 3: Expose provider detail and connection status

**Files:**
- Modify: `server/src/routes/providers.ts`
- Modify: `server/src/routes/providers.test.ts`
- Modify: `client/src/pages/ProvidersPage.tsx`
- Modify: `client/src/pages/ProvidersPage.test.tsx`

- [x] **Step 1: Add failing provider status tests**

Add route tests for returned provider fields:

```ts
expect(provider).toMatchObject({
  name: "TJU",
  apiFormat: "openai-chat-completions",
  apiKeyEnv: "TJU_API_KEY",
  enabled: true,
  capabilities: expect.objectContaining({
    supportsManualModelImport: true
  })
});
```

- [x] **Step 2: Update provider page data rendering**

Show provider connection details:

- API format
- Base URL
- API key env name
- Enabled state
- Capability badges
- Manual model import requirement when `requiresManualModelImport` is true

- [x] **Step 3: Add frontend test**

Assert provider details and capability badges render after loading `/api/providers`.

- [x] **Step 4: Verify**

Run:

```bash
npm run test --workspace server -- src/routes/providers.test.ts
npm run test --workspace client -- src/pages/ProvidersPage.test.tsx
npm run typecheck --workspace client
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add server/src/routes/providers.ts server/src/routes/providers.test.ts client/src/pages/ProvidersPage.tsx client/src/pages/ProvidersPage.test.tsx
git commit -m "feat: show provider connection status"
```

---

## Task 4: Standardize remote model listing errors

**Files:**
- Modify: `server/src/adapters/openaiChatCompletions.ts`
- Modify: `server/src/adapters/openaiChatCompletions.test.ts`
- Modify: `server/src/errors/providerError.ts`
- Modify: `server/src/routes/providerRemoteModels.test.ts` or existing remote model route test file
- Modify: `client/src/pages/ModelsPage.tsx`
- Modify: `client/src/pages/ModelsPage.test.tsx`

- [x] **Step 1: Add failing adapter test for HTML model-list response**

Mock `/models` returning `text/html` and assert the provider error code is `model_listing_unsupported` or `unexpected_response_shape`.

- [x] **Step 2: Add error code**

Add a standard provider error code for model listing shape failures.

- [x] **Step 3: Update model list parser**

When `/models` returns non-JSON or JSON without an array-like model list, return a standardized provider error with a suggestion to use manual model import.

- [x] **Step 4: Update frontend messaging**

When remote model listing fails with this code, show a non-blocking message that manual import is available.

- [x] **Step 5: Verify**

Run:

```bash
npm run test --workspace server -- src/adapters/openaiChatCompletions.test.ts
npm run test --workspace client -- src/pages/ModelsPage.test.tsx
npm run typecheck --workspace server
npm run typecheck --workspace client
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add server/src/adapters/openaiChatCompletions.ts server/src/adapters/openaiChatCompletions.test.ts server/src/errors/providerError.ts server/src/routes client/src/pages/ModelsPage.tsx client/src/pages/ModelsPage.test.tsx
git commit -m "fix: standardize remote model listing errors"
```

---

## Task 5: Productize manual model import

**Files:**
- Modify: `client/src/pages/ModelsPage.tsx`
- Modify: `client/src/pages/ModelsPage.test.tsx`
- Modify: `server/src/routes/providerImportModels.test.ts`

- [x] **Step 1: Add failing frontend test**

Test that a user can select a provider, enter `modelId`, submit manual import, and see the model in the local list.

- [x] **Step 2: Add manual import UI**

Add a form with:

- provider select
- model ID input
- display name input
- capability select
- enabled checkbox
- import button

- [x] **Step 3: Add automatic refresh**

After successful import, refresh local models and show success notification.

- [x] **Step 4: Verify backend import still accepts direct input**

Run existing import route tests and add one assertion that importing a model without prior remote list lookup succeeds.

- [x] **Step 5: Verify**

Run:

```bash
npm run test --workspace server -- src/routes/providerImportModels.test.ts
npm run test --workspace client -- src/pages/ModelsPage.test.tsx
npm run typecheck --workspace client
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add client/src/pages/ModelsPage.tsx client/src/pages/ModelsPage.test.tsx server/src/routes/providerImportModels.test.ts
git commit -m "feat: add manual model import workflow"
```

---

## Task 6: Enhance model test console

**Files:**
- Modify: `server/src/routes/modelTest.ts`
- Modify: `server/src/routes/modelTest.test.ts`
- Modify: `client/src/pages/ModelsPage.tsx`
- Modify: `client/src/pages/ModelsPage.test.tsx`

- [x] **Step 1: Add failing route test for custom prompt**

Test `POST /api/models/:id/test` with body:

```json
{
  "message": "只回复 ok",
  "params": {
    "temperature": 0,
    "maxTokens": 20
  }
}
```

Expected response includes `ok`, `latencyMs`, `message`, and `usage`.

- [x] **Step 2: Extend model test request parser**

Accept optional message and params while preserving the current default test behavior.

- [x] **Step 3: Add frontend test console controls**

Add prompt textarea, parameter fields, and response detail rendering.

- [x] **Step 4: Verify**

Run:

```bash
npm run test --workspace server -- src/routes/modelTest.test.ts
npm run test --workspace client -- src/pages/ModelsPage.test.tsx
npm run typecheck --workspace server
npm run typecheck --workspace client
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add server/src/routes/modelTest.ts server/src/routes/modelTest.test.ts client/src/pages/ModelsPage.tsx client/src/pages/ModelsPage.test.tsx
git commit -m "feat: improve model test console"
```

---

## Task 7: Add run history and trace UI

**Files:**
- Modify: `server/src/routes/usage.ts` or create `server/src/routes/runs.ts`
- Create: `server/src/routes/runs.test.ts`
- Modify: `server/src/app.ts`
- Create: `client/src/pages/RunsPage.tsx`
- Create: `client/src/pages/RunsPage.test.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add failing backend test for run list**

Seed `runs` and `run_steps`, then assert route output includes run status, model/provider IDs, latency, error code, and previews.

- [ ] **Step 2: Add run routes**

Add:

```text
GET /api/runs
GET /api/runs/:id
```

- [ ] **Step 3: Add frontend page**

Render a run table and selected run detail panel.

- [ ] **Step 4: Add navigation item**

Add a Runs or History nav item in the existing app navigation.

- [ ] **Step 5: Verify**

Run:

```bash
npm run test --workspace server -- src/routes/runs.test.ts
npm run test --workspace client -- src/pages/RunsPage.test.tsx src/App.test.tsx
npm run typecheck --workspace server
npm run typecheck --workspace client
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/runs.ts server/src/routes/runs.test.ts server/src/app.ts client/src/pages/RunsPage.tsx client/src/pages/RunsPage.test.tsx client/src/App.tsx
git commit -m "feat: add run history view"
```

---

## Task 8: Update `http.request` operation contract

**Files:**
- Modify: `server/src/apiProtocol/operationCatalog.ts`
- Create: `server/src/apiProtocol/httpRequest.ts`
- Create: `server/src/apiProtocol/httpRequest.test.ts`
- Modify: `docs/superpowers/specs/operations/2026-06-06-http-request-reserved-operation.md`

- [ ] **Step 1: Add failing protocol parser tests**

Test method, path, headers, query, body, and timeout parsing.

- [ ] **Step 2: Implement `parseHttpRequestInput()`**

Accept:

```ts
method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
path: string;
query?: Record<string, string | number | boolean>;
headers?: Record<string, string>;
body?: unknown;
timeoutMs?: number;
```

- [ ] **Step 3: Keep workflow execution disabled**

The catalog status can move from reserved to implemented for endpoint testing, while `workflowStep` remains false in this phase.

- [ ] **Step 4: Update operation doc**

Rename the status from reserved-only to endpoint-test implemented, workflow-execution disabled.

- [ ] **Step 5: Verify**

Run:

```bash
npm run test --workspace server -- src/apiProtocol/httpRequest.test.ts src/apiProtocol/operationCatalog.test.ts
npm run typecheck --workspace server
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/apiProtocol/operationCatalog.ts server/src/apiProtocol/httpRequest.ts server/src/apiProtocol/httpRequest.test.ts docs/superpowers/specs/operations/2026-06-06-http-request-reserved-operation.md
git commit -m "feat: define http request operation contract"
```

---

## Task 9: Add endpoint schema and repository

**Files:**
- Modify: `server/src/db/schema.ts`
- Create: `server/src/endpoints/endpointRepository.ts`
- Create: `server/src/endpoints/endpointRepository.test.ts`

- [ ] **Step 1: Add failing repository tests**

Test create, list, get, update, delete, and provider cascade behavior.

- [ ] **Step 2: Add `endpoints` table**

Fields:

```text
id
provider_id
name
operation_id
method
path
query_template_json
headers_template_json
body_template_json
enabled
created_at
updated_at
```

- [ ] **Step 3: Implement endpoint repository**

Functions:

```ts
create(input)
list()
listByProvider(providerId)
getById(id)
update(id, input)
delete(id)
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run test --workspace server -- src/endpoints/endpointRepository.test.ts src/db/schema.test.ts
npm run typecheck --workspace server
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/db/schema.ts server/src/endpoints/endpointRepository.ts server/src/endpoints/endpointRepository.test.ts
git commit -m "feat: add endpoint repository"
```

---

## Task 10: Add endpoint CRUD routes

**Files:**
- Create: `server/src/routes/endpoints.ts`
- Create: `server/src/routes/endpoints.test.ts`
- Modify: `server/src/app.ts`
- Modify: `client/src/api/client.ts`

- [ ] **Step 1: Add failing route tests**

Test:

- create endpoint
- list endpoints
- get endpoint
- update endpoint
- delete endpoint
- reject missing provider
- reject full URL path

- [ ] **Step 2: Implement routes**

Add:

```text
GET /api/endpoints
POST /api/endpoints
GET /api/endpoints/:id
PATCH /api/endpoints/:id
DELETE /api/endpoints/:id
```

- [ ] **Step 3: Register routes in app**

Mount endpoint routes under `/api/endpoints`.

- [ ] **Step 4: Update client API**

Add endpoint types and functions.

- [ ] **Step 5: Verify**

Run:

```bash
npm run test --workspace server -- src/routes/endpoints.test.ts
npm run typecheck --workspace server
npm run typecheck --workspace client
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/endpoints.ts server/src/routes/endpoints.test.ts server/src/app.ts client/src/api/client.ts
git commit -m "feat: add endpoint routes"
```

---

## Task 11: Add endpoint test runner

**Files:**
- Create: `server/src/endpoints/endpointTester.ts`
- Create: `server/src/endpoints/endpointTester.test.ts`
- Modify: `server/src/routes/endpoints.ts`
- Modify: `server/src/routes/endpoints.test.ts`

- [ ] **Step 1: Add failing endpoint tester tests**

Mock fetch and assert URL construction, auth header handling, query serialization, body serialization, response parsing, and provider error mapping.

- [ ] **Step 2: Implement endpoint tester**

Use provider `baseUrl`, endpoint `path`, templates, and input object to send an HTTP request.

- [ ] **Step 3: Add test route**

Add:

```text
POST /api/endpoints/:id/test
```

- [ ] **Step 4: Verify**

Run:

```bash
npm run test --workspace server -- src/endpoints/endpointTester.test.ts src/routes/endpoints.test.ts
npm run typecheck --workspace server
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/endpoints/endpointTester.ts server/src/endpoints/endpointTester.test.ts server/src/routes/endpoints.ts server/src/routes/endpoints.test.ts
git commit -m "feat: add endpoint test runner"
```

---

## Task 12: Add endpoint management page

**Files:**
- Create: `client/src/pages/EndpointsPage.tsx`
- Create: `client/src/pages/EndpointsPage.test.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/styles.css` or current app stylesheet

- [ ] **Step 1: Add failing frontend test**

Mock endpoint and provider API calls. Test create endpoint, list endpoint, and run endpoint test.

- [ ] **Step 2: Implement page**

Render:

- endpoint list
- create/edit form
- provider selector
- method selector
- path input
- headers/query/body JSON textareas
- enabled toggle
- test input textarea
- test result panel

- [ ] **Step 3: Add navigation**

Add the endpoint page to the existing app navigation.

- [ ] **Step 4: Verify**

Run:

```bash
npm run test --workspace client -- src/pages/EndpointsPage.test.tsx src/App.test.tsx
npm run typecheck --workspace client
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/EndpointsPage.tsx client/src/pages/EndpointsPage.test.tsx client/src/App.tsx client/src/styles.css
git commit -m "feat: add endpoint management page"
```

---

## Task 13: Harden API key safety

**Files:**
- Modify: `server/src/config/dotenvFile.ts`
- Modify: `server/src/config/dotenvFile.test.ts`
- Modify: `server/src/routes/providers.ts`
- Modify: `server/src/routes/providers.test.ts`
- Modify: `client/src/pages/ProvidersPage.tsx`
- Modify: `client/src/pages/ProvidersPage.test.tsx`

- [ ] **Step 1: Add failing dotenv format tests**

Assert saved values are written without leading spaces and quoted only when required.

- [ ] **Step 2: Add raw key rejection tests**

Provider `apiKeyEnv` must reject values starting with `sk-`, `tk-`, or containing long secret-like strings.

- [ ] **Step 3: Implement validation**

Reject raw key in `apiKeyEnv` and keep existing optional API key save flow.

- [ ] **Step 4: Update frontend copy and validation**

Make provider form distinguish API key env variable from actual API key.

- [ ] **Step 5: Verify**

Run:

```bash
npm run test --workspace server -- src/config/dotenvFile.test.ts src/routes/providers.test.ts
npm run test --workspace client -- src/pages/ProvidersPage.test.tsx
npm run typecheck --workspace server
npm run typecheck --workspace client
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/config/dotenvFile.ts server/src/config/dotenvFile.test.ts server/src/routes/providers.ts server/src/routes/providers.test.ts client/src/pages/ProvidersPage.tsx client/src/pages/ProvidersPage.test.tsx
git commit -m "fix: harden api key handling"
```

---

## Task 14: Add configuration import/export

**Files:**
- Create: `server/src/configuration/configExport.ts`
- Create: `server/src/configuration/configExport.test.ts`
- Create: `server/src/routes/configuration.ts`
- Create: `server/src/routes/configuration.test.ts`
- Modify: `server/src/app.ts`
- Modify: `client/src/api/client.ts`
- Create: `client/src/pages/ConfigurationPage.tsx`
- Create: `client/src/pages/ConfigurationPage.test.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add failing export tests**

Assert exported config includes providers, models, and endpoints but excludes actual API key values.

- [ ] **Step 2: Implement export builder**

Return:

```ts
{
  version: 1,
  providers: [],
  models: [],
  endpoints: [],
  missingApiKeyEnvs: []
}
```

- [ ] **Step 3: Add routes**

Add:

```text
GET /api/configuration/export
POST /api/configuration/import
```

- [ ] **Step 4: Add frontend page**

Add export button, import textarea/file text input, and validation results.

- [ ] **Step 5: Verify**

Run:

```bash
npm run test --workspace server -- src/configuration/configExport.test.ts src/routes/configuration.test.ts
npm run test --workspace client -- src/pages/ConfigurationPage.test.tsx
npm run typecheck --workspace server
npm run typecheck --workspace client
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/configuration server/src/routes/configuration.ts server/src/routes/configuration.test.ts server/src/app.ts client/src/api/client.ts client/src/pages/ConfigurationPage.tsx client/src/pages/ConfigurationPage.test.tsx client/src/App.tsx
git commit -m "feat: add configuration import export"
```

---

## Task 15: Final documentation and verification

**Files:**
- Modify: `docs/superpowers/plans/2026-06-23-api-tools-v0-2-api-onboarding-endpoints.md`
- Create: `docs/superpowers/specs/2026-06-23-api-onboarding-endpoints-user-guide.md`

- [ ] **Step 1: Write user guide**

Document:

- Provider capabilities
- Manual model import
- Model test console
- Run history
- Endpoint management
- Endpoint testing
- Config import/export
- API key safety

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run test --workspace server
npm run test --workspace client
npm run typecheck --workspace server
npm run typecheck --workspace client
npm run build --workspace server
npm run build --workspace client
npm run test
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: only documentation updates are pending before final commit.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-06-23-api-tools-v0-2-api-onboarding-endpoints.md docs/superpowers/specs/2026-06-23-api-onboarding-endpoints-user-guide.md
git commit -m "docs: complete api onboarding endpoint phase"
```

---

## Plan Self-Review

### Coverage

- Conversation memory is represented as a design backlog in Task 1.
- Provider capabilities are implemented in Task 2.
- Provider detail/status improvements are handled in Task 3.
- Remote model listing failures are handled in Task 4.
- Manual model import is handled in Task 5.
- Model testing is handled in Task 6.
- Run trace UI is handled in Task 7.
- Generic HTTP protocol foundation is handled in Task 8.
- Endpoint persistence and routes are handled in Tasks 9 through 11.
- Endpoint frontend is handled in Task 12.
- API key safety is handled in Task 13.
- Configuration import/export is handled in Task 14.
- Documentation and full verification are handled in Task 15.

### Execution Rules

- Execute tasks in order.
- Use TDD for code changes.
- Commit after every task.
- Do not implement conversation memory runtime behavior in this phase.
- Do not expose API key values in logs, tests, exported configuration, or frontend UI.
