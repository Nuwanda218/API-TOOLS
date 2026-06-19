# http.request Reserved Operation Contract

## Status

Reserved. Not implemented and not workflow-executable in Phase 1.

## Purpose

`http.request` is reserved for future generic HTTP API execution.

It exists in the operation catalog to prevent ad-hoc endpoint-specific behavior from being introduced under another name before the contract is designed.

## Phase 1 rule

Any attempt to execute `http.request` must be rejected.

## Future input sketch

The future contract may include:

```ts
interface HttpRequestInput {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}
```

This sketch is not an implementation contract.

## Future output sketch

The future contract may include:

```ts
interface HttpRequestData {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}
```

This sketch is not an implementation contract.

## Design constraints before implementation

Before implementing this operation, a later spec or plan must decide:

- How endpoint paths are configured without leaking provider-specific details into workflow definitions.
- Whether the adapter is dedicated or config-driven.
- Which headers are allowed.
- How request and response bodies are size-limited.
- How secrets are prevented from entering trace previews.
- How errors are mapped to the standard provider error model.
