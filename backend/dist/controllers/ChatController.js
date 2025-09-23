"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const AgentConfigService_1 = require("@/services/AgentConfigService");
const ChatProxyService_1 = require("@/services/ChatProxyService");
const helpers_1 = require("@/utils/helpers");
const joi_1 = __importDefault(require("joi"));
class ChatController {
    constructor() {
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
            options: joi_1.default.object({
                chatId: joi_1.default.string().optional(),
                detail: joi_1.default.boolean().optional(),
                temperature: joi_1.default.number().min(0).max(2).optional(),
                maxTokens: joi_1.default.number().min(1).max(32768).optional(),
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
                const { agentId, messages, stream, options } = value;
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
                    await this.handleStreamRequest(res, agentId, messages, options);
                }
                else {
                    await this.handleNormalRequest(res, agentId, messages, options);
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
            }, options);
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
}
exports.ChatController = ChatController;
//# sourceMappingURL=ChatController.js.map