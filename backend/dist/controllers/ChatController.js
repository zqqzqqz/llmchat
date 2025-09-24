"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const AgentConfigService_1 = require("@/services/AgentConfigService");
const ChatProxyService_1 = require("@/services/ChatProxyService");
const ChatInitService_1 = require("@/services/ChatInitService");
const helpers_1 = require("@/utils/helpers");
const joi_1 = __importDefault(require("joi"));
class ChatController {
    constructor() {
        this.chatInitSchema = joi_1.default.object({
            appId: joi_1.default.string().required().messages({
                'any.required': '应用ID不能为空',
                'string.empty': '应用ID不能为空',
            }),
            chatId: joi_1.default.string().optional(),
            stream: joi_1.default.boolean().optional().default(false),
        });
        this.chatRequestSchema = joi_1.default.object({
            agentId: joi_1.default.string().required().messages({
                'any.required': '智能体ID不能为空',
                'string.empty': '智能体ID不能为空',
            }),
            messages: joi_1.default.array().items(joi_1.default.object({
                role: joi_1.default.string().valid('user', 'assistant', 'system').required(),
                content: joi_1.default.string().required().messages({
                    'any.required': '消息内容不能为空',
                    'string.empty': '消息内容不能为空',
                }),
                id: joi_1.default.string().optional(),
                timestamp: joi_1.default.date().optional(),
                metadata: joi_1.default.object().optional(),
            })).min(1).required().messages({
                'array.min': '至少需要一条消息',
                'any.required': '消息列表不能为空',
            }),
            stream: joi_1.default.boolean().optional().default(false),
            chatId: joi_1.default.string().optional(),
            detail: joi_1.default.boolean().optional(),
            temperature: joi_1.default.number().min(0).max(2).optional(),
            maxTokens: joi_1.default.number().min(1).max(32768).optional(),
            variables: joi_1.default.object().optional(),
            responseChatItemId: joi_1.default.string().optional(),
            retainDatasetCite: joi_1.default.boolean().optional(),
            appId: joi_1.default.string().optional(),
            options: joi_1.default.object({
                chatId: joi_1.default.string().optional(),
                detail: joi_1.default.boolean().optional(),
                temperature: joi_1.default.number().min(0).max(2).optional(),
                maxTokens: joi_1.default.number().min(1).max(32768).optional(),
                variables: joi_1.default.object().optional(),
                responseChatItemId: joi_1.default.string().optional(),
            }).optional(),
        });
        this.chatCompletions = async (req, res, next) => {
            try {
                const { error, value } = this.chatRequestSchema.validate(req.body);
                if (error) {
                    const apiError = {
                        code: 'VALIDATION_ERROR',
                        message: error?.details?.[0]?.message || error?.message || '请求参数校验失败',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                const { agentId, messages, stream } = value;
                const normalizedOptions = {
                    ...(value.options || {}),
                    ...(value.chatId ? { chatId: value.chatId } : {}),
                    ...(typeof value.detail === 'boolean' ? { detail: value.detail } : {}),
                    ...(typeof value.temperature === 'number' ? { temperature: value.temperature } : {}),
                    ...(typeof value.maxTokens === 'number' ? { maxTokens: value.maxTokens } : {}),
                    ...(value.variables ? { variables: value.variables } : {}),
                    ...(value.responseChatItemId ? { responseChatItemId: value.responseChatItemId } : {}),
                };
                console.log('🧪 [chatCompletions] 入参(归一化): ', {
                    agentId,
                    stream,
                    options: normalizedOptions,
                    messagesCount: Array.isArray(messages) ? messages.length : 0,
                });
                const agent = await this.agentService.getAgent(agentId);
                if (!agent) {
                    const apiError = {
                        code: 'AGENT_NOT_FOUND',
                        message: `智能体不存在: ${agentId}`,
                        timestamp: new Date().toISOString(),
                    };
                    res.status(404).json(apiError);
                    return;
                }
                if (!agent.isActive) {
                    const apiError = {
                        code: 'AGENT_INACTIVE',
                        message: `智能体未激活: ${agentId}`,
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                if (stream) {
                    await this.handleStreamRequest(res, agentId, messages, normalizedOptions);
                }
                else {
                    await this.handleNormalRequest(res, agentId, messages, normalizedOptions);
                }
            }
            catch (error) {
                console.error('聊天请求处理失败:', error);
                if (res.headersSent) {
                    return;
                }
                const apiError = {
                    code: 'CHAT_REQUEST_FAILED',
                    message: '聊天请求处理失败',
                    timestamp: new Date().toISOString(),
                };
                if (process.env.NODE_ENV === 'development') {
                    apiError.details = { error: error instanceof Error ? error.message : error };
                }
                res.status(500).json(apiError);
            }
        };
        this.chatInit = async (req, res, next) => {
            try {
                const { error, value } = this.chatInitSchema.validate(req.query);
                if (error) {
                    const apiError = {
                        code: 'VALIDATION_ERROR',
                        message: error?.details?.[0]?.message || error?.message || '请求参数校验失败',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                const { appId, chatId, stream } = value;
                console.log(`🚀 处理聊天初始化请求: appId=${appId}, chatId=${chatId}, stream=${stream}`);
                const agent = await this.agentService.getAgent(appId);
                if (!agent) {
                    const apiError = {
                        code: 'AGENT_NOT_FOUND',
                        message: `智能体不存在: ${appId}`,
                        timestamp: new Date().toISOString(),
                    };
                    res.status(404).json(apiError);
                    return;
                }
                if (!agent.isActive) {
                    const apiError = {
                        code: 'AGENT_INACTIVE',
                        message: `智能体未激活: ${appId}`,
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                if (stream) {
                    await this.handleInitStreamRequest(res, appId, chatId);
                }
                else {
                    await this.handleInitNormalRequest(res, appId, chatId);
                }
            }
            catch (error) {
                console.error('聊天初始化请求处理失败:', error);
                if (res.headersSent) {
                    return;
                }
                const apiError = {
                    code: 'CHAT_INIT_FAILED',
                    message: '聊天初始化失败',
                    timestamp: new Date().toISOString(),
                };
                if (process.env.NODE_ENV === 'development') {
                    apiError.details = { error: error instanceof Error ? error.message : error };
                }
                res.status(500).json(apiError);
            }
        };
        this.getChatHistory = async (req, res, next) => {
            try {
                const { sessionId } = req.params;
                res.json({
                    success: true,
                    data: {
                        sessionId,
                        messages: [],
                        message: '聊天历史功能暂未实现',
                    },
                    timestamp: new Date().toISOString(),
                });
            }
            catch (error) {
                const apiError = {
                    code: 'GET_HISTORY_FAILED',
                    message: '获取聊天历史失败',
                    timestamp: new Date().toISOString(),
                };
                res.status(500).json(apiError);
            }
        };
        this.agentService = new AgentConfigService_1.AgentConfigService();
        this.chatService = new ChatProxyService_1.ChatProxyService(this.agentService);
        this.initService = new ChatInitService_1.ChatInitService(this.agentService);
    }
    async handleNormalRequest(res, agentId, messages, options) {
        try {
            const response = await this.chatService.sendMessage(agentId, messages, options);
            res.json({
                success: true,
                data: response,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            const apiError = {
                code: 'CHAT_SERVICE_ERROR',
                message: error instanceof Error ? error.message : '聊天服务错误',
                timestamp: new Date().toISOString(),
            };
            res.status(500).json(apiError);
        }
    }
    async handleStreamRequest(res, agentId, messages, options) {
        try {
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
            typeof res.flushHeaders === 'function' && res.flushHeaders();
            console.log('🚀 开始处理流式请求，智能体:', agentId);
            this.sendSSEEvent(res, 'start', {
                id: (0, helpers_1.generateId)(),
                timestamp: new Date().toISOString(),
                agentId,
            });
            await this.chatService.sendStreamMessage(agentId, messages, (chunk) => {
                console.log('📨 收到内容块:', chunk.substring(0, 50));
                this.sendSSEEvent(res, 'chunk', { content: chunk });
            }, (status) => {
                console.log('📊 收到状态更新:', status);
                this.sendSSEEvent(res, 'status', status);
                if (status.type === 'complete' || status.type === 'error') {
                    console.log('✅ 流式响应完成');
                    this.sendSSEEvent(res, 'end', {
                        timestamp: new Date().toISOString(),
                    });
                    res.end();
                }
            }, options, (eventName, data) => {
                if (eventName === 'interactive') {
                    console.log('🧩 收到交互节点事件 interactive，payload 预览:', (() => { try {
                        return JSON.stringify(data).slice(0, 300);
                    }
                    catch {
                        return '[Unserializable payload]';
                    } })());
                    this.sendSSEEvent(res, 'interactive', data);
                }
                else if (eventName === 'chatId') {
                    console.log('🆔 透传本次使用的 chatId:', (data && (data.chatId || data.id)) || data);
                    this.sendSSEEvent(res, 'chatId', data);
                }
                else {
                    console.log('📎 收到未分类透传事件:', eventName);
                }
            });
        }
        catch (error) {
            console.error('❌ 流式聊天请求失败:', error);
            this.sendSSEEvent(res, 'error', {
                code: 'STREAM_ERROR',
                message: error instanceof Error ? error.message : '流式响应错误',
                timestamp: new Date().toISOString(),
            });
            res.end();
        }
    }
    sendSSEEvent(res, event, data) {
        try {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
        catch (error) {
            console.error('发送SSE事件失败:', error);
        }
    }
    async handleInitNormalRequest(res, appId, chatId) {
        try {
            const initData = await this.initService.getInitData(appId, chatId);
            res.json({
                success: true,
                data: initData,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            const apiError = {
                code: 'INIT_SERVICE_ERROR',
                message: error instanceof Error ? error.message : '初始化服务错误',
                timestamp: new Date().toISOString(),
            };
            res.status(500).json(apiError);
        }
    }
    async handleInitStreamRequest(res, appId, chatId) {
        try {
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
            typeof res.flushHeaders === 'function' && res.flushHeaders();
            console.log('🚀 开始处理流式初始化请求，应用:', appId);
            console.log('ℹ️ 初始化流仅包含 start/chunk/complete/end 事件，不包含 interactive 事件');
            this.sendSSEEvent(res, 'start', {
                id: (0, helpers_1.generateId)(),
                timestamp: new Date().toISOString(),
                appId,
                type: 'init'
            });
            await this.initService.getInitDataStream(appId, chatId, (chunk) => {
                this.sendSSEEvent(res, 'chunk', { content: chunk });
            }, (initData) => {
                console.log('✅ 初始化数据获取完成');
                this.sendSSEEvent(res, 'complete', {
                    data: initData,
                    timestamp: new Date().toISOString()
                });
                this.sendSSEEvent(res, 'end', {
                    timestamp: new Date().toISOString(),
                });
                res.end();
            }, (error) => {
                console.error('❌ 初始化流式处理失败:', error);
                this.sendSSEEvent(res, 'error', {
                    error: error.message,
                    timestamp: new Date().toISOString(),
                });
                this.sendSSEEvent(res, 'end', {
                    timestamp: new Date().toISOString(),
                });
                res.end();
            });
        }
        catch (error) {
            console.error('❌ 流式初始化请求处理失败:', error);
            if (!res.headersSent) {
                const apiError = {
                    code: 'INIT_STREAM_ERROR',
                    message: error instanceof Error ? error.message : '流式初始化错误',
                    timestamp: new Date().toISOString(),
                };
                res.status(500).json(apiError);
            }
            else {
                this.sendSSEEvent(res, 'error', {
                    error: error instanceof Error ? error.message : '流式初始化错误',
                    timestamp: new Date().toISOString(),
                });
                res.end();
            }
        }
    }
}
exports.ChatController = ChatController;
//# sourceMappingURL=ChatController.js.map