# models.list Operation Contract

## Status

Implemented for provider/model management. Not workflow-executable in Phase 1.

## Purpose

`models.list` asks a provider adapter to list remote models available from the provider.

It supports the API接入 / model import workflow, but it is not a user workflow step yet.

## Resource requirement

```text
resource.kind = "none"
```

The operation uses provider connection settings and API key only.

## Input contract

No workflow input is required.

Runtime invocation requires:

- provider
- API key resolved from `provider.apiKeyEnv`

## Output contract

```ts
interface RemoteModel {
  id: string;
  ownedBy?: string;
}
```

The route may wrap this as:

```ts
{
  ok: true;
  providerId: string;
  models: RemoteModel[];
}
```

## Usage contract

No token usage is expected.

## Error expectations

The adapter may return or throw standardized provider errors including:

- `missing_api_key`
- `invalid_api_key`
- `invalid_base_url`
- `rate_limited`
- `provider_error`
- `network_error`

## Workflow rule

`models.list` must not be accepted as a workflow step in Phase 1. If a workflow tries to execute it, the runner or route must reject it with `unsupported_workflow_step` or validation failure.
