"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatProxyService = exports.AnthropicProvider = exports.OpenAIProvider = exports.FastGPTProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const helpers_1 = require("@/utils/helpers");
const ChatLogService_1 = require("./ChatLogService");
const fastgptEvents_1 = require("@/utils/fastgptEvents");
class FastGPTProvider {
    constructor() {
        this.name = 'FastGPT';
    }
    transformRequest(messages, config, stream = false, options) {
        const detail = options?.detail ?? config.features?.supportsDetail ?? false;
        const request = {
            chatId: options?.chatId || `chat_${Date.now()}`,
            stream: stream && config.features.streamingConfig.enabled,
            detail,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
        };
        if (options?.variables) {
            request.variables = options.variables;
        }
        if (options?.responseChatItemId) {
            request.responseChatItemId = options.responseChatItemId;
        }
        if (config.systemPrompt) {
            request.messages.unshift({
                role: 'system',
                content: config.systemPrompt,
            });
        }
        console.log('FastGPT 请求数据:', JSON.stringify(request, null, 2));
        return request;
    }
    transformResponse(response) {
        return {
            id: response.id || (0, helpers_1.generateId)(),
            object: response.object || 'chat.completion',
            created: response.created || (0, helpers_1.generateTimestamp)(),
            model: response.model || 'fastgpt',
            choices: response.choices || [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: response.choices?.[0]?.message?.content || '',
                    },
                    finish_reason: response.choices?.[0]?.finish_reason || 'stop',
                }],
            usage: response.usage,
        };
    }
    transformStreamResponse(chunk) {
        if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
            return chunk.choices[0].delta.content || '';
        }
        return '';
    }
    validateConfig(config) {
        return (config.provider === 'fastgpt' &&
            config.apiKey.startsWith('fastgpt-') &&
            config.endpoint.includes('/chat/completions'));
    }
    buildHeaders(config) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        };
    }
}
exports.FastGPTProvider = FastGPTProvider;
class OpenAIProvider {
    constructor() {
        this.name = 'OpenAI';
    }
    transformRequest(messages, config, stream = false, options) {
        return {
            model: config.model,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            stream: stream && config.features.streamingConfig.enabled,
            max_tokens: options?.maxTokens || config.maxTokens,
            temperature: options?.temperature || config.temperature || 0.7,
        };
    }
    transformResponse(response) {
        return {
            id: response.id || (0, helpers_1.generateId)(),
            object: response.object || 'chat.completion',
            created: response.created || (0, helpers_1.generateTimestamp)(),
            model: response.model,
            choices: response.choices.map((choice) => ({
                index: choice.index,
                message: {
                    role: choice.message.role,
                    content: choice.message.content,
                },
                finish_reason: choice.finish_reason,
            })),
            usage: response.usage,
        };
    }
    transformStreamResponse(chunk) {
        if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
            return chunk.choices[0].delta.content || '';
        }
        return '';
    }
    validateConfig(config) {
        return (config.provider === 'openai' &&
            config.apiKey.startsWith('sk-') &&
            config.endpoint.includes('openai.com'));
    }
    buildHeaders(config) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        };
    }
}
exports.OpenAIProvider = OpenAIProvider;
class AnthropicProvider {
    constructor() {
        this.name = 'Anthropic';
    }
    transformRequest(messages, config, stream = false, options) {
        return {
            model: config.model,
            max_tokens: options?.maxTokens || config.maxTokens || 4096,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            stream: stream && config.features.streamingConfig.enabled,
            temperature: options?.temperature || config.temperature || 0.7,
        };
    }
    transformResponse(response) {
        return {
            id: response.id || (0, helpers_1.generateId)(),
            object: 'chat.completion',
            created: (0, helpers_1.generateTimestamp)(),
            model: response.model,
            choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: response.content[0].text,
                    },
                    finish_reason: response.stop_reason || 'stop',
                }],
            usage: {
                prompt_tokens: response.usage?.input_tokens || 0,
                completion_tokens: response.usage?.output_tokens || 0,
                total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
            },
        };
    }
    transformStreamResponse(chunk) {
        if (chunk.type === 'content_block_delta') {
            return chunk.delta.text || '';
        }
        return '';
    }
    validateConfig(config) {
        return (config.endpoint.includes('anthropic.com') &&
            config.apiKey.startsWith('sk-ant-') &&
            config.provider === 'anthropic');
    }
    buildHeaders(config) {
        return {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
        };
    }
}
exports.AnthropicProvider = AnthropicProvider;
class ChatProxyService {
    constructor(agentService) {
        this.providers = new Map();
        this.chatLog = new ChatLogService_1.ChatLogService();
        this.agentService = agentService;
        this.httpClient = axios_1.default.create({
            timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
        });
        this.registerProvider(new FastGPTProvider());
        this.registerProvider(new OpenAIProvider());
        this.registerProvider(new AnthropicProvider());
    }
    registerProvider(provider) {
        this.providers.set(provider.name.toLowerCase(), provider);
    }
    async sendMessage(agentId, messages, options) {
        const config = await this.agentService.getAgent(agentId);
        if (!config) {
            throw new Error(`智能体不存在: ${agentId}`);
        }
        if (!config.isActive) {
            throw new Error(`智能体未激活: ${agentId}`);
        }
        const provider = this.getProvider(config.provider);
        if (!provider) {
            throw new Error(`不支持的提供商: ${config.provider}`);
        }
        try {
            const requestData = provider.transformRequest(messages, config, false, options);
            const headers = provider.buildHeaders(config);
            const response = await this.httpClient.post(config.endpoint, requestData, { headers });
            const normalized = provider.transformResponse(response.data);
            try {
                this.chatLog.logCompletion({
                    agentId,
                    provider: config.provider,
                    endpoint: config.endpoint,
                    requestMeta: {
                        messagesCount: Array.isArray(messages) ? messages.length : 0,
                        chatId: requestData?.chatId,
                    },
                    rawResponse: response.data,
                    normalizedResponse: normalized,
                });
            }
            catch { }
            return normalized;
        }
        catch (error) {
            console.error(`智能体 ${agentId} 请求失败:`, error);
            throw new Error(`智能体请求失败: ${(0, helpers_1.getErrorMessage)(error)}`);
        }
    }
    async sendStreamMessage(agentId, messages, onChunk, onStatus, options, onEvent) {
        const config = await this.agentService.getAgent(agentId);
        if (!config) {
            throw new Error(`智能体不存在: ${agentId}`);
        }
        if (!config.isActive) {
            throw new Error(`智能体未激活: ${agentId}`);
        }
        if (!config.features.streamingConfig.enabled) {
            throw new Error(`智能体不支持流式响应: ${agentId}`);
        }
        const provider = this.getProvider(config.provider);
        if (!provider) {
            throw new Error(`不支持的提供商: ${config.provider}`);
        }
        try {
            const requestData = provider.transformRequest(messages, config, true, options);
            const headers = provider.buildHeaders(config);
            let usedChatId;
            try {
                usedChatId = requestData?.chatId;
                if (usedChatId) {
                    try {
                        this.chatLog.logStreamEvent({
                            agentId,
                            chatId: usedChatId,
                            provider: config.provider,
                            endpoint: config.endpoint,
                            eventType: 'chatId',
                            data: { chatId: usedChatId },
                        });
                    }
                    catch { }
                    onEvent?.('chatId', { chatId: usedChatId });
                }
            }
            catch (_) { }
            const response = await this.httpClient.post(config.endpoint, requestData, {
                headers,
                responseType: 'stream',
            });
            await this.handleStreamResponse(response.data, provider, config, onChunk, onStatus, onEvent, { agentId, endpoint: config.endpoint, provider: config.provider, ...(usedChatId ? { chatId: usedChatId } : {}) });
        }
        catch (error) {
            console.error(`智能体 ${agentId} 流式请求失败:`, error);
            onStatus?.({
                type: 'error',
                status: 'error',
                error: (0, helpers_1.getErrorMessage)(error),
            });
            throw new Error(`智能体流式请求失败: ${(0, helpers_1.getErrorMessage)(error)}`);
        }
    }
    findNextEventBoundary(buffer) {
        const lfIndex = buffer.indexOf('\n\n');
        const crlfIndex = buffer.indexOf('\r\n\r\n');
        if (lfIndex === -1 && crlfIndex === -1) {
            return null;
        }
        if (lfIndex === -1) {
            return { index: crlfIndex, length: 4 };
        }
        if (crlfIndex === -1) {
            return { index: lfIndex, length: 2 };
        }
        return crlfIndex < lfIndex
            ? { index: crlfIndex, length: 4 }
            : { index: lfIndex, length: 2 };
    }
    parseSSEEventBlock(rawBlock) {
        const lines = rawBlock.split(/\r?\n/);
        let event = '';
        const dataLines = [];
        let id;
        let retry;
        for (const line of lines) {
            if (!line || line.startsWith(':')) {
                continue;
            }
            const separatorIndex = line.indexOf(':');
            const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
            let value = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1);
            if (value.startsWith(' ')) {
                value = value.slice(1);
            }
            switch (field) {
                case 'event':
                    event = value.trim();
                    break;
                case 'data':
                    dataLines.push(value);
                    break;
                case 'id':
                    id = value.trim();
                    break;
                case 'retry': {
                    const parsedRetry = parseInt(value, 10);
                    if (!Number.isNaN(parsedRetry)) {
                        retry = parsedRetry;
                    }
                    break;
                }
                default:
                    break;
            }
        }
        const data = dataLines.join('\n');
        if (!event && !data) {
            return null;
        }
        const result = { event, data };
        if (typeof id === 'string') {
            result.id = id;
        }
        if (typeof retry === 'number') {
            result.retry = retry;
        }
        return result;
    }
    logStreamEvent(ctx, eventType, data) {
        try {
            this.chatLog.logStreamEvent({
                agentId: ctx?.agentId || 'unknown',
                ...(ctx?.provider ? { provider: ctx.provider } : {}),
                ...(ctx?.endpoint ? { endpoint: ctx.endpoint } : {}),
                ...(ctx?.chatId ? { chatId: ctx.chatId } : {}),
                eventType,
                data,
            });
        }
        catch { }
    }
    extractReasoningPayload(data) {
        return (data?.choices?.[0]?.delta?.reasoning_content ||
            data?.delta?.reasoning_content ||
            data?.reasoning_content ||
            data?.reasoning ||
            null);
    }
    dispatchFastGPTEvent(provider, eventName, payload, onChunk, onStatus, onEvent, ctx) {
        const resolvedEvent = (eventName || (typeof payload?.event === 'string' ? payload.event : '') || '').trim();
        const eventKey = (0, fastgptEvents_1.getNormalizedEventKey)(resolvedEvent || 'message');
        const emitEvent = (name, data) => {
            if (!onEvent)
                return;
            try {
                onEvent(name, data);
            }
            catch (emitError) {
                console.warn('事件回调执行失败:', emitError);
            }
        };
        if ((0, fastgptEvents_1.isChatIdEvent)(resolvedEvent)) {
            this.logStreamEvent(ctx, 'chatId', payload);
            emitEvent('chatId', payload);
            return;
        }
        if ((0, fastgptEvents_1.isInteractiveEvent)(resolvedEvent)) {
            this.logStreamEvent(ctx, 'interactive', payload);
            emitEvent('interactive', payload);
            return;
        }
        if (eventKey === (0, fastgptEvents_1.getNormalizedEventKey)('flowResponses')) {
            this.logStreamEvent(ctx, 'flowResponses', payload);
            onStatus?.({ type: 'progress', status: 'completed', moduleName: '执行完成' });
            emitEvent(resolvedEvent || 'flowResponses', payload);
            return;
        }
        if ((0, fastgptEvents_1.isStatusEvent)(resolvedEvent)) {
            const statusEvent = {
                type: 'flowNodeStatus',
                status: (payload?.status ?? 'running'),
                moduleName: payload?.name || payload?.moduleName || payload?.id || '未知模块',
            };
            this.logStreamEvent(ctx, 'flowNodeStatus', payload);
            onStatus?.(statusEvent);
            emitEvent(resolvedEvent || 'flowNodeStatus', payload);
            return;
        }
        if (eventKey === (0, fastgptEvents_1.getNormalizedEventKey)('answer')) {
            const answerContent = payload?.choices?.[0]?.delta?.content ?? payload?.content ?? '';
            if (answerContent) {
                this.logStreamEvent(ctx, 'answer', payload);
                onChunk(answerContent);
            }
            const reasoningContent = this.extractReasoningPayload(payload);
            if (reasoningContent) {
                this.logStreamEvent(ctx, 'reasoning', reasoningContent);
                emitEvent('reasoning', { event: resolvedEvent || 'reasoning', data: reasoningContent });
            }
            return;
        }
        if ((0, fastgptEvents_1.isReasoningEvent)(resolvedEvent)) {
            this.logStreamEvent(ctx, 'reasoning', payload);
            emitEvent('reasoning', { event: resolvedEvent || 'reasoning', data: payload });
            return;
        }
        if ((0, fastgptEvents_1.isDatasetEvent)(resolvedEvent) || (0, fastgptEvents_1.isSummaryEvent)(resolvedEvent) || (0, fastgptEvents_1.isToolEvent)(resolvedEvent)) {
            this.logStreamEvent(ctx, resolvedEvent || 'event', payload);
            emitEvent(resolvedEvent || 'event', payload);
            return;
        }
        if ((0, fastgptEvents_1.isUsageEvent)(resolvedEvent)) {
            this.logStreamEvent(ctx, 'usage', payload);
            emitEvent('usage', payload);
            return;
        }
        if ((0, fastgptEvents_1.isEndEvent)(resolvedEvent)) {
            this.logStreamEvent(ctx, resolvedEvent || 'end', payload);
            onStatus?.({ type: 'complete', status: 'completed' });
            emitEvent(resolvedEvent || 'end', payload);
            return;
        }
        if (eventKey !== (0, fastgptEvents_1.getNormalizedEventKey)('answer')) {
            const transformed = provider.transformStreamResponse(payload);
            if (transformed) {
                this.logStreamEvent(ctx, 'chunk', transformed);
                onChunk(transformed);
            }
        }
        if (resolvedEvent && !(0, fastgptEvents_1.isChunkLikeEvent)(resolvedEvent)) {
            emitEvent(resolvedEvent, payload);
        }
    }
    async handleStreamResponse(stream, provider, config, onChunk, onStatus, onEvent, ctx) {
        return new Promise((resolve, reject) => {
            let buffer = '';
            let completed = false;
            console.log('开始处理流式响应，提供商:', config.provider);
            const flushEventBlock = (rawBlock) => {
                const parsed = this.parseSSEEventBlock(rawBlock.replace(/\r/g, ''));
                if (!parsed) {
                    return;
                }
                const rawData = parsed.data;
                if (!rawData) {
                    return;
                }
                if (rawData.trim() === '[DONE]') {
                    if (completed) {
                        return;
                    }
                    completed = true;
                    console.log('流式响应完成 [DONE]');
                    this.logStreamEvent(ctx, 'complete', { done: true });
                    onStatus?.({ type: 'complete', status: 'completed' });
                    resolve();
                    return;
                }
                let payload = rawData;
                if (typeof rawData === 'string') {
                    const trimmed = rawData.trim();
                    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                        try {
                            payload = JSON.parse(rawData);
                        }
                        catch (parseError) {
                            console.warn('解析 SSE 数据失败:', parseError, '原始数据:', rawData);
                            payload = rawData;
                        }
                    }
                }
                this.dispatchFastGPTEvent(provider, parsed.event, payload, onChunk, onStatus, onEvent, ctx);
            };
            stream.on('data', (chunk) => {
                buffer += chunk.toString();
                let boundary;
                while ((boundary = this.findNextEventBoundary(buffer)) !== null) {
                    const rawBlock = buffer.slice(0, boundary.index);
                    buffer = buffer.slice(boundary.index + boundary.length);
                    if (rawBlock.trim().length === 0) {
                        continue;
                    }
                    flushEventBlock(rawBlock);
                }
            });
            stream.on('end', () => {
                if (buffer.trim().length > 0) {
                    flushEventBlock(buffer);
                    buffer = '';
                }
                if (!completed) {
                    completed = true;
                    console.log('流式响应结束');
                    this.logStreamEvent(ctx, 'complete', { ended: true });
                    onStatus?.({ type: 'complete', status: 'completed' });
                    resolve();
                }
            });
            stream.on('error', (error) => {
                console.error('流式响应错误:', error);
                this.logStreamEvent(ctx, 'error', { message: error.message });
                onStatus?.({ type: 'error', status: 'error', error: error.message });
                if (!completed) {
                    completed = true;
                    reject(error);
                }
            });
        });
    }
    getProvider(providerName) {
        return this.providers.get(providerName.toLowerCase());
    }
    async validateAgentConfig(agentId) {
        const config = await this.agentService.getAgent(agentId);
        if (!config)
            return false;
        const provider = this.getProvider(config.provider);
        if (!provider)
            return false;
        return provider.validateConfig(config);
    }
}
exports.ChatProxyService = ChatProxyService;
//# sourceMappingURL=ChatProxyService.js.map