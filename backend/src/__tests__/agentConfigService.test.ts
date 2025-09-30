jest.mock('fs/promises', () => {
  const actual = jest.requireActual('fs/promises');
  return {
    ...actual,
    writeFile: jest.fn().mockResolvedValue(undefined),
  };
});

import fs from 'fs';
import path from 'path';
import { AgentConfigService } from '@/services/AgentConfigService';

interface AgentDbRow {
  id: string;
  name: string;
  description: string | null;
  provider: string;
  endpoint: string;
  api_key: string;
  app_id: string | null;
  model: string;
  max_tokens: number | null;
  temperature: number | null;
  system_prompt: string | null;
  capabilities: any;
  rate_limit: any;
  features: any;
  metadata: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const dbState: { agentConfigs: AgentDbRow[] } = {
  agentConfigs: [],
};

const parseJson = (value: any) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    if (value.trim() === '' || value.trim().toLowerCase() === 'null') {
      return null;
    }
    return JSON.parse(value);
  }
  return value;
};

const cloneRow = (row: AgentDbRow): AgentDbRow => ({
  ...row,
  capabilities: Array.isArray(row.capabilities)
    ? [...row.capabilities]
    : Array.isArray(parseJson(row.capabilities))
      ? [...(parseJson(row.capabilities) as any[])]
      : row.capabilities,
  rate_limit: row.rate_limit ? { ...row.rate_limit } : null,
  features: row.features ? { ...row.features } : null,
  metadata: row.metadata ? { ...row.metadata } : null,
});

const mockQuery = jest.fn(async (query: string, params: any[] = []) => {
  const normalized = query.replace(/\s+/g, ' ').trim().toLowerCase();

  if (normalized.startsWith('select count(*)::text as count from agent_configs')) {
    return { rows: [{ count: String(dbState.agentConfigs.length) }] };
  }

  if (normalized.startsWith('select * from agent_configs')) {
    return {
      rows: dbState.agentConfigs.map((row) => cloneRow(row)),
    };
  }

  if (normalized.startsWith('insert into agent_configs')) {
    const newRow: AgentDbRow = {
      id: params[0],
      name: params[1],
      description: params[2] ?? null,
      provider: params[3],
      endpoint: params[4],
      api_key: params[5],
      app_id: params[6] ?? null,
      model: params[7],
      max_tokens: params[8] ?? null,
      temperature: params[9] ?? null,
      system_prompt: params[10] ?? null,
      capabilities: parseJson(params[11]) ?? [],
      rate_limit: parseJson(params[12]),
      features: parseJson(params[13]),
      metadata: parseJson(params[14]) ?? {},
      is_active: Boolean(params[15]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const index = dbState.agentConfigs.findIndex((row) => row.id === newRow.id);
    if (index >= 0) {
      const existing = dbState.agentConfigs[index];
      if (existing) {
        dbState.agentConfigs[index] = {
          ...existing,
          ...newRow,
          created_at: existing.created_at,
        };
        dbState.agentConfigs[index].updated_at = new Date().toISOString();
      }
    } else {
      dbState.agentConfigs.push(newRow);
    }
    return { rows: [] };
  }

  if (normalized.startsWith('update agent_configs set')) {
    const id = params[14];
    const target = dbState.agentConfigs.find((row) => row.id === id);
    if (target) {
      target.name = params[0];
      target.description = params[1] ?? null;
      target.provider = params[2];
      target.endpoint = params[3];
      target.api_key = params[4];
      target.app_id = params[5] ?? null;
      target.model = params[6];
      target.max_tokens = params[7] ?? null;
      target.temperature = params[8] ?? null;
      target.system_prompt = params[9] ?? null;
      target.capabilities = parseJson(params[10]) ?? [];
      target.rate_limit = parseJson(params[11]);
      target.features = parseJson(params[12]);
      target.is_active = Boolean(params[13]);
      target.updated_at = new Date().toISOString();
    }
    return { rows: [] };
  }

  if (normalized.startsWith('delete from agent_configs')) {
    const id = params[0];
    dbState.agentConfigs = dbState.agentConfigs.filter((row) => row.id !== id);
    return { rows: [] };
  }

  throw new Error(`Unhandled query in mock: ${query}`);
});

const mockClient = { query: mockQuery };
const mockWithClient = jest.fn(async (fn: (client: typeof mockClient) => Promise<any> | any) => fn(mockClient));

jest.mock('@/utils/db', () => ({
  withClient: (fn: (client: typeof mockClient) => Promise<any>) => mockWithClient(fn),
}));

const agentsFixturePath = path.resolve(__dirname, '../../../config/agents.json');
const fixtureAgents = JSON.parse(fs.readFileSync(agentsFixturePath, 'utf-8')).agents as Array<{ id: string; name: string }>;

const createService = () => new AgentConfigService(agentsFixturePath);

describe('AgentConfigService with mocked database', () => {
  beforeEach(() => {
    dbState.agentConfigs = [];
    mockQuery.mockClear();
    mockWithClient.mockClear();
  });

  it('loads agents from JSON file when database is empty', async () => {
    const service = createService();
    const agents = await service.loadAgents();

    expect(agents).toHaveLength(fixtureAgents.length);
    expect(dbState.agentConfigs).toHaveLength(fixtureAgents.length);
    expect(agents[0]?.id).toBe(fixtureAgents[0]?.id);
  });

  it('creates a new agent and persists it through the service', async () => {
    const service = createService();
    await service.loadAgents();

    const created = await service.createAgent({
      name: '测试新智能体',
      description: '由管理员创建的测试记录',
      provider: 'fastgpt',
      endpoint: 'https://example.com/api/v1/chat/completions',
      apiKey: 'fastgpt-abcdefghijklmnopqrstuvwxyz012345',
      appId: '1234567890abcdef12345678',
      model: 'FastAI-4k',
      maxTokens: 1024,
      temperature: 0.5,
      systemPrompt: '你是一个友好的测试助手。',
      capabilities: ['chat'],
      rateLimit: { requestsPerMinute: 10, tokensPerMinute: 1000 },
      isActive: true,
    });

    const stored = dbState.agentConfigs.find((row) => row.id === created.id);
    expect(stored).toBeTruthy();
    expect(stored?.name).toBe('测试新智能体');

    const fetched = await service.getAgent(created.id);
    expect(fetched?.name).toBe('测试新智能体');
    expect(fetched?.model).toBe('FastAI-4k');
  });

  it('updates and deletes an agent from the mocked database', async () => {
    const service = createService();
    const [first] = await service.loadAgents();
    expect(first).toBeDefined();
    if (!first) {
      throw new Error('fixture agent missing');
    }

    await service.updateAgent(first.id, {
      name: '更新后的名称',
      description: '更新后的描述',
      isActive: false,
    });

    const updatedRow = dbState.agentConfigs.find((row) => row.id === first.id);
    expect(updatedRow?.name).toBe('更新后的名称');
    expect(updatedRow?.is_active).toBe(false);

    const updatedAgent = await service.getAgent(first.id);
    expect(updatedAgent?.name).toBe('更新后的名称');
    expect(updatedAgent?.isActive).toBe(false);

    await service.deleteAgent(first.id);
    expect(dbState.agentConfigs.find((row) => row.id === first.id)).toBeUndefined();
    const afterDelete = await service.getAgent(first.id);
    expect(afterDelete).toBeNull();
  });
});
