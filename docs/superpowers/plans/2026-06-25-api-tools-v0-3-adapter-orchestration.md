# API Tools v0.3 Adapter and Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn API Tools from a provider/model onboarding workbench into an extensible API framework with protocol templates, adapter registration, endpoint generation, workflow execution, and explicit conversation-context planning.

**Architecture:** v0.3 builds on the v0.2 foundation: providers, models, endpoints, run traces, and configuration import/export remain the core resources. The next layer introduces protocol profiles and adapter templates as first-class extension points, then connects endpoint definitions to workflow execution. Conversation memory is treated as a design track with stored session references and pluggable memory strategies, not as a quick implicit chat-history patch.

**Tech Stack:** Express, SQLite repositories, Zod schemas, TypeScript protocol modules, Vitest, React, existing notification/navigation UI, existing provider/model/endpoint APIs.

---

## Stage Dependency Overview

1. **Protocol registry first.** API expansion depends on a stable registry that describes operation kinds, auth style, request mapping, response mapping, and capability metadata.
2. **Adapter templates second.** Templates let a user add APIs that are not pure OpenAI-compatible model APIs without editing core code for every provider.
3. **Endpoint generation third.** Once protocol profiles exist, endpoint forms can generate useful endpoint defaults from provider/protocol metadata.
4. **Workflow execution fourth.** Endpoint execution must be wired into workflows after endpoint contracts and test runner behavior are stable.
5. **Session and memory planning fifth.** Conversation memory needs a deliberate design because different providers store context differently: local transcript, remote conversation ID, provider thread ID, or stateless messages.
6. **Operational polish last.** Diagnostics, docs, migration guide, and final verification close the phase.

---

## Task 1: Define Protocol Profile Model

**Purpose:** Make API protocol support explicit instead of encoding behavior only in provider type or adapter code.

**Files:**
- Modify: `server/src/apiProtocol/types.ts`
- Modify: `server/src/apiProtocol/operationCatalog.ts`
- Create: `server/src/apiProtocol/protocolProfiles.ts`
- Create: `server/src/apiProtocol/protocolProfiles.test.ts`
- Modify: `client/src/api/types.ts`

**Scope:**
- Define protocol profile fields:
  - `id`: stable protocol id, such as `openai.chat`, `openai.responses`, `anthropic.messages`, `http.generic`.
  - `displayName`: human-readable name.
  - `resourceKind`: `llm`, `http`, `image`, `embedding`, `custom`.
  - `authSchemes`: supported auth modes, initially `bearer-env`, `api-key-header-env`, `none`.
  - `operations`: operation ids supported by the profile.
  - `requestShape`: internal request schema description.
  - `responseShape`: internal response schema description.
  - `capabilities`: model listing, streaming, tools, remote conversation, endpoint generation.
- Keep existing OpenAI/Claude model adapters working.
- Do not migrate database schema in this task unless required by type checks.

**Verification:**
- `npm run test --workspace server -- src/apiProtocol/protocolProfiles.test.ts src/apiProtocol/operationCatalog.test.ts`
- `npm run typecheck --workspace server`
- `npm run typecheck --workspace client`

**Commit:** `feat: define protocol profiles`

---

## Task 2: Add Provider Protocol Metadata

**Purpose:** Let each provider declare which protocol profile it uses and which operation kinds it supports.

**Files:**
- Modify: `server/src/db/schema.ts`
- Modify: `server/src/providers/providerRepository.ts`
- Modify: `server/src/providers/providerRepository.test.ts`
- Modify: `server/src/routes/providers.ts`
- Modify: `server/src/routes/providers.test.ts`
- Modify: `client/src/api/types.ts`
- Modify: `client/src/pages/ProvidersPage.tsx`
- Modify: `client/src/pages/ProvidersPage.test.tsx`

**Scope:**
- Add provider metadata fields if not already represented:
  - `protocolProfileId`
  - `authScheme`
  - `authHeaderName` for non-Bearer APIs.
  - `defaultOperationId`.
- Backfill existing providers:
  - `openai-chat-completions` -> `openai.chat`
  - `openai-responses` -> `openai.responses`
  - `claude-messages` -> `anthropic.messages`
- Keep `apiFormat` during transition to avoid breaking existing data.
- Provider creation UI should expose protocol profile selection without requiring the user to understand internal enum names.

**Verification:**
- `npm run test --workspace server -- src/providers/providerRepository.test.ts src/routes/providers.test.ts`
- `npm run test --workspace client -- src/pages/ProvidersPage.test.tsx`
- `npm run typecheck --workspace server`
- `npm run typecheck --workspace client`

**Commit:** `feat: add provider protocol metadata`

---

## Task 3: Introduce Adapter Template Registry

**Purpose:** Prepare for APIs that need special request/response mapping without hardcoding every provider into routes.

**Files:**
- Create: `server/src/adapters/templates/types.ts`
- Create: `server/src/adapters/templates/registry.ts`
- Create: `server/src/adapters/templates/openAiChatTemplate.ts`
- Create: `server/src/adapters/templates/openAiResponsesTemplate.ts`
- Create: `server/src/adapters/templates/claudeMessagesTemplate.ts`
- Create: `server/src/adapters/templates/genericHttpTemplate.ts`
- Create: `server/src/adapters/templates/registry.test.ts`
- Modify: `server/src/adapters/registry.ts`

**Scope:**
- Define template responsibilities:
  - validate provider settings.
  - list remote resources if supported.
  - transform internal request into provider request.
  - transform provider response into internal response.
  - expose diagnostic hints.
- Initially wrap existing LLM adapters as templates instead of rewriting them.
- Add `genericHttpTemplate` for arbitrary REST APIs with explicit endpoint config.

**Verification:**
- `npm run test --workspace server -- src/adapters/templates/registry.test.ts src/adapters/registry.test.ts`
- `npm run test --workspace server -- src/adapters/openaiChatCompletions.test.ts src/adapters/openaiResponses.test.ts src/adapters/claudeMessages.test.ts`
- `npm run typecheck --workspace server`

**Commit:** `feat: add adapter template registry`

---

## Task 4: Add Endpoint Generation from Protocol Profiles

**Purpose:** Reduce manual setup by generating suggested endpoints from selected provider/protocol metadata.

**Files:**
- Create: `server/src/endpoints/endpointSuggestions.ts`
- Create: `server/src/endpoints/endpointSuggestions.test.ts`
- Modify: `server/src/routes/endpoints.ts`
- Modify: `server/src/routes/endpoints.test.ts`
- Modify: `client/src/api/client.ts`
- Modify: `client/src/api/types.ts`
- Modify: `client/src/pages/EndpointsPage.tsx`
- Modify: `client/src/pages/EndpointsPage.test.tsx`

**Scope:**
- Add `GET /api/providers/:id/endpoint-suggestions` or `GET /api/endpoints/suggestions?providerId=...`.
- Suggestions include method, path, operation id, headers template, body template, and required input keys.
- Suggested endpoints are not auto-created; user must confirm creation.
- Existing manual endpoint creation remains available.

**Verification:**
- `npm run test --workspace server -- src/endpoints/endpointSuggestions.test.ts src/routes/endpoints.test.ts`
- `npm run test --workspace client -- src/pages/EndpointsPage.test.tsx`
- `npm run typecheck --workspace server`
- `npm run typecheck --workspace client`

**Commit:** `feat: suggest endpoints from protocol profiles`

---

## Task 5: Execute Endpoint Steps in Workflows

**Purpose:** Promote endpoints from test-only resources to reusable workflow steps.

**Files:**
- Modify: `server/src/apiProtocol/types.ts`
- Modify: `server/src/apiProtocol/httpRequest.ts`
- Modify: `server/src/routes/workflows.ts`
- Modify: `server/src/routes/workflows.test.ts`
- Modify: `server/src/endpoints/endpointTester.ts`
- Modify: `server/src/endpoints/endpointTester.test.ts`
- Modify: `client/src/api/types.ts`
- Modify: `client/src/pages/WorkbenchPage.tsx`
- Modify: `client/src/pages/WorkbenchPage.test.tsx`

**Scope:**
- Add workflow step type `endpoint.call`.
- Step input references `endpointId` and `input` object.
- Reuse endpoint tester execution path where possible.
- Persist run steps with `stepType = endpoint.call` and record HTTP status, latency, input preview, output preview, and errors.
- Keep LLM `llm.chat` workflows working.

**Verification:**
- `npm run test --workspace server -- src/routes/workflows.test.ts src/endpoints/endpointTester.test.ts`
- `npm run test --workspace client -- src/pages/WorkbenchPage.test.tsx`
- `npm run typecheck --workspace server`
- `npm run typecheck --workspace client`

**Commit:** `feat: run endpoint steps in workflows`

---

## Task 6: Add Workflow Builder UI for Mixed API Steps

**Purpose:** Give users a practical way to compose LLM and endpoint steps without writing raw JSON by hand.

**Files:**
- Create: `client/src/pages/WorkflowBuilderPage.tsx`
- Create: `client/src/pages/WorkflowBuilderPage.test.tsx`
- Modify: `client/src/components/TopNav.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/api/client.ts`
- Modify: `client/src/api/types.ts`
- Modify: `client/src/styles.css`

**Scope:**
- List available models and endpoints.
- Allow adding ordered steps:
  - `llm.chat`
  - `endpoint.call`
- Allow editing each step input as JSON first; visual field mapping can wait for later.
- Run workflow and show outputs by step id.
- Send existing `/api/workflows/run` request shape with new step type.

**Verification:**
- `npm run test --workspace client -- src/pages/WorkflowBuilderPage.test.tsx`
- `npm run typecheck --workspace client`

**Commit:** `feat: add workflow builder page`

---

## Task 7: Conversation Memory Strategy Design Track

**Purpose:** Decide how conversation state should be represented before implementing memory features.

**Files:**
- Create: `docs/superpowers/specs/2026-06-25-conversation-memory-strategy.md`
- Modify: `docs/superpowers/plans/2026-06-25-api-tools-v0-3-adapter-orchestration.md`

**Scope:**
- Compare memory modes:
  - local transcript stored in SQLite.
  - remote conversation id stored per provider/session.
  - provider thread id mapping.
  - stateless replay from selected history.
- Define data model candidates:
  - `conversation_sessions`
  - `conversation_messages`
  - `provider_conversation_refs`
- Define privacy and portability constraints.
- Decide what is in v0.3 implementation and what stays backlog.

**Verification:**
- Manual doc review.
- Search doc for unresolved placeholder markers and remove vague language before commit.

**Commit:** `docs: design conversation memory strategy`

---

## Task 8: Add Diagnostics and Troubleshooting Surface

**Purpose:** Help users understand why an API cannot list models, import models, test endpoints, or run workflows.

**Files:**
- Create: `server/src/diagnostics/diagnosticEvents.ts`
- Create: `server/src/diagnostics/diagnosticEvents.test.ts`
- Modify: `server/src/errors/providerError.ts`
- Modify: `server/src/routes/providers.ts`
- Modify: `server/src/routes/endpoints.ts`
- Modify: `server/src/routes/workflows.ts`
- Create: `client/src/pages/DiagnosticsPage.tsx`
- Create: `client/src/pages/DiagnosticsPage.test.tsx`
- Modify: `client/src/components/TopNav.tsx`
- Modify: `client/src/App.tsx`

**Scope:**
- Standardize diagnostic fields:
  - `scope`: provider, model, endpoint, workflow.
  - `code`
  - `message`
  - `suggestion`
  - `providerMessage`
  - `timestamp`
- Store recent diagnostics in memory or SQLite; choose SQLite if run history already gives useful joins.
- UI lists recent failures and recommended next action.
- Never store raw API keys.

**Verification:**
- `npm run test --workspace server -- src/diagnostics/diagnosticEvents.test.ts src/routes/providers.test.ts src/routes/endpoints.test.ts src/routes/workflows.test.ts`
- `npm run test --workspace client -- src/pages/DiagnosticsPage.test.tsx`
- `npm run typecheck --workspace server`
- `npm run typecheck --workspace client`

**Commit:** `feat: add diagnostics surface`

---

## Task 9: Update Configuration Export for v0.3 Resources

**Purpose:** Keep configuration migration useful after protocol profiles, endpoint suggestions, workflow builder state, and diagnostics are added.

**Files:**
- Modify: `server/src/configuration/configExport.ts`
- Modify: `server/src/configuration/configExport.test.ts`
- Modify: `server/src/routes/configuration.test.ts`
- Modify: `client/src/pages/ConfigurationPage.tsx`
- Modify: `client/src/pages/ConfigurationPage.test.tsx`

**Scope:**
- Bump export schema to support `version: 2` while still importing `version: 1`.
- Include provider protocol metadata and endpoint operation metadata.
- Exclude diagnostics and run history by default.
- Include clear warning if imported provider requires missing API key env variables.

**Verification:**
- `npm run test --workspace server -- src/configuration/configExport.test.ts src/routes/configuration.test.ts`
- `npm run test --workspace client -- src/pages/ConfigurationPage.test.tsx`
- `npm run typecheck --workspace server`
- `npm run typecheck --workspace client`

**Commit:** `feat: update configuration export for protocol metadata`

---

## Task 10: v0.3 Documentation and Full Verification

**Purpose:** Close the phase with user-facing documentation and a full confidence check.

**Files:**
- Create: `docs/api-tools-v0-3-user-guide.md`
- Modify: `docs/superpowers/plans/2026-06-25-api-tools-v0-3-adapter-orchestration.md`

**Scope:**
- Document:
  - provider protocol selection.
  - adapter template meaning.
  - endpoint suggestion and manual endpoint creation.
  - workflow builder usage.
  - diagnostics interpretation.
  - configuration import/export boundaries.
  - conversation memory design status.
- Run full verification:
  - `npm run test --workspace server`
  - `npm run test --workspace client`
  - `npm run typecheck --workspace server`
  - `npm run typecheck --workspace client`
- Inspect git status before commit.

**Commit:** `docs: finalize api tools v0.3 plan`

---

## Out of Scope for v0.3

- Full OpenAPI document importer.
- Visual drag-and-drop workflow canvas.
- Production auth/user accounts.
- Multi-user cloud synchronization.
- Long-term vector memory.
- Automatic billing reconciliation.

These are valid future directions, but v0.3 should first make protocol extensibility and mixed API workflow execution reliable.
