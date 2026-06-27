export type McpTransport = "stdio";

export interface McpServerRecord {
  id: string;
  name: string;
  transport: McpTransport;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface McpContentBlock {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface McpCallResult {
  ok: boolean;
  content: McpContentBlock[];
  isError?: boolean;
  latencyMs: number;
}

export interface CreateMcpServerInput {
  id?: string;
  name: string;
  transport?: McpTransport;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export type UpdateMcpServerInput = Partial<Omit<CreateMcpServerInput, "id">>;
