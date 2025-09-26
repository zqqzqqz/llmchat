import { api } from './api';

export interface AgentItem {
  id: string;
  name: string;
  description?: string;
  model?: string;
  status?: 'active' | 'inactive';
  provider?: string;
  features?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
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

export async function updateAgent(id: string, updates: Partial<{ name: string; description: string; model: string; isActive: boolean; systemPrompt: string; temperature: number; maxTokens: number }>): Promise<AgentItem> {
  const { data } = await api.post<{ success: boolean; data: AgentItem }>(`/agents/${id}/update`, updates);
  return data.data;
}

export async function validateAgent(id: string): Promise<{ agentId: string; isValid: boolean; exists: boolean; isActive: boolean }> {
  const { data } = await api.get<{ success: boolean; data: { agentId: string; isValid: boolean; exists: boolean; isActive: boolean } }>(
    `/agents/${id}/validate`
  );
  return data.data;
}

