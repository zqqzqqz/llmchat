import { api } from './api';

export interface AgentItem {
  id: string;
  name: string;
  description?: string;
  model?: string;
  status?: 'active' | 'inactive';
  provider?: string;
  capabilities?: string[];
  features?: Record<string, any>;
  rateLimit?: { requestsPerMinute?: number; tokensPerMinute?: number };
  endpoint?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  appId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentPayload {
  id?: string;
  name: string;
  description?: string;
  provider: string;
  endpoint: string;
  apiKey: string;
  appId?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  capabilities?: string[];
  rateLimit?: { requestsPerMinute?: number; tokensPerMinute?: number };
  isActive?: boolean;
  features?: Record<string, any>;
}

export async function listAgents(opts?: { includeInactive?: boolean }): Promise<AgentItem[]> {
  const { data } = await api.get<{ success: boolean; data: AgentItem[]; total: number }>(
    '/agents',
    { params: { includeInactive: opts?.includeInactive ? 'true' : undefined } }
  );
  return data.data;
}

export async function reloadAgents(): Promise<{ totalAgents: number; activeAgents: number }> {
  const { data } = await api.post<{ success: boolean; data: { totalAgents: number; activeAgents: number } }>(
    '/agents/reload',
    {}
  );
  return data.data;
}

export async function updateAgent(id: string, updates: Partial<AgentPayload>): Promise<AgentItem> {
  const { data } = await api.put<{ success: boolean; data: AgentItem }>(`/agents/${id}`, updates);
  return data.data;
}

export async function createAgent(payload: AgentPayload): Promise<AgentItem> {
  const { data } = await api.post<{ success: boolean; data: AgentItem }>('/agents', payload);
  return data.data;
}

export async function deleteAgent(id: string): Promise<void> {
  await api.delete(`/agents/${id}`);
}

export async function importAgents(payload: { agents: AgentPayload[] }): Promise<AgentItem[]> {
  const { data } = await api.post<{ success: boolean; data: AgentItem[] }>('/agents/import', payload);
  return data.data;
}

export async function validateAgent(id: string): Promise<{ agentId: string; isValid: boolean; exists: boolean; isActive: boolean }> {
  const { data } = await api.get<{ success: boolean; data: { agentId: string; isValid: boolean; exists: boolean; isActive: boolean } }>(
    `/agents/${id}/validate`
  );
  return data.data;
}

