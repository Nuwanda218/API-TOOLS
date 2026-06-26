import type { AppDatabase } from "./client.js";

export function applySchema(db: AppDatabase) {
  db.exec(`
    create table if not exists providers (
      id text primary key,
      name text not null,
      type text not null check (type in ('openai-compatible', 'openai-official')),
      api_format text not null default 'openai-chat-completions' check (api_format in ('openai-chat-completions', 'openai-responses', 'claude-messages')),
      base_url text not null,
      api_key_env text not null,
      capabilities_json text not null default '{}',
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

    create table if not exists endpoints (
      id text primary key,
      provider_id text not null references providers(id) on delete cascade,
      name text not null,
      operation_id text not null,
      method text not null check (method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
      path text not null,
      query_template_json text not null default '{}',
      headers_template_json text not null default '{}',
      body_template_json text,
      enabled integer not null default 1,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists mcp_servers (
      id text primary key,
      name text not null,
      transport text not null default 'stdio' check (transport in ('stdio')),
      command text not null,
      args_json text not null default '[]',
      env_json text not null default '{}',
      enabled integer not null default 1,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists sessions (
      id text primary key,
      title text not null,
      workflow_type text not null check (workflow_type in ('api-workflow', 'chat', 'image-minimal', 'model-test')),
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
      workflow_type text not null check (workflow_type in ('api-workflow', 'chat', 'image-minimal', 'model-test')),
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
      step_type text not null check (step_type in ('llm.chat', 'endpoint.call', 'mcp.call', 'chat-completion', 'image-generation', 'model-test', 'prompt-optimizer', 'reviewer', 'summarizer')),
      provider_id text references providers(id),
      model_id text references models(id),
      endpoint_id text references endpoints(id),
      mcp_server_id text references mcp_servers(id),
      mcp_tool_name text,
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

  addColumnIfMissing(db, "providers", "capabilities_json", "text not null default '{}'");
  addColumnIfMissing(db, "run_steps", "endpoint_id", "text references endpoints(id)");
  addColumnIfMissing(db, "run_steps", "mcp_server_id", "text references mcp_servers(id)");
  addColumnIfMissing(db, "run_steps", "mcp_tool_name", "text");
}

function addColumnIfMissing(db: AppDatabase, table: string, column: string, definition: string) {
  const columns = db.prepare(`pragma table_info(${table})`).all<{ name: string }>();
  if (columns.some((entry) => entry.name === column)) return;

  db.prepare(`alter table ${table} add column ${column} ${definition}`).run();
}
