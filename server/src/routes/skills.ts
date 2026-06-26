import { Router } from "express";
import { z } from "zod";
import { createAdapterRegistry } from "../adapters/registry.js";
import type { AdapterRegistry } from "../adapters/types.js";
import type { AppDatabase } from "../db/client.js";
import { ProviderError } from "../errors/providerError.js";
import type { McpManagerLike } from "../mcp/client.js";
import { createSkillRepository } from "../skills/skillRepository.js";
import { getBuiltinSkillTemplate, listBuiltinSkillTemplates, resolveSkillTemplate } from "../skills/templateRegistry.js";
import { createWorkflowRunner } from "../workflows/runner.js";

const localizedTextSchema = z.object({
  "zh-CN": z.string().min(1),
  en: z.string().min(1)
});

const skillParameterSchema = z.object({
  key: z.string().min(1),
  label: localizedTextSchema,
  required: z.boolean().default(false),
  type: z.enum(["model", "mcpServer", "endpoint", "text"])
});

const llmChatStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("llm.chat"),
  modelId: z.string().min(1),
  input: z.record(z.unknown()).default({})
});

const endpointCallStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("endpoint.call"),
  endpointId: z.string().min(1),
  input: z.record(z.unknown()).default({})
});

const mcpCallStepSchema = z.object({
  id: z.string().min(1),
  type: z.literal("mcp.call"),
  mcpServerId: z.string().min(1),
  toolName: z.string().min(1),
  input: z.record(z.unknown()).default({})
});

const workflowStepSchema = z.discriminatedUnion("type", [
  llmChatStepSchema,
  endpointCallStepSchema,
  mcpCallStepSchema
]);

const createSkillSchema = z.object({
  id: z.string().min(1).optional(),
  name: localizedTextSchema,
  description: localizedTextSchema,
  parameters: z.array(skillParameterSchema).default([]),
  steps: z.array(workflowStepSchema).min(1)
});

const updateSkillSchema = createSkillSchema.omit({ id: true }).partial();

const runSkillSchema = z.object({
  parameters: z.record(z.unknown()).default({})
});

interface SkillsRouterDependencies {
  adapterRegistry?: AdapterRegistry;
  env: NodeJS.ProcessEnv;
  endpointFetch?: typeof fetch;
  mcpManager?: McpManagerLike;
}

export function createSkillsRouter(db: AppDatabase, dependencies: SkillsRouterDependencies) {
  const router = Router();
  const customSkills = createSkillRepository(db);
  const runner = createWorkflowRunner(db, {
    adapterRegistry: dependencies.adapterRegistry ?? createAdapterRegistry(),
    env: dependencies.env,
    endpointFetch: dependencies.endpointFetch,
    mcpManager: dependencies.mcpManager
  });

  router.get("/", (_req, res) => {
    res.json([...listBuiltinSkillTemplates(), ...customSkills.list()]);
  });

  router.post("/", (req, res, next) => {
    try {
      const input = createSkillSchema.parse(req.body);
      if (input.id && getBuiltinSkillTemplate(input.id)) {
        throw new ProviderError("unsupported_operation", "Skill id is reserved by a builtin template", { statusCode: 409 });
      }

      res.status(201).json(customSkills.create(input));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", (req, res) => {
    const template = getSkillTemplate(req.params.id, customSkills);
    if (!template) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.json(template);
  });

  router.patch("/:id", (req, res, next) => {
    try {
      if (getBuiltinSkillTemplate(req.params.id)) {
        throw new ProviderError("unsupported_operation", "Builtin skill templates cannot be modified", {
          statusCode: 400
        });
      }

      const input = updateSkillSchema.parse(req.body);
      const updated = customSkills.update(req.params.id, input);
      if (!updated) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", (req, res, next) => {
    try {
      if (getBuiltinSkillTemplate(req.params.id)) {
        throw new ProviderError("unsupported_operation", "Builtin skill templates cannot be deleted", {
          statusCode: 400
        });
      }

      const deleted = customSkills.delete(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/run", async (req, res, next) => {
    try {
      const template = getSkillTemplate(req.params.id, customSkills);
      if (!template) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const input = runSkillSchema.parse(req.body);
      const resolved = resolveSkillTemplate(template, input.parameters);
      const result = await runner.runWorkflow({
        workflowType: "api-workflow",
        input: resolved.input,
        steps: resolved.steps
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function getSkillTemplate(id: string, customSkills: ReturnType<typeof createSkillRepository>) {
  return getBuiltinSkillTemplate(id) ?? customSkills.getById(id);
}
