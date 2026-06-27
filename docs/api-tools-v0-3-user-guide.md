# API Tools v0.3 User Guide

API Tools v0.3 turns the workbench into a small API orchestration framework. It can manage LLM providers and models, register generic HTTP endpoints, connect MCP servers, run reusable Skill templates, build multi-step workflows, inspect traces, and export/import local configuration.

## Start

```powershell
npm install
npm run dev --workspace server
npm run dev --workspace client
```

Server default: `http://127.0.0.1:8787`.

Client default: Vite dev server URL printed by `npm run dev --workspace client`.

Keep API keys in `.env`. Provider records store the env var name, not the secret value.

## API Providers And Models

Use API 接入 / Provider management to add a provider.

Required fields:

- `name`: display name.
- `type`: usually `openai-compatible`.
- `apiFormat`: one of `openai-chat-completions`, `openai-responses`, `claude-messages`.
- `baseUrl`: provider base URL.
- `apiKeyEnv`: env var name stored in `.env`, for example `DEEPSEEK_API_KEY`.

After creating a provider:

1. Pull remote models when the provider supports model listing.
2. Import selected models into the local model table.
3. Use model test to verify the model can complete a chat request.

For providers that cannot list models, manually create a model with the provider's documented model ID.

## HTTP Endpoints

Use HTTP API 页面 to register non-model HTTP endpoints.

Endpoint records include:

- provider binding.
- method and path.
- query/header/body templates.
- enabled state.

Templates can use workflow input values, for example `{{input.message}}`. Endpoint tests call the external API and show HTTP status, latency, and body preview.

## MCP Servers

Use MCP Server 管理 to add local MCP server definitions.

Current transport:

- `stdio`

Server records include command, args, env var names/values, and enabled state. Use test/list tools to verify the MCP server can connect and expose tools.

## Skill Templates

Use Skill 模板 to run reusable workflow templates.

Templates define:

- localized name and description.
- parameters such as text, model, endpoint, or MCP server.
- workflow steps.

Built-in and user-defined templates run through the same workflow runner as the builder.

## Workflow Builder

Use 工作流构建器 to compose multi-step workflows.

Supported step types:

- `llm.chat`: select a local model and provide input JSON.
- `endpoint.call`: select a registered endpoint and provide input JSON.
- `mcp.call`: select an MCP server, enter tool name, and provide input JSON.

The builder sends:

```json
{
  "workflowType": "api-workflow",
  "input": {},
  "steps": []
}
```

Step inputs can reference workflow input values with templates such as `{{input.message}}`.

## Run History

Use 运行历史 to inspect workflow traces.

Trace details distinguish step types:

- `llm.chat`: content, latency, tokens, cost.
- `endpoint.call`: HTTP status and body preview.
- `mcp.call`: MCP tool name and content blocks.

Errors display provider/system error code and short message when available.

## Configuration Export And Import

Use 配置迁移 to export/import local configuration.

Export format:

- `version: 2`
- `providers`
- `models`
- `endpoints`
- `mcpServers`
- `skills`
- `missingApiKeyEnvs`

Not exported:

- run history
- run steps
- real provider API key values
- real MCP env values

MCP env values are exported as `__RECONFIGURE_REQUIRED__`. Reconfigure them after import if needed.

Version 1 imports are still accepted for older provider/model/endpoint-only backups.

## Verification

Recommended verification before merging v0.3 work:

```powershell
npm run test --workspace server
npm run test --workspace client
npm run typecheck --workspace server
npm run typecheck --workspace client
npm run build --workspace server
npm run build --workspace client
```
