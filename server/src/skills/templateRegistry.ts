import { ProviderError } from "../errors/providerError.js";
import type { WorkflowStepDefinition } from "../workflows/types.js";

export type SkillParameterType = "model" | "mcpServer" | "endpoint" | "text";

export interface LocalizedText {
  "zh-CN": string;
  en: string;
}

export interface SkillParameter {
  key: string;
  label: LocalizedText;
  required: boolean;
  type: SkillParameterType;
}

export interface SkillTemplate {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  parameters: SkillParameter[];
  steps: WorkflowStepDefinition[];
  builtin: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ResolvedSkillTemplate {
  input: Record<string, unknown>;
  steps: WorkflowStepDefinition[];
}

export type SkillTemplateParameters = Record<string, unknown>;

export const BUILTIN_SKILLS: SkillTemplate[] = [
  {
    id: "llm-single-reply",
    name: { "zh-CN": "单模型回复", en: "Single Model Reply" },
    description: {
      "zh-CN": "把用户输入发送给一个聊天模型并返回回复。",
      en: "Send user input to one chat model and return the reply."
    },
    parameters: [
      { key: "model", label: { "zh-CN": "模型", en: "Model" }, required: true, type: "model" },
      { key: "text", label: { "zh-CN": "文本", en: "Text" }, required: true, type: "text" }
    ],
    steps: [
      {
        id: "reply",
        type: "llm.chat",
        modelId: "{{model}}",
        input: { message: "{{input.text}}" }
      }
    ],
    builtin: true
  },
  {
    id: "llm-summarize",
    name: { "zh-CN": "文本总结", en: "Text Summarizer" },
    description: {
      "zh-CN": "用指定模型生成一段简洁摘要。",
      en: "Generate a concise summary with the selected model."
    },
    parameters: [
      { key: "model", label: { "zh-CN": "模型", en: "Model" }, required: true, type: "model" },
      { key: "text", label: { "zh-CN": "原文", en: "Source Text" }, required: true, type: "text" }
    ],
    steps: [
      {
        id: "summary",
        type: "llm.chat",
        modelId: "{{model}}",
        input: { message: "Summarize this text in one short paragraph:\n\n{{input.text}}" }
      }
    ],
    builtin: true
  },
  {
    id: "llm-translate",
    name: { "zh-CN": "文本翻译", en: "Text Translator" },
    description: {
      "zh-CN": "把文本翻译为指定目标语言。",
      en: "Translate text into the target language."
    },
    parameters: [
      { key: "model", label: { "zh-CN": "模型", en: "Model" }, required: true, type: "model" },
      { key: "text", label: { "zh-CN": "文本", en: "Text" }, required: true, type: "text" },
      { key: "targetLang", label: { "zh-CN": "目标语言", en: "Target Language" }, required: true, type: "text" }
    ],
    steps: [
      {
        id: "translation",
        type: "llm.chat",
        modelId: "{{model}}",
        input: { message: "Translate the following text into {{input.targetLang}}:\n\n{{input.text}}" }
      }
    ],
    builtin: true
  }
];

export function listBuiltinSkillTemplates(): SkillTemplate[] {
  return BUILTIN_SKILLS.map(cloneSkillTemplate);
}

export function getBuiltinSkillTemplate(id: string): SkillTemplate | undefined {
  const template = BUILTIN_SKILLS.find((entry) => entry.id === id);
  return template ? cloneSkillTemplate(template) : undefined;
}

export function resolveSkillTemplate(
  template: SkillTemplate,
  parameters: SkillTemplateParameters
): ResolvedSkillTemplate {
  for (const parameter of template.parameters) {
    if (!parameter.required) continue;
    const value = parameters[parameter.key];
    if (value === undefined || value === null || value === "") {
      throw new ProviderError("invalid_workflow_step", `Missing required skill parameter: ${parameter.key}`, {
        statusCode: 400
      });
    }
  }

  const workflowInput = Object.fromEntries(
    template.parameters
      .filter((parameter) => parameter.type === "text")
      .map((parameter) => [parameter.key, parameters[parameter.key]])
      .filter((entry) => entry[1] !== undefined)
  );

  return {
    input: workflowInput,
    steps: template.steps.map((step) => resolveStepResourceParameters(step, parameters))
  };
}

function resolveStepResourceParameters(
  step: WorkflowStepDefinition,
  parameters: SkillTemplateParameters
): WorkflowStepDefinition {
  if (step.type === "llm.chat") {
    return {
      ...step,
      modelId: resolveResourcePlaceholder(step.modelId, parameters)
    };
  }

  if (step.type === "endpoint.call") {
    return {
      ...step,
      endpointId: resolveResourcePlaceholder(step.endpointId, parameters)
    };
  }

  return {
    ...step,
    mcpServerId: resolveResourcePlaceholder(step.mcpServerId, parameters)
  };
}

function resolveResourcePlaceholder(value: string, parameters: SkillTemplateParameters): string {
  const exactPlaceholder = value.match(/^\{\{([A-Za-z0-9_]+)\}\}$/);
  if (!exactPlaceholder) return value;

  const resolved = parameters[exactPlaceholder[1]];
  return typeof resolved === "string" ? resolved : value;
}

function cloneSkillTemplate(template: SkillTemplate): SkillTemplate {
  return JSON.parse(JSON.stringify(template)) as SkillTemplate;
}
