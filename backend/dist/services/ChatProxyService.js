"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatProxyService = exports.AnthropicProvider = exports.OpenAIProvider = exports.FastGPTProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const helpers_1 = require("@/utils/helpers");
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
            return provider.transformResponse(response.data);
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
            try {
                const usedChatId = requestData?.chatId;
                if (usedChatId) {
                    onEvent?.('chatId', { chatId: usedChatId });
                }
            }
            catch (_) { }
            const response = await this.httpClient.post(config.endpoint, requestData, {
                headers,
                responseType: 'stream',
            });
            await this.handleStreamResponse(response.data, provider, config, onChunk, onStatus, onEvent);
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
    async handleStreamResponse(stream, provider, config, onChunk, onStatus, onEvent) {
        return new Promise((resolve, reject) => {
            let buffer = '';
            let currentEventType = '';
            console.log('开始处理流式响应，提供商:', config.provider);
            stream.on('data', (chunk) => {
                const chunkStr = chunk.toString();
                buffer += chunkStr;
                console.log('收到流式数据块:', chunkStr.substring(0, 200));
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.trim() === '') {
                        currentEventType = '';
                        continue;
                    }
                    try {
                        console.log('line----------------:', line);
                        if (line.startsWith('event: ')) {
                            currentEventType = line.slice(7).trim();
                            console.log('检测到事件类型:', currentEventType);
                            continue;
                        }
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            console.log('处理数据行:', { eventType: currentEventType, data: dataStr.substring(0, 100) });
                            if (dataStr === '[DONE]') {
                                console.log('流式响应完成');
                                onStatus?.({
                                    type: 'complete',
                                    status: 'completed',
                                });
                                resolve();
                                return;
                            }
                            const data = JSON.parse(dataStr);
                            if (config.provider === 'fastgpt' && config.features.streamingConfig.statusEvents) {
                                console.log('处理 FastGPT 事件:', { eventType: currentEventType, data });
                                switch (currentEventType) {
                                    case 'flowNodeStatus':
                                        const statusEvent = {
                                            type: 'flowNodeStatus',
                                            status: (data.status ?? 'running'),
                                            moduleName: data.name || data.moduleName || '未知模块',
                                        };
                                        console.log('发送流程节点状态:', statusEvent);
                                        onStatus?.(statusEvent);
                                        break;
                                    case 'answer':
                                        const answerContent = data.choices?.[0]?.delta?.content || data.content || '';
                                        if (answerContent) {
                                            console.log('发送答案内容:', answerContent.substring(0, 50));
                                            onChunk(answerContent);
                                        }
                                        break;
                                    case 'interactive':
                                        console.log('交互节点事件:', data);
                                        onEvent?.('interactive', data);
                                        break;
                                    case 'flowResponses':
                                        console.log('流程响应事件:', data);
                                        onStatus?.({
                                            type: 'progress',
                                            status: 'completed',
                                            moduleName: '执行完成',
                                        });
                                        break;
                                    default:
                                        const defaultContent = provider.transformStreamResponse(data);
                                        if (defaultContent) {
                                            console.log('默认内容处理:', defaultContent.substring(0, 50));
                                            onChunk(defaultContent);
                                        }
                                }
                            }
                            else {
                                const content = provider.transformStreamResponse(data);
                                if (content) {
                                    console.log('标准内容处理:', content.substring(0, 50));
                                    onChunk(content);
                                }
                            }
                        }
                    }
                    catch (parseError) {
                        console.warn('解析流式数据失败:', parseError, '原始行:', line);
                    }
                }
            });
            stream.on('end', () => {
                console.log('流式响应结束');
                onStatus?.({
                    type: 'complete',
                    status: 'completed',
                });
                resolve();
            });
            stream.on('error', (error) => {
                console.error('流式响应错误:', error);
                onStatus?.({
                    type: 'error',
                    status: 'error',
                    error: error.message,
                });
                reject(error);
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