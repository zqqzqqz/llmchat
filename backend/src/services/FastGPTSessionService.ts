import axios from 'axios';
import { AgentConfigService } from './AgentConfigService';
import {
  AgentConfig,
  ChatMessage,
  FastGPTChatHistoryDetail,
  FastGPTChatHistoryMessage,
  FastGPTChatHistorySummary,
} from '@/types';
import { getErrorMessage } from '@/utils/helpers';
import { AdaptiveTtlPolicy } from '@/utils/adaptiveCache';

interface RequestDescriptor {
  method: 'get' | 'post' | 'delete';
  path: string;
}

interface ListParams {
  page?: number;
  pageSize?: number;
}

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const FASTGPT_COMPLETIONS_SUFFIX = '/api/v1/chat/completions';

const buildCacheKey = (agentId: string, segment: string) => `${agentId}::${segment}`;

/**
 * FastGPT 会话与历史记录服务
 */
export class FastGPTSessionService {
  private readonly agentService: AgentConfigService;
  private readonly httpClient: ReturnType<typeof axios.create>;
  private readonly historyListCache = new Map<string, CacheEntry<FastGPTChatHistorySummary[]>>();
  private readonly historyDetailCache = new Map<string, CacheEntry<FastGPTChatHistoryDetail>>();
  private readonly inFlightRequests = new Map<string, Promise<any>>();
  private readonly historyListPolicy = new AdaptiveTtlPolicy({
    initialTtl: 10 * 1000,
    minTtl: 5 * 1000,
    maxTtl: 120 * 1000,
    step: 5 * 1000,
    sampleSize: 30,
    adjustIntervalMs: 60 * 1000,
  });
  private readonly historyDetailPolicy = new AdaptiveTtlPolicy({
    initialTtl: 5 * 1000,
    minTtl: 2 * 1000,
    maxTtl: 60 * 1000,
    step: 3 * 1000,
    sampleSize: 30,
    adjustIntervalMs: 45 * 1000,
  });
  private readonly historyEndpointBases = [
    '/api/core/chat/history',
    '/api/v1/core/chat/history',
    '/api/chat/history',
    '/api/v1/chat/history',
  ];
  private readonly feedbackEndpointBases = [
    '/api/core/chat/feedback',
    '/api/v1/core/chat/feedback',
    '/api/chat/feedback',
    '/api/v1/chat/feedback',
  ];

  constructor(agentService: AgentConfigService) {
    this.agentService = agentService;
    this.httpClient = axios.create({
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
    });
  }

  /**
   * 校验并获取 FastGPT 智能体配置
   *
   * Args:
   *   agentId: 智能体唯一标识
   * Returns:
   *   AgentConfig: 合法的智能体配置
   * Raises:
   *   Error: code = NOT_FOUND | INVALID_PROVIDER | INVALID_APP_ID
   */
  private async ensureFastGPTAgent(agentId: string): Promise<AgentConfig> {
    const agent = await this.agentService.getAgent(agentId);
    if (!agent) {
      const err = new Error(`智能体不存在: ${agentId}`) as any;
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (agent.provider !== 'fastgpt') {
      const err = new Error('仅 FastGPT 智能体支持会话历史接口') as any;
      err.code = 'INVALID_PROVIDER';
      throw err;
    }
    if (!agent.appId || !/^[a-fA-F0-9]{24}$/.test(agent.appId)) {
      const err = new Error('FastGPT 智能体缺少有效的 appId 配置') as any;
      err.code = 'INVALID_APP_ID';
      throw err;
    }
    return agent;
  }

  /**
   * 计算 FastGPT 基础 URL
   */
  private getBaseUrl(agent: AgentConfig): string {
    if (!agent.endpoint) {
      throw new Error('FastGPT 智能体缺少 endpoint 配置');
    }
    const cleaned = agent.endpoint.replace(/[`\s]+/g, '').replace(/\/$/, '');
    if (cleaned.endsWith(FASTGPT_COMPLETIONS_SUFFIX)) {
      return cleaned.slice(0, -FASTGPT_COMPLETIONS_SUFFIX.length);
    }
    return cleaned;
  }

  /**
   * 统一请求入口，支持多路径尝试与 /v1 回退
   *
   * Args:
   *   agent: 智能体配置
   *   attempts: 请求尝试序列（方法+路径）
   *   options: 请求参数与 body
   * Returns:
   *   AxiosResponse<T>
   * Raises:
   *   Error: 最终请求失败错误
   */
  private async requestWithFallback<T = any>(
    agent: AgentConfig,
    attempts: RequestDescriptor[],
    options: {
      params?: Record<string, any>;
      data?: Record<string, any>;
    } = {}
  ) {
    const baseUrl = this.getBaseUrl(agent);
    const headers = {
      Authorization: `Bearer ${agent.apiKey}`,
      'Content-Type': 'application/json',
    };

    let lastError: unknown;
    for (const attempt of attempts) {
      // 路径净化，移除反引号与空白
      const cleanPath = attempt.path.replace(/[`\s]+/g, '');
      const url = `${baseUrl}${cleanPath}`;

      try {
        if (attempt.method === 'get') {
          return await this.httpClient.get<T>(url, { 
            params: options.params || {}, 
            headers 
          });
        }
        if (attempt.method === 'delete') {
          return await this.httpClient.delete<T>(url, { 
            params: options.params || {}, 
            headers 
          });
        }
        return await this.httpClient.post<T>(url, options.data, { 
          params: options.params || {}, 
          headers 
        });
      } catch (error: any) {
        lastError = error;
        // 若 404，尝试 /v1 回退
        const status = error?.response?.status;
        if (status === 404) {
          const v1Url = `${baseUrl}/v1${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
          try {
            if (attempt.method === 'get') {
              return await this.httpClient.get<T>(v1Url, { 
                params: options.params || {}, 
                headers 
              });
            }
            if (attempt.method === 'delete') {
              return await this.httpClient.delete<T>(v1Url, { 
                params: options.params || {}, 
                headers 
              });
            }
            return await this.httpClient.post<T>(v1Url, options.data, { 
              params: options.params || {}, 
              headers 
            });
          } catch (v1Error) {
            lastError = v1Error;
          }
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`FastGPT 接口调用失败: ${getErrorMessage(lastError)}`);
  }

  private buildEndpointAttempts(
    bases: string[],
    suffixes: string[],
    method: RequestDescriptor['method']
  ): RequestDescriptor[] {
    const attempts: RequestDescriptor[] = [];
    const seen = new Set<string>();

    for (const base of bases) {
      for (const rawSuffix of suffixes) {
        const suffix = rawSuffix.replace(/^\/+/g, '');
        const path = `${base}/${suffix}`.replace(/\/+/g, '/');
        const key = `${method}:${path}`;
        if (!seen.has(key)) {
          attempts.push({ method, path });
          seen.add(key);
        }
      }
    }

    return attempts;
  }

  private async getWithCache<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    policy: AdaptiveTtlPolicy,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      policy.recordHit();
      return cached.data;
    }

    const inflightKey = `inflight::${key}`;
    if (this.inFlightRequests.has(inflightKey)) {
      return this.inFlightRequests.get(inflightKey) as Promise<T>;
    }

    policy.recordMiss();
    const promise = fetcher()
      .then((result) => {
        cache.set(key, { data: result, expiresAt: Date.now() + policy.getTtl() });
        this.inFlightRequests.delete(inflightKey);
        return result;
      })
      .catch((error) => {
        this.inFlightRequests.delete(inflightKey);
        cache.delete(key);
        throw error;
      });

    this.inFlightRequests.set(inflightKey, promise);
    return promise;
  }

  private invalidateHistoryCaches(agentId: string, chatId?: string): void {
    const listPrefix = buildCacheKey(agentId, 'list');
    for (const key of Array.from(this.historyListCache.keys())) {
      if (key.startsWith(listPrefix)) {
        this.historyListCache.delete(key);
      }
    }
    this.historyListPolicy.notifyInvalidation();

    if (chatId) {
      this.historyDetailCache.delete(buildCacheKey(agentId, `detail:${chatId}`));
      this.historyDetailPolicy.notifyInvalidation();
      return;
    }

    const detailPrefix = buildCacheKey(agentId, 'detail');
    for (const key of Array.from(this.historyDetailCache.keys())) {
      if (key.startsWith(detailPrefix)) {
        this.historyDetailCache.delete(key);
      }
    }
    this.historyDetailPolicy.notifyInvalidation();
  }

  private normalizeHistorySummary(item: any): FastGPTChatHistorySummary {
    const chatId = item?.chatId || item?.id || item?._id || item?.historyId || item?.history_id || '';
    const title = item?.title || item?.name || item?.latestQuestion || item?.latest_question || '未命名对话';
    const createdAt = item?.createTime || item?.create_time || item?.createdAt || item?.created_at || item?.time || new Date().toISOString();
    const updatedAt =
      item?.updateTime || item?.update_time || item?.updatedAt || item?.updated_at || item?.lastUpdateTime || item?.last_update_time || createdAt;

    return {
      chatId: String(chatId),
      appId: item?.appId || item?.app_id,
      title: String(title),
      createdAt: typeof createdAt === 'number' ? new Date(createdAt).toISOString() : String(createdAt),
      updatedAt: typeof updatedAt === 'number' ? new Date(updatedAt).toISOString() : String(updatedAt),
      messageCount: Number(item?.messageCount || item?.msgCount || item?.totalMessages || item?.total || 0),
      tags: Array.isArray(item?.tags) ? item.tags : undefined,
      raw: item,
    };
  }

  private normalizeHistoryMessage(entry: any): FastGPTChatHistoryMessage {
    const dataId = entry?.dataId || entry?.data_id || entry?._id || entry?.id;
    const roleRaw = entry?.role || entry?.obj || entry?.type;
    const role = typeof roleRaw === 'string' ? roleRaw.toLowerCase() : '';

    let normalizedRole: 'user' | 'assistant' | 'system';
    if (role.includes('system')) {
      normalizedRole = 'system';
    } else if (role.includes('assistant') || role.includes('ai') || role.includes('bot')) {
      normalizedRole = 'assistant';
    } else {
      normalizedRole = 'user';
    }

    const value = entry?.value ?? entry?.content ?? entry?.answer ?? entry?.text ?? '';
    const content = Array.isArray(value) ? value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join('\n') : String(value ?? '');
    const feedback = entry?.userGoodFeedback ? 'good' : entry?.userBadFeedback ? 'bad' : null;

    return {
      id: dataId ? String(dataId) : undefined,
      dataId: dataId ? String(dataId) : undefined,
      role: normalizedRole,
      content,
      feedback,
      raw: entry,
    };
  }

  private normalizeHistoryDetail(payload: any): FastGPTChatHistoryDetail {
    const data = payload?.data ?? payload;
    const list = data?.list || data?.messages || data?.history || data?.chatHistoryList || data?.detail || [];
    const title = data?.title || data?.historyName || data?.history_title;

    const messages: FastGPTChatHistoryMessage[] = Array.isArray(list)
      ? list.map((item) => this.normalizeHistoryMessage(item))
      : [];

    const chatId = data?.chatId || data?.historyId || data?.id || data?.chat_id || data?.history_id;

    return {
      chatId: chatId ? String(chatId) : '',
      appId: data?.appId || data?.app_id,
      title: title ? String(title) : undefined,
      messages,
      metadata: {
        total: data?.total,
        hasMore: data?.hasMore,
        raw: data,
      },
    };
  }

  async listHistories(agentId: string, pagination?: ListParams): Promise<FastGPTChatHistorySummary[]> {
    const agent = await this.ensureFastGPTAgent(agentId);
    const params = {
      appId: agent.appId,
      page: pagination?.page,
      pageSize: pagination?.pageSize,
    };

    const attempts = this.buildEndpointAttempts(
      this.historyEndpointBases,
      ['list', 'getHistoryList', 'getHistories'],
      'get'
    );

    const cacheKey = buildCacheKey(
      agentId,
      `list:${params.page || 1}:${params.pageSize || 'default'}`
    );

    return this.getWithCache(this.historyListCache, cacheKey, this.historyListPolicy, async () => {
      const response = await this.requestWithFallback(agent, attempts, { params });
      const payload = response.data;

      if (payload?.code && payload.code !== 200) {
        throw new Error(payload?.message || 'FastGPT 获取会话列表失败');
      }

      const rawList = payload?.data?.list || payload?.data || payload?.historyList || payload?.list || [];
      return Array.isArray(rawList) ? rawList.map((item) => this.normalizeHistorySummary(item)) : [];
    });
  }

  async getHistoryDetail(agentId: string, chatId: string): Promise<FastGPTChatHistoryDetail> {
    const agent = await this.ensureFastGPTAgent(agentId);

    const params = {
      appId: agent.appId,
      chatId,
    };

    const attempts = this.buildEndpointAttempts(
      this.historyEndpointBases,
      ['detail', 'getHistory', 'messages'],
      'get'
    );

    const cacheKey = buildCacheKey(agentId, `detail:${chatId}`);

    return this.getWithCache(this.historyDetailCache, cacheKey, this.historyDetailPolicy, async () => {
      const response = await this.requestWithFallback(agent, attempts, { params });
      const payload = response.data;

      if (payload?.code && payload.code !== 200) {
        throw new Error(payload?.message || 'FastGPT 获取会话详情失败');
      }

      return this.normalizeHistoryDetail(payload?.data ? payload : payload);
    });
  }

  async deleteHistory(agentId: string, chatId: string): Promise<void> {
    const agent = await this.ensureFastGPTAgent(agentId);
    const data = { appId: agent.appId, chatId };

    const attempts = this.buildEndpointAttempts(
      this.historyEndpointBases,
      ['delete', 'removeHistory', 'delHistory'],
      'post'
    );

    const response = await this.requestWithFallback(agent, attempts, { data });
    const payload = response.data;
    if (payload?.code && payload.code !== 200) {
      throw new Error(payload?.message || 'FastGPT 删除历史记录失败');
    }

    this.invalidateHistoryCaches(agentId, chatId);
  }

  async clearHistories(agentId: string): Promise<void> {
    const agent = await this.ensureFastGPTAgent(agentId);
    const data = { appId: agent.appId };

    const attempts = [
      ...this.buildEndpointAttempts(this.historyEndpointBases, ['clear', 'clearHistories'], 'post'),
      ...this.buildEndpointAttempts(this.historyEndpointBases, ['clear'], 'delete'),
    ];

    const response = await this.requestWithFallback(agent, attempts, { data });
    const payload = response.data;
    if (payload?.code && payload.code !== 200) {
      throw new Error(payload?.message || 'FastGPT 清空历史记录失败');
    }

    this.invalidateHistoryCaches(agentId);
  }

  async updateUserFeedback(
    agentId: string,
    payload: {
      chatId: string;
      dataId: string;
      userGoodFeedback?: string;
      userBadFeedback?: string;
    }
  ): Promise<void> {
    const agent = await this.ensureFastGPTAgent(agentId);

    const data: Record<string, any> = {
      appId: agent.appId,
      chatId: payload.chatId,
      dataId: payload.dataId,
    };

    if (payload.userGoodFeedback) {
      data.userGoodFeedback = payload.userGoodFeedback;
    }
    if (payload.userBadFeedback) {
      data.userBadFeedback = payload.userBadFeedback;
    }

    const attempts = this.buildEndpointAttempts(
      this.feedbackEndpointBases,
      ['updateUserFeedback'],
      'post'
    );

    const response = await this.requestWithFallback(agent, attempts, { data });
    const respPayload = response.data as any;
    if (respPayload?.code && respPayload.code !== 200) {
      throw new Error(respPayload?.message || 'FastGPT 更新反馈失败');
    }
  }

  prepareRetryPayload(
    detail: FastGPTChatHistoryDetail,
    targetDataId: string
  ): { messages: ChatMessage[]; responseChatItemId?: string } | null {
    if (!detail || !Array.isArray(detail.messages)) return null;

    const index = detail.messages.findIndex((msg) => msg.dataId === targetDataId || msg.id === targetDataId);
    if (index === -1) {
      return null;
    }

    const assistantEntry = detail.messages[index];
    const previousUser = [...detail.messages]
      .slice(0, index)
      .reverse()
      .find((msg) => msg.role === 'user');

    if (!previousUser) {
      return null;
    }

    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: previousUser.content,
      },
    ];

    const responseChatItemIdRaw = assistantEntry?.dataId ?? assistantEntry?.id;
    const responseChatItemId = responseChatItemIdRaw ? String(responseChatItemIdRaw) : undefined;

    const result: { messages: ChatMessage[]; responseChatItemId?: string } = { messages };
    if (responseChatItemId) {
      result.responseChatItemId = responseChatItemId;
    }

    return result;
  }
}

export type { FastGPTChatHistorySummary };
