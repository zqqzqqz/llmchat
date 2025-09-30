import { withClient } from '@/utils/db';
import { generateId } from '@/utils/helpers';
import { geoService } from '@/services/GeoService';

export interface ProvinceHeatmapPoint {
  province: string;
  count: number;
}

export interface ProvinceHeatmapSummary {
  overseas: number;
  local: number;
  unknown: number;
}

export interface ProvinceHeatmapResult {
  start: string;
  end: string;
  agentId: string | null;
  total: number;
  points: ProvinceHeatmapPoint[];
  summary: ProvinceHeatmapSummary;
  generatedAt: string;
}

const MAP_PROVINCES = new Set(geoService.getProvinceNames());

export interface ConversationSeriesBucket {
  date: string;
  total: number;
  byAgent: Array<{ agentId: string; count: number }>;
}

export interface ConversationSeriesAgentTotal {
  agentId: string;
  name: string;
  isActive: boolean;
  count: number;
}

export interface ConversationSeriesResult {
  start: string;
  end: string;
  agentId: string | null;
  granularity: 'day';
  buckets: ConversationSeriesBucket[];
  total: number;
  agentTotals: ConversationSeriesAgentTotal[];
  generatedAt: string;
}

export interface AgentComparisonResult {
  start: string;
  end: string;
  totals: ConversationSeriesAgentTotal[];
  total: number;
  generatedAt: string;
}

export class AnalyticsService {
  async recordAgentRequest(params: {
    agentId: string;
    sessionId?: string | null;
    ip?: string | null;
  }): Promise<void> {
    const normalizedIp = geoService.normalizeIp(params.ip ?? null);
    const lookup = geoService.lookup(normalizedIp ?? undefined);

    const province = lookup?.province ?? '未知';
    const country = lookup?.country ?? 'UNKNOWN';
    const city = lookup?.city ?? null;

    try {
      await withClient(async (client) => {
        await client.query(
          `INSERT INTO chat_geo_events (
            id,
            agent_id,
            session_id,
            ip,
            country,
            province,
            city
          ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            generateId(),
            params.agentId,
            params.sessionId || null,
            normalizedIp,
            country,
            province,
            city,
          ]
        );
      });
    } catch (error) {
      console.warn('[AnalyticsService] recordAgentRequest failed:', error);
    }
  }

  async getProvinceHeatmap(params: {
    start: Date;
    end: Date;
    agentId?: string | null;
  }): Promise<ProvinceHeatmapResult> {
    const { start, end, agentId } = params;

    const rows = await withClient(async (client) => {
      const sql = `
        SELECT COALESCE(province, '未知') AS province, COUNT(*)::text AS count
        FROM chat_geo_events
        WHERE created_at >= $1 AND created_at <= $2
        ${agentId ? 'AND agent_id = $3' : ''}
        GROUP BY COALESCE(province, '未知')
      `;
      const queryParams: any[] = agentId ? [start, end, agentId] : [start, end];
      const { rows } = await client.query<{ province: string | null; count: string }>(sql, queryParams);
      return rows;
    });

    const points: ProvinceHeatmapPoint[] = [];
    let total = 0;
    let overseas = 0;
    let local = 0;
    let unknown = 0;

    rows.forEach((row) => {
      const province = row.province || '未知';
      const count = parseInt(row.count, 10) || 0;
      total += count;
      if (province === '海外') {
        overseas += count;
        return;
      }
      if (province === '本地') {
        local += count;
        return;
      }
      if (!MAP_PROVINCES.has(province)) {
        unknown += count;
        return;
      }
      points.push({ province, count });
    });

    points.sort((a, b) => b.count - a.count);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      agentId: agentId ?? null,
      total,
      points,
      summary: {
        overseas,
        local,
        unknown,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async getConversationSeries(params: {
    start: Date;
    end: Date;
    agentId?: string | null;
  }): Promise<ConversationSeriesResult> {
    const { start, end, agentId } = params;

    const { countRows, agentRows } = await withClient(async (client) => {
      const countQuery = `
        SELECT date_trunc('day', created_at) AS day, agent_id, COUNT(*)::int AS count
        FROM chat_geo_events
        WHERE created_at >= $1 AND created_at <= $2
        ${agentId ? 'AND agent_id = $3' : ''}
        GROUP BY day, agent_id
      `;
      const countParams: any[] = agentId ? [start, end, agentId] : [start, end];
      const [countResult, agentResult] = await Promise.all([
        client.query<{ day: Date; agent_id: string; count: number }>(countQuery, countParams),
        client.query<{ id: string; name: string; is_active: boolean }>(
          'SELECT id, name, is_active FROM agent_configs ORDER BY name ASC'
        ),
      ]);

      return { countRows: countResult.rows, agentRows: agentResult.rows };
    });

    const dayMap = new Map<string, Map<string, number>>();
    const agentTotalsMap = new Map<string, number>();

    countRows.forEach((row) => {
      const dayKey = new Date(row.day).toISOString().slice(0, 10);
      const perDay = dayMap.get(dayKey) ?? new Map<string, number>();
      perDay.set(row.agent_id, (perDay.get(row.agent_id) ?? 0) + Number(row.count || 0));
      dayMap.set(dayKey, perDay);
      agentTotalsMap.set(row.agent_id, (agentTotalsMap.get(row.agent_id) ?? 0) + Number(row.count || 0));
    });

    const msPerDay = 24 * 60 * 60 * 1000;
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    const bucketCount = Math.max(0, Math.floor((endDay.getTime() - startDay.getTime()) / msPerDay)) + 1;

    const buckets: ConversationSeriesBucket[] = [];
    let total = 0;
    for (let i = 0; i < bucketCount; i += 1) {
      const current = new Date(startDay.getTime() + i * msPerDay);
      const key = current.toISOString().slice(0, 10);
      const perDay = dayMap.get(key) ?? new Map<string, number>();
      const byAgent = Array.from(perDay.entries()).map(([agent, count]) => ({ agentId: agent, count }));
      const dayTotal = byAgent.reduce((sum, item) => sum + item.count, 0);
      total += dayTotal;
      buckets.push({ date: key, total: dayTotal, byAgent });
    }

    const relevantAgents = agentRows.filter((row) => {
      if (!agentId) return true;
      return row.id === agentId;
    });

    const agentTotals: ConversationSeriesAgentTotal[] = relevantAgents
      .map((row) => ({
        agentId: row.id,
        name: row.name,
        isActive: !!row.is_active,
        count: agentTotalsMap.get(row.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      agentId: agentId ?? null,
      granularity: 'day',
      buckets,
      total,
      agentTotals,
      generatedAt: new Date().toISOString(),
    };
  }

  async getAgentTotals(params: { start: Date; end: Date }): Promise<AgentComparisonResult> {
    const { start, end } = params;

    const { totalRows, agentRows } = await withClient(async (client) => {
      const [agentResult, totalResult] = await Promise.all([
        client.query<{ id: string; name: string; is_active: boolean }>(
          'SELECT id, name, is_active FROM agent_configs ORDER BY name ASC'
        ),
        client.query<{ agent_id: string; count: number }>(
          `
            SELECT agent_id, COUNT(*)::int AS count
            FROM chat_geo_events
            WHERE created_at >= $1 AND created_at <= $2
            GROUP BY agent_id
          `,
          [start, end]
        ),
      ]);

      return { agentRows: agentResult.rows, totalRows: totalResult.rows };
    });

    const countMap = new Map<string, number>();
    totalRows.forEach((row) => {
      countMap.set(row.agent_id, (countMap.get(row.agent_id) ?? 0) + Number(row.count || 0));
    });

    const totals: ConversationSeriesAgentTotal[] = agentRows
      .map((row) => ({
        agentId: row.id,
        name: row.name,
        isActive: !!row.is_active,
        count: countMap.get(row.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const total = totals.reduce((sum, item) => sum + item.count, 0);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      totals,
      total,
      generatedAt: new Date().toISOString(),
    };
  }
}
