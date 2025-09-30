jest.mock(
  'geoip-lite',
  () => ({
    lookup: () => null,
  }),
  { virtual: true }
);

import { AnalyticsService } from '@/services/AnalyticsService';

type AgentRow = { id: string; name: string; is_active: boolean };
type EventRow = { agent_id: string; created_at: Date };

const dbState: { agents: AgentRow[]; events: EventRow[] } = {
  agents: [
    { id: 'agent-1', name: 'Alpha', is_active: true },
    { id: 'agent-2', name: 'Beta', is_active: true },
    { id: 'agent-3', name: 'Gamma', is_active: false },
  ],
  events: [],
};

const cloneDate = (date: Date) => new Date(date.getTime());

const mockQuery = jest.fn(async (query: string, params: any[] = []) => {
  const normalized = query.replace(/\s+/g, ' ').trim().toLowerCase();

  if (normalized.startsWith('select id, name, is_active from agent_configs')) {
    return {
      rows: dbState.agents.map((agent) => ({ ...agent })),
    };
  }

  if (normalized.includes('from chat_geo_events') && normalized.includes('date_trunc(')) {
    const start: Date = params[0];
    const end: Date = params[1];
    const filterAgentId: string | null = params[2] ?? null;
    const byDay = new Map<string, Map<string, number>>();
    dbState.events.forEach((event) => {
      if (event.created_at < start || event.created_at > end) return;
      if (filterAgentId && event.agent_id !== filterAgentId) return;
      const dayKey = event.created_at.toISOString().slice(0, 10);
      const perAgent = byDay.get(dayKey) ?? new Map<string, number>();
      perAgent.set(event.agent_id, (perAgent.get(event.agent_id) ?? 0) + 1);
      byDay.set(dayKey, perAgent);
    });
    const rows: Array<{ day: Date; agent_id: string; count: number }> = [];
    byDay.forEach((perAgent, dayKey) => {
      perAgent.forEach((count, agentId) => {
        rows.push({
          day: new Date(`${dayKey}T00:00:00.000Z`),
          agent_id: agentId,
          count,
        });
      });
    });
    return { rows };
  }

  if (normalized.startsWith('select agent_id, count(*)::int as count from chat_geo_events')) {
    const start: Date = params[0];
    const end: Date = params[1];
    const counts = new Map<string, number>();
    dbState.events.forEach((event) => {
      if (event.created_at < start || event.created_at > end) return;
      counts.set(event.agent_id, (counts.get(event.agent_id) ?? 0) + 1);
    });
    const rows = Array.from(counts.entries()).map(([agent_id, count]) => ({ agent_id, count }));
    return { rows };
  }

  throw new Error(`Unhandled query: ${normalized}`);
});

const mockClient = { query: mockQuery };
const mockWithClient = jest.fn(async (fn: (client: typeof mockClient) => Promise<any>) => fn(mockClient));

jest.mock('@/utils/db', () => ({
  withClient: (fn: (client: typeof mockClient) => Promise<any>) => mockWithClient(fn),
}));

describe('AnalyticsService conversation analytics', () => {
  const service = new AnalyticsService();

  beforeEach(() => {
    mockQuery.mockClear();
    mockWithClient.mockClear();
    const base = new Date('2024-07-01T00:00:00.000Z');
    dbState.events = [
      { agent_id: 'agent-1', created_at: cloneDate(new Date(base.getTime())) },
      { agent_id: 'agent-1', created_at: cloneDate(new Date(base.getTime() + 2 * 60 * 60 * 1000)) },
      { agent_id: 'agent-2', created_at: cloneDate(new Date(base.getTime() + 24 * 60 * 60 * 1000)) },
      { agent_id: 'agent-1', created_at: cloneDate(new Date(base.getTime() + 24 * 60 * 60 * 1000)) },
      { agent_id: 'agent-3', created_at: cloneDate(new Date(base.getTime() + 2 * 24 * 60 * 60 * 1000)) },
    ];
  });

  it('builds a daily series with totals across the requested range', async () => {
    const start = new Date('2024-07-01T00:00:00.000Z');
    const end = new Date('2024-07-03T23:59:59.999Z');

    const result = await service.getConversationSeries({ start, end });

    expect(result.buckets).toHaveLength(3);
    expect(result.total).toBe(5);
    expect(result.buckets[0]?.total).toBe(2);
    expect(result.buckets[1]?.total).toBe(2);
    expect(result.buckets[2]?.total).toBe(1);
    expect(result.agentTotals.find((item) => item.agentId === 'agent-1')?.count).toBe(3);
  });

  it('filters the series by agent when agentId is provided', async () => {
    const start = new Date('2024-07-01T00:00:00.000Z');
    const end = new Date('2024-07-02T23:59:59.999Z');

    const result = await service.getConversationSeries({ start, end, agentId: 'agent-2' });

    expect(result.total).toBe(1);
    expect(result.buckets[0]?.total).toBe(0);
    expect(result.buckets[1]?.total).toBe(1);
    expect(result.agentTotals).toHaveLength(1);
    expect(result.agentTotals[0]?.agentId).toBe('agent-2');
  });

  it('aggregates agent totals for the comparison endpoint', async () => {
    const start = new Date('2024-07-01T00:00:00.000Z');
    const end = new Date('2024-07-03T23:59:59.999Z');

    const result = await service.getAgentTotals({ start, end });

    const alpha = result.totals.find((item) => item.agentId === 'agent-1');
    const beta = result.totals.find((item) => item.agentId === 'agent-2');
    const gamma = result.totals.find((item) => item.agentId === 'agent-3');

    expect(alpha?.count).toBe(3);
    expect(beta?.count).toBe(1);
    expect(gamma?.count).toBe(1);
    expect(result.total).toBe(5);
  });
});
