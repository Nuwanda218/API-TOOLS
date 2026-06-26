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
