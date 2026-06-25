# http.request Operation Contract

## Status

Implemented for endpoint testing. Not workflow-executable in this phase.

## Purpose

`http.request` is the internal operation contract for generic HTTP API calls owned by endpoint resources.

It prevents endpoint-specific behavior from leaking into workflow definitions or provider adapters. Endpoint testing may use this contract; workflow execution must still reject `http.request` until a later phase defines trace, secret redaction, and branching behavior for generic API steps.

## Input Contract

```ts
interface HttpRequestInput {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}
```

Rules:

- `method` is required.
- `path` is required and must start with `/`.
- `query` values must be strings, numbers, or booleans.
- `headers` values must be strings.
- `body` may be any JSON-compatible value.
- `timeoutMs` must be a positive integer when provided.

## Output Contract

Endpoint test execution should return a normalized result with:

```ts
interface HttpRequestData {
  status: number;
  headers: Record<string, string>;
  bodyPreview: unknown;
  latencyMs: number;
}
```

Full response bodies must be size-limited before storage or UI rendering.

## Workflow Rule

`http.request` remains `workflowStep: false`.

Any workflow step using `http.request` must be rejected until a later plan explicitly enables it.

## Safety Constraints

- Secrets must not be stored in run previews.
- Request and response bodies must be bounded.
- Endpoint paths are configured through endpoint resources, not arbitrary workflow step paths.
- Errors must map into the standard provider error model.
