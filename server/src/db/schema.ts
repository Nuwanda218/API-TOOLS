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
