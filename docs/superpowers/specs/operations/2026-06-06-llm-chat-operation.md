# llm.chat Operation Contract

## Status

Implemented and workflow-executable in Phase 1.

## Purpose

`llm.chat` asks a model resource to generate a chat response from normalized chat messages.

Workflow steps use this internal operation id instead of provider-specific endpoints such as `/chat/completions` or `/responses`.

## Resource requirement

```text
resource.kind = "model"
```

The referenced model must have capability `chat` or `multimodal`.

## Input contract

```ts
interface LlmChatInput {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
}
```

Rules:

- `messages` is required.
- `messages` must contain at least one message.
- `role` must be `system`, `user`, or `assistant`.
- `content` must be a string.
- Provider-specific request fields do not belong in this contract.

## Output contract

```ts
interface LlmChatData {
  content: string;
}
```

## Usage contract

Adapters may return:

```ts
{
  inputTokens?: number;
  outputTokens?: number;
}
```

If the provider does not return usage, the fields remain absent.

## Error expectations

The adapter or bridge may return:

- `invalid_api_resource`
- `invalid_workflow_step`
- `missing_api_key`
- `invalid_api_key`
- `invalid_base_url`
- `model_not_found`
- `rate_limited`
- `quota_exceeded`
- `provider_error`
- `network_error`

The workflow runner must record a failed `run_step` for provider invocation failures.

## Trace requirements

Every `llm.chat` invocation must write one `run_step` with:

- `step_type = "llm.chat"`
- `provider_id`
- `model_id`
- `status`
- `input_preview`
- `output_preview` on success
- `error_code` and `error_message` on failure
- `latency_ms` when available
- token usage when available
