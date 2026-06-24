# API Tools v0.2 User Guide: API Onboarding and Endpoint Foundation

## Purpose

API Tools v0.2 turns the project into a practical local workbench for connecting API providers, importing usable model records, testing model calls, defining generic HTTP endpoints, and preserving enough run/configuration information to debug and migrate a local setup.

This guide covers the v0.2 behavior that has been implemented and verified:

- Provider capabilities
- Manual model import
- Model test console
- Run history
- Endpoint management
- Endpoint testing
- Config import/export
- API key safety

## 1. Provider Capabilities

A Provider represents an external API base URL plus the local environment variable name used to find its API key. In v0.2, provider records include capability metadata so the UI and backend can distinguish what the provider can do instead of assuming every provider behaves like OpenAI.

Provider capability fields describe whether a provider supports chat, model listing, manual model import, streaming, tool calling, vision, remote conversation state, or requires manual model import. This matters because some providers can list remote models, while others expose only a fixed model id from their documentation. The UI should expose model-listing actions only when the provider supports them, and should keep manual import available for providers that cannot list remote models.

When adding a provider, use the API key environment variable name, such as `DEEPSEEK_API_KEY`, not the real API key value. If you also enter the optional API key field in the UI, API Tools stores that value in the local `.env` file under the chosen environment variable name.

## 2. Manual Model Import

A Model record is the local representation of a concrete model id available through a provider. A single provider can expose multiple model ids, and v0.2 supports importing more than one model under the same provider.

There are two import paths:

1. Remote model listing: if the provider supports model listing and the API key works, API Tools can fetch the remote model list and let you import selected models.
2. Manual model import: if the provider cannot list models, or if the documentation gives you a fixed model id, you can create a model record manually.

Manual import requires:

- Provider id
- Model id used by the upstream API
- Display name shown in the UI
- Capability: `chat`, `image`, or `multimodal`
- Enabled flag
- Optional default params and pricing metadata

Manual import does not verify the key by itself. Use the model test console after import to confirm that the provider, key, base URL, protocol format, and model id work together.

## 3. Model Test Console

The model test console sends a small test request through the selected model adapter and reports whether the upstream provider accepted the request. It supports custom prompt text and request parameters, so it can be used for both quick smoke tests and provider-specific troubleshooting.

A successful test returns:

- `ok: true`
- Latency in milliseconds
- Assistant message text
- Token usage when the provider returns usage information

A failed test returns a structured error, including a code, message, status, provider message when available, and a suggested next action. Use these fields to identify whether the failure is caused by a missing env var, invalid model id, base URL problem, provider network issue, or provider-side HTTP error.

## 4. Run History

Run history records workflow/model-test execution traces so failures are not lost after a single UI notification. v0.2 stores run records and run steps with status, timing, input preview, output preview, error code, error message, token usage, and cost estimate fields.

Run history is useful for:

- Comparing successful and failed provider calls
- Checking latency across providers/models
- Seeing which step failed in a workflow
- Preserving enough context to debug without storing raw API keys

The run history page lists recorded runs and allows selecting a run to inspect its steps. This is a diagnostic aid, not a conversation memory system. Long-term conversation memory remains a separate design track.

## 5. Endpoint Management

Endpoints are the first generic API resource in the project. An Endpoint belongs to a provider and describes one HTTP operation using the internal `http.request` contract.

An endpoint includes:

- Provider id
- Name
- Operation id, currently usually `http.request`
- HTTP method: `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`
- Path beginning with `/`
- Query template
- Headers template
- Optional body template
- Enabled flag

Endpoint definitions are intentionally separate from model records. Models are for LLM-style adapters; endpoints are for generic HTTP APIs. This keeps the project extensible for future APIs that do not look like model APIs.

## 6. Endpoint Testing

Endpoint testing executes a configured endpoint against its provider base URL and selected API key. The test runner applies the endpoint templates to the input object, sends the HTTP request, and returns a concise response preview.

A test result includes:

- `ok`
- HTTP status
- Response headers
- Body preview
- Latency in milliseconds

Endpoint testing is currently a direct test facility. v0.2 intentionally does not turn endpoints into workflow steps yet. That is reserved for the next phase, where endpoint calls can become reusable workflow operations alongside LLM chat steps.

## 7. Config Import/Export

Configuration export lets you move provider, model, and endpoint definitions between local environments. The export format is JSON and includes:

- `version: 1`
- Providers
- Models
- Endpoints
- `missingApiKeyEnvs`

Exported configuration does not include real API key values. It only includes environment variable names, such as `TJU_API_KEY` or `DEEPSEEK_API_KEY`. After importing a configuration on another machine, you must still create the corresponding `.env` entries locally.

Configuration import upserts providers, models, and endpoints by id. This preserves relationships such as model-to-provider and endpoint-to-provider. Run history and diagnostics are not part of v0.2 configuration export.

## 8. API Key Safety

v0.2 hardens API key handling in both backend routes and frontend validation.

Rules:

- `apiKeyEnv` must be an environment variable name, not a raw key.
- Values that look like raw keys, such as strings starting with `sk-` or `tk-`, are rejected when used as env var names.
- Long secret-like uppercase/digit strings are also rejected as env var names.
- Optional API key save writes the provided key value into local `.env` under the chosen variable name.
- Saved `.env` values are trimmed and quoted only when required.
- Real key values are never included in configuration export.

This design keeps the database and exported configuration focused on references to local secrets, not the secrets themselves.

## Manual Validation Checklist

Use this checklist after starting the server and client locally:

1. Add a provider with a valid env var name.
2. Save an API key through the provider form or manually add it to `.env`.
3. Fetch remote models if the provider supports listing.
4. Manually import a model when listing is unavailable.
5. Run a model test and confirm the message/latency result.
6. Create an endpoint under a provider.
7. Test the endpoint with sample input JSON.
8. Open run history and inspect a recorded run.
9. Export configuration and confirm no raw key appears in the JSON.
10. Import the exported JSON into a clean local database and verify providers/models/endpoints appear.

## Known Boundaries

v0.2 deliberately stops before several larger features:

- Endpoint calls are not yet first-class workflow steps.
- Conversation memory is not implemented yet.
- API protocol templates are not fully generic yet.
- OpenAPI import is not implemented.
- The project is still a local workbench, not a multi-user hosted service.

These boundaries are intentional. They keep v0.2 stable while leaving a clear path for v0.3 protocol extensibility and orchestration work.
