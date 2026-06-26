import { z } from "zod";
import type { AppDatabase } from "../db/client.js";
import { createEndpointRepository } from "../endpoints/endpointRepository.js";
import type { Endpoint, EndpointMethod } from "../endpoints/endpointRepository.js";
import { createMcpServerRepository } from "../mcp/mcpServerRepository.js";
import type { McpServerRecord, McpTransport } from "../mcp/types.js";
import { createModelRepository } from "../providers/modelRepository.js";
import type { Model, ModelCapability } from "../providers/modelRepository.js";
import { createProviderRepository } from "../providers/providerRepository.js";
import type {
  Provider,
  ProviderApiFormat,
  ProviderCapabilities,
  ProviderType
} from "../providers/providerRepository.js";
import { createSkillRepository } from "../skills/skillRepository.js";
import type { SkillTemplate } from "../skills/templateRegistry.js";
import type { WorkflowStepDefinition } from "../workflows/types.js";

const RECONFIGURE_REQUIRED = "__RECONFIGURE_REQUIRED__";

export interface ExportedProvider {
  id: string;
  name: string;
  type: ProviderType;
  apiFormat: ProviderApiFormat;
  baseUrl: string;
  apiKeyEnv: string;
  capabilities: Partial<ProviderCapabilities>;
  enabled: boolean;
}

export interface ExportedModel {
  id: string;
  providerId: string;
  displayName: string;
  modelId: string;
  capability: ModelCapability;
  enabled: boolean;
  defaultParams: Record<string, unknown>;
  pricing: Record<string, unknown>;
}

export interface ExportedEndpoint {
  id: string;
  providerId: string;
  name: string;
  operationId: string;
  method: EndpointMethod;
  path: string;
  queryTemplate: Record<string, unknown>;
  headersTemplate: Record<string, unknown>;
  bodyTemplate?: unknown;
  enabled: boolean;
}

export interface ExportedMcpServer {
  id: string;
  name: string;
  transport: McpTransport;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
}

export interface ExportedSkill {
  id: string;
  name: SkillTemplate["name"];
  description: SkillTemplate["description"];
  parameters: SkillTemplate["parameters"];
  steps: WorkflowStepDefinition[];
  builtin?: boolean;
}

export interface ExportedConfiguration {
  version: 1 | 2;
  providers: ExportedProvider[];
  models: ExportedModel[];
  endpoints: ExportedEndpoint[];
  mcpServers: ExportedMcpServer[];
  skills: ExportedSkill[];
  missingApiKeyEnvs: string[];
}

export interface ImportConfigurationResult {
  providers: number;
  models: number;
  endpoints: number;
  mcpServers: number;
  skills: number;
}

const providerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["openai-compatible", "openai-official"]),
  apiFormat: z.enum(["openai-chat-completions", "openai-responses", "claude-messages"]),
  baseUrl: z.string().url(),
  apiKeyEnv: z.string().min(1),
  capabilities: z.object({
    supportsChat: z.boolean().optional(),
    supportsModelListing: z.boolean().optional(),
    supportsManualModelImport: z.boolean().optional(),
    supportsStreaming: z.boolean().optional(),
    supportsToolCalling: z.boolean().optional(),
    supportsVision: z.boolean().optional(),
    supportsRemoteConversation: z.boolean().optional(),
    requiresManualModelImport: z.boolean().optional()
  }).default({}),
  enabled: z.boolean()
});

const modelSchema = z.object({
  id: z.string().min(1),
  providerId: z.string().min(1),
  displayName: z.string().min(1),
  modelId: z.string().min(1),
  capability: z.enum(["chat", "image", "multimodal"]),
  enabled: z.boolean(),
  defaultParams: z.record(z.unknown()).default({}),
  pricing: z.record(z.unknown()).default({})
});

const endpointSchema = z.object({
  id: z.string().min(1),
  providerId: z.string().min(1),
  name: z.string().min(1),
  operationId: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1).refine((value) => value.startsWith("/"), {
    message: "Endpoint path must start with /"
  }),
  queryTemplate: z.record(z.unknown()).default({}),
  headersTemplate: z.record(z.unknown()).default({}),
  bodyTemplate: z.unknown().optional(),
  enabled: z.boolean()
});

const mcpServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  transport: z.literal("stdio").default("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  enabled: z.boolean()
});

const localizedTextSchema = z.object({
  "zh-CN": z.string(),
  en: z.string()
});

const skillParameterSchema = z.object({
  key: z.string().min(1),
  label: localizedTextSchema,
  required: z.boolean(),
  type: z.enum(["model", "mcpServer", "endpoint", "text"])
});

const workflowStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["llm.chat", "endpoint.call", "mcp.call"]),
  modelId: z.string().min(1).optional(),
  endpointId: z.string().min(1).optional(),
  mcpServerId: z.string().min(1).optional(),
  toolName: z.string().min(1).optional(),
  input: z.record(z.unknown()).default({})
});

const skillSchema = z.object({
  id: z.string().min(1),
  name: localizedTextSchema,
  description: localizedTextSchema,
  parameters: z.array(skillParameterSchema).default([]),
  steps: z.array(workflowStepSchema).default([]),
  builtin: z.boolean().optional()
});

export const exportedConfigurationSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  providers: z.array(providerSchema).default([]),
  models: z.array(modelSchema).default([]),
  endpoints: z.array(endpointSchema).default([]),
  mcpServers: z.array(mcpServerSchema).default([]),
  skills: z.array(skillSchema).default([]),
  missingApiKeyEnvs: z.array(z.string()).default([])
});

export function buildConfigurationExport(
  db: AppDatabase,
  env: NodeJS.ProcessEnv = process.env
): ExportedConfiguration {
  const providers = createProviderRepository(db).list().map(exportProvider);

  return {
    version: 2,
    providers,
    models: createModelRepository(db).list().map(exportModel),
    endpoints: createEndpointRepository(db).list().map(exportEndpoint),
    mcpServers: createMcpServerRepository(db).list().map(exportMcpServer),
    skills: createSkillRepository(db).list().map(exportSkill),
    missingApiKeyEnvs: providers
      .map((provider) => provider.apiKeyEnv)
      .filter((apiKeyEnv, index, apiKeyEnvs) => apiKeyEnvs.indexOf(apiKeyEnv) === index)
      .filter((apiKeyEnv) => !env[apiKeyEnv]?.trim())
  };
}

export function parseExportedConfiguration(input: unknown): ExportedConfiguration {
  return exportedConfigurationSchema.parse(input) as ExportedConfiguration;
}

export function importConfiguration(db: AppDatabase, configuration: ExportedConfiguration): ImportConfigurationResult {
  const providers = createProviderRepository(db);
  const models = createModelRepository(db);
  const endpoints = createEndpointRepository(db);
  const mcpServers = createMcpServerRepository(db);
  const skills = createSkillRepository(db);
  let providerCount = 0;
  let modelCount = 0;
  let endpointCount = 0;
  let mcpServerCount = 0;
  let skillCount = 0;

  for (const provider of configuration.providers) {
    if (providers.getById(provider.id)) {
      providers.update(provider.id, provider);
    } else {
      providers.create(provider);
    }
    providerCount += 1;
  }

  for (const model of configuration.models) {
    if (models.getById(model.id)) {
      models.update(model.id, model);
    } else {
      models.create(model);
    }
    modelCount += 1;
  }

  for (const endpoint of configuration.endpoints) {
    if (endpoints.getById(endpoint.id)) {
      endpoints.update(endpoint.id, endpoint);
    } else {
      endpoints.create(endpoint);
    }
    endpointCount += 1;
  }

  for (const mcpServer of configuration.mcpServers) {
    if (mcpServers.getById(mcpServer.id)) {
      mcpServers.update(mcpServer.id, mcpServer);
    } else {
      mcpServers.create(mcpServer);
    }
    mcpServerCount += 1;
  }

  for (const skill of configuration.skills) {
    if (skills.getById(skill.id)) {
      skills.update(skill.id, skill);
    } else {
      skills.create(skill);
    }
    skillCount += 1;
  }

  return { providers: providerCount, models: modelCount, endpoints: endpointCount, mcpServers: mcpServerCount, skills: skillCount };
}

function exportProvider(provider: Provider): ExportedProvider {
  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    apiFormat: provider.apiFormat,
    baseUrl: provider.baseUrl,
    apiKeyEnv: provider.apiKeyEnv,
    capabilities: provider.capabilities,
    enabled: provider.enabled
  };
}

function exportModel(model: Model): ExportedModel {
  return {
    id: model.id,
    providerId: model.providerId,
    displayName: model.displayName,
    modelId: model.modelId,
    capability: model.capability,
    enabled: model.enabled,
    defaultParams: { ...model.defaultParams },
    pricing: { ...model.pricing }
  };
}

function exportEndpoint(endpoint: Endpoint): ExportedEndpoint {
  return {
    id: endpoint.id,
    providerId: endpoint.providerId,
    name: endpoint.name,
    operationId: endpoint.operationId,
    method: endpoint.method,
    path: endpoint.path,
    queryTemplate: endpoint.queryTemplate,
    headersTemplate: endpoint.headersTemplate,
    bodyTemplate: endpoint.bodyTemplate,
    enabled: endpoint.enabled
  };
}

function exportMcpServer(server: McpServerRecord): ExportedMcpServer {
  return {
    id: server.id,
    name: server.name,
    transport: server.transport,
    command: server.command,
    args: [...server.args],
    env: Object.fromEntries(Object.keys(server.env).map((key) => [key, RECONFIGURE_REQUIRED])),
    enabled: server.enabled
  };
}

function exportSkill(skill: SkillTemplate): ExportedSkill {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    parameters: skill.parameters,
    steps: skill.steps,
    builtin: skill.builtin
  };
}
