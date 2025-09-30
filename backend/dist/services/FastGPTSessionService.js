"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FastGPTSessionService = void 0;
const axios_1 = __importDefault(require("axios"));
const helpers_1 = require("@/utils/helpers");
const adaptiveCache_1 = require("@/utils/adaptiveCache");
const FASTGPT_COMPLETIONS_SUFFIX = '/api/v1/chat/completions';
const buildCacheKey = (agentId, segment) => `${agentId}::${segment}`;
class FastGPTSessionService {
    constructor(agentService) {
        this.historyListCache = new Map();
        this.historyDetailCache = new Map();
        this.inFlightRequests = new Map();
        this.historyListPolicy = new adaptiveCache_1.AdaptiveTtlPolicy({
            initialTtl: 10 * 1000,
            minTtl: 5 * 1000,
            maxTtl: 120 * 1000,
            step: 5 * 1000,
            sampleSize: 30,
            adjustIntervalMs: 60 * 1000,
        });
        this.historyDetailPolicy = new adaptiveCache_1.AdaptiveTtlPolicy({
            initialTtl: 5 * 1000,
            minTtl: 2 * 1000,
            maxTtl: 60 * 1000,
            step: 3 * 1000,
            sampleSize: 30,
            adjustIntervalMs: 45 * 1000,
        });
        this.agentService = agentService;
        this.httpClient = axios_1.default.create({
            timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
        });
    }
    async ensureFastGPTAgent(agentId) {
        const agent = await this.agentService.getAgent(agentId);
        if (!agent) {
            const err = new Error(`智能体不存在: ${agentId}`);
            err.code = 'NOT_FOUND';
            throw err;
        }
        if (agent.provider !== 'fastgpt') {
            const err = new Error('仅 FastGPT 智能体支持会话历史接口');
            err.code = 'INVALID_PROVIDER';
            throw err;
        }
        if (!agent.appId || !/^[a-fA-F0-9]{24}$/.test(agent.appId)) {
            const err = new Error('FastGPT 智能体缺少有效的 appId 配置');
            err.code = 'INVALID_APP_ID';
            throw err;
        }
        return agent;
    }
    getBaseUrl(agent) {
        if (!agent.endpoint) {
            throw new Error('FastGPT 智能体缺少 endpoint 配置');
        }
        const cleaned = agent.endpoint.replace(/[`\s]+/g, '').replace(/\/$/, '');
        if (cleaned.endsWith(FASTGPT_COMPLETIONS_SUFFIX)) {
            return cleaned.slice(0, -FASTGPT_COMPLETIONS_SUFFIX.length);
        }
        return cleaned;
    }
    async requestWithFallback(agent, attempts, options = {}) {
        const baseUrl = this.getBaseUrl(agent);
        const headers = {
            Authorization: `Bearer ${agent.apiKey}`,
            'Content-Type': 'application/json',
        };
        let lastError;
        for (const attempt of attempts) {
            const cleanPath = attempt.path.replace(/[`\s]+/g, '');
            const url = `${baseUrl}${cleanPath}`;
            try {
                if (attempt.method === 'get') {
                    return await this.httpClient.get(url, {
                        params: options.params || {},
                        headers
                    });
                }
                if (attempt.method === 'delete') {
                    return await this.httpClient.delete(url, {
                        params: options.params || {},
                        headers
                    });
                }
                return await this.httpClient.post(url, options.data, {
                    params: options.params || {},
                    headers
                });
            }
            catch (error) {
                lastError = error;
                const status = error?.response?.status;
                if (status === 404) {
                    const v1Url = `${baseUrl}/v1${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
                    try {
                        if (attempt.method === 'get') {
                            return await this.httpClient.get(v1Url, {
                                params: options.params || {},
                                headers
                            });
                        }
                        if (attempt.method === 'delete') {
                            return await this.httpClient.delete(v1Url, {
                                params: options.params || {},
                                headers
                            });
                        }
                        return await this.httpClient.post(v1Url, options.data, {
                            params: options.params || {},
                            headers
                        });
                    }
                    catch (v1Error) {
                        lastError = v1Error;
                    }
                }
            }
        }
        throw lastError instanceof Error ? lastError : new Error(`FastGPT 接口调用失败: ${(0, helpers_1.getErrorMessage)(lastError)}`);
    }
    async getWithCache(cache, key, policy, fetcher) {
        const now = Date.now();
        const cached = cache.get(key);
        if (cached && cached.expiresAt > now) {
            policy.recordHit();
            return cached.data;
        }
        const inflightKey = `inflight::${key}`;
        if (this.inFlightRequests.has(inflightKey)) {
            return this.inFlightRequests.get(inflightKey);
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
    invalidateHistoryCaches(agentId, chatId) {
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
    normalizeHistorySummary(item) {
        const chatId = item?.chatId || item?.id || item?._id || item?.historyId || item?.history_id || '';
        const title = item?.title || item?.name || item?.latestQuestion || item?.latest_question || '未命名对话';
        const createdAt = item?.createTime || item?.create_time || item?.createdAt || item?.created_at || item?.time || new Date().toISOString();
        const updatedAt = item?.updateTime || item?.update_time || item?.updatedAt || item?.updated_at || item?.lastUpdateTime || item?.last_update_time || createdAt;
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
    normalizeHistoryMessage(entry) {
        const dataId = entry?.dataId || entry?.data_id || entry?._id || entry?.id;
        const roleRaw = entry?.role || entry?.obj || entry?.type;
        const role = typeof roleRaw === 'string' ? roleRaw.toLowerCase() : '';
        let normalizedRole;
        if (role.includes('system')) {
            normalizedRole = 'system';
        }
        else if (role.includes('assistant') || role.includes('ai') || role.includes('bot')) {
            normalizedRole = 'assistant';
        }
        else {
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
    normalizeHistoryDetail(payload) {
        const data = payload?.data ?? payload;
        const list = data?.list || data?.messages || data?.history || data?.chatHistoryList || data?.detail || [];
        const title = data?.title || data?.historyName || data?.history_title;
        const messages = Array.isArray(list)
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
    async listHistories(agentId, pagination) {
        const agent = await this.ensureFastGPTAgent(agentId);
        const params = {
            appId: agent.appId,
            page: pagination?.page,
            pageSize: pagination?.pageSize,
        };
        const attempts = [
            { method: 'get', path: '/api/core/chat/history/list' },
            { method: 'get', path: '/api/core/chat/history/getHistoryList' },
            { method: 'get', path: '/api/core/chat/history/getHistories' },
        ];
        const cacheKey = buildCacheKey(agentId, `list:${params.page || 1}:${params.pageSize || 'default'}`);
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
    async getHistoryDetail(agentId, chatId) {
        const agent = await this.ensureFastGPTAgent(agentId);
        const params = {
            appId: agent.appId,
            chatId,
        };
        const attempts = [
            { method: 'get', path: '/api/core/chat/history/detail' },
            { method: 'get', path: '/api/core/chat/history/getHistory' },
            { method: 'get', path: '/api/core/chat/history/messages' },
        ];
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
    async deleteHistory(agentId, chatId) {
        const agent = await this.ensureFastGPTAgent(agentId);
        const data = { appId: agent.appId, chatId };
        const attempts = [
            { method: 'post', path: '/api/core/chat/history/delete' },
            { method: 'post', path: '/api/core/chat/history/removeHistory' },
            { method: 'post', path: '/api/core/chat/history/delHistory' },
        ];
        const response = await this.requestWithFallback(agent, attempts, { data });
        const payload = response.data;
        if (payload?.code && payload.code !== 200) {
            throw new Error(payload?.message || 'FastGPT 删除历史记录失败');
        }
        this.invalidateHistoryCaches(agentId, chatId);
    }
    async clearHistories(agentId) {
        const agent = await this.ensureFastGPTAgent(agentId);
        const data = { appId: agent.appId };
        const attempts = [
            { method: 'post', path: '/api/core/chat/history/clear' },
            { method: 'post', path: '/api/core/chat/history/clearHistories' },
            { method: 'delete', path: '/api/core/chat/history/clear' },
        ];
        const response = await this.requestWithFallback(agent, attempts, { data });
        const payload = response.data;
        if (payload?.code && payload.code !== 200) {
            throw new Error(payload?.message || 'FastGPT 清空历史记录失败');
        }
        this.invalidateHistoryCaches(agentId);
    }
    prepareRetryPayload(detail, targetDataId) {
        if (!detail || !Array.isArray(detail.messages))
            return null;
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
        const messages = [
            {
                role: 'user',
                content: previousUser.content,
            },
        ];
        const responseChatItemIdRaw = assistantEntry?.dataId ?? assistantEntry?.id;
        const responseChatItemId = responseChatItemIdRaw ? String(responseChatItemIdRaw) : undefined;
        const result = { messages };
        if (responseChatItemId) {
            result.responseChatItemId = responseChatItemId;
        }
        return result;
    }
}
exports.FastGPTSessionService = FastGPTSessionService;
//# sourceMappingURL=FastGPTSessionService.js.map