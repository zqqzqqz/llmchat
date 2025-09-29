"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const axios_1 = __importDefault(require("axios"));
const AgentConfigService_1 = require("@/services/AgentConfigService");
const ChatProxyService_1 = require("@/services/ChatProxyService");
const ChatInitService_1 = require("@/services/ChatInitService");
const FastGPTSessionService_1 = require("@/services/FastGPTSessionService");
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
        this.historyListSchema = joi_1.default.object({
            agentId: joi_1.default.string().required().messages({
                'any.required': '智能体ID不能为空',
                'string.empty': '智能体ID不能为空',
            }),
            page: joi_1.default.number().min(1).optional(),
            pageSize: joi_1.default.number().min(1).max(200).optional(),
        });
        this.historyDetailSchema = joi_1.default.object({
            agentId: joi_1.default.string().required().messages({
                'any.required': '智能体ID不能为空',
                'string.empty': '智能体ID不能为空',
            }),
        });
        this.historyDeleteSchema = joi_1.default.object({
            agentId: joi_1.default.string().required().messages({
                'any.required': '智能体ID不能为空',
                'string.empty': '智能体ID不能为空',
            }),
        });
        this.historyRetrySchema = joi_1.default.object({
            agentId: joi_1.default.string().required().messages({
                'any.required': '智能体ID不能为空',
                'string.empty': '智能体ID不能为空',
            }),
            dataId: joi_1.default.string().required().messages({
                'any.required': '消息ID不能为空',
                'string.empty': '消息ID不能为空',
            }),
            stream: joi_1.default.boolean().optional().default(false),
            detail: joi_1.default.boolean().optional(),
        });
        this.feedbackSchema = joi_1.default.object({
            agentId: joi_1.default.string().required().messages({
                'any.required': '智能体ID不能为空',
                'string.empty': '智能体ID不能为空',
            }),
            chatId: joi_1.default.string().required().messages({
                'any.required': 'chatId不能为空',
                'string.empty': 'chatId不能为空',
            }),
            dataId: joi_1.default.string().required().messages({
                'any.required': 'dataId不能为空',
                'string.empty': 'dataId不能为空',
            }),
            userGoodFeedback: joi_1.default.string().optional(),
            userBadFeedback: joi_1.default.string().optional(),
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
        this.updateUserFeedback = async (req, res, next) => {
            try {
                const { error, value } = this.feedbackSchema.validate(req.body);
                if (error) {
                    const apiError = {
                        code: 'VALIDATION_ERROR',
                        message: error?.details?.[0]?.message || error?.message || '请求参数校验失败',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                const { agentId, chatId, dataId, userGoodFeedback, userBadFeedback } = value;
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
                const baseUrl = agent.endpoint.replace('/api/v1/chat/completions', '');
                const url = `${baseUrl}/api/core/chat/feedback/updateUserFeedback`;
                const payload = {
                    appId: agent.appId || agent.id,
                    chatId,
                    dataId,
                    ...(userGoodFeedback ? { userGoodFeedback } : {}),
                    ...(userBadFeedback ? { userBadFeedback } : {}),
                };
                const headers = {
                    Authorization: `Bearer ${agent.apiKey}`,
                    'Content-Type': 'application/json'
                };
                const resp = await axios_1.default.post(url, payload, { headers });
                if (resp.data?.code !== 200) {
                    throw new Error(resp.data?.message || '反馈失败');
                }
                res.json({ success: true, data: null, timestamp: new Date().toISOString() });
            }
            catch (err) {
                console.error('提交点赞/点踩反馈失败:', err);
                const apiError = {
                    code: 'FEEDBACK_FAILED',
                    message: err instanceof Error ? err.message : '反馈失败',
                    timestamp: new Date().toISOString(),
                };
                res.status(500).json(apiError);
            }
        };
        this.listChatHistories = async (req, res) => {
            try {
                const { error, value } = this.historyListSchema.validate(req.query);
                if (error) {
                    const apiError = {
                        code: 'VALIDATION_ERROR',
                        message: error?.details?.[0]?.message || error?.message || '请求参数校验失败',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                const { agentId, page, pageSize } = value;
                const pagination = {};
                if (typeof page === 'number') {
                    pagination.page = page;
                }
                if (typeof pageSize === 'number') {
                    pagination.pageSize = pageSize;
                }
                const histories = await this.fastgptSessionService.listHistories(agentId, pagination);
                res.json({
                    success: true,
                    data: histories,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (err) {
                console.error('获取聊天历史列表失败:', err);
                const apiError = {
                    code: 'GET_HISTORY_LIST_FAILED',
                    message: err instanceof Error ? err.message : '获取聊天历史失败',
                    timestamp: new Date().toISOString(),
                };
                let status = 500;
                const errCode = err?.code;
                const axiosStatus = err?.response?.status;
                if (errCode === 'NOT_FOUND') {
                    status = 404;
                    apiError.code = 'AGENT_NOT_FOUND';
                }
                else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
                    status = 400;
                    apiError.code = errCode;
                }
                else if (axiosStatus === 404) {
                    status = 502;
                    apiError.code = 'UPSTREAM_NOT_FOUND';
                }
                else if (axiosStatus === 401) {
                    status = 401;
                    apiError.code = 'UPSTREAM_UNAUTHORIZED';
                }
                else if (axiosStatus === 408) {
                    status = 504;
                    apiError.code = 'UPSTREAM_TIMEOUT';
                }
                res.status(status).json(apiError);
            }
        };
        this.getChatHistory = async (req, res) => {
            try {
                const { chatId: pathChatId, sessionId } = req.params;
                const chatId = pathChatId || sessionId;
                if (!chatId) {
                    const apiError = {
                        code: 'CHAT_ID_REQUIRED',
                        message: 'chatId 不能为空',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                const { error, value } = this.historyDetailSchema.validate(req.query);
                if (error) {
                    const apiError = {
                        code: 'VALIDATION_ERROR',
                        message: error?.details?.[0]?.message || error?.message || '请求参数校验失败',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                const { agentId } = value;
                const detail = await this.fastgptSessionService.getHistoryDetail(agentId, chatId);
                res.json({
                    success: true,
                    data: detail,
                    timestamp: new Date().toISOString(),
                });
            }
            catch (err) {
                console.error('获取聊天历史失败:', err);
                const apiError = {
                    code: 'GET_HISTORY_FAILED',
                    message: err instanceof Error ? err.message : '获取聊天历史失败',
                    timestamp: new Date().toISOString(),
                };
                let status = 500;
                const errCode = err?.code;
                const axiosStatus = err?.response?.status;
                if (errCode === 'NOT_FOUND') {
                    status = 404;
                    apiError.code = 'AGENT_NOT_FOUND';
                }
                else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
                    status = 400;
                    apiError.code = errCode;
                }
                else if (axiosStatus === 404) {
                    status = 502;
                    apiError.code = 'UPSTREAM_NOT_FOUND';
                }
                else if (axiosStatus === 401) {
                    status = 401;
                    apiError.code = 'UPSTREAM_UNAUTHORIZED';
                }
                else if (axiosStatus === 408) {
                    status = 504;
                    apiError.code = 'UPSTREAM_TIMEOUT';
                }
                res.status(status).json(apiError);
            }
        };
        this.deleteChatHistory = async (req, res) => {
            try {
                const chatIdParam = req.params.chatId;
                if (!chatIdParam) {
                    const apiError = {
                        code: 'VALIDATION_ERROR',
                        message: '缺少 chatId 参数',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                const chatId = chatIdParam;
                const { error, value } = this.historyDeleteSchema.validate(req.query);
                if (error) {
                    const apiError = {
                        code: 'VALIDATION_ERROR',
                        message: error?.details?.[0]?.message || error?.message || '请求参数校验失败',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                const { agentId } = value;
                await this.fastgptSessionService.deleteHistory(agentId, chatId);
                res.json({ success: true, data: null, timestamp: new Date().toISOString() });
            }
            catch (err) {
                console.error('删除聊天历史失败:', err);
                const apiError = {
                    code: 'DELETE_HISTORY_FAILED',
                    message: err instanceof Error ? err.message : '删除聊天历史失败',
                    timestamp: new Date().toISOString(),
                };
                let status = 500;
                const errCode = err?.code;
                const axiosStatus = err?.response?.status;
                if (errCode === 'NOT_FOUND') {
                    status = 404;
                    apiError.code = 'AGENT_NOT_FOUND';
                }
                else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
                    status = 400;
                    apiError.code = errCode;
                }
                else if (axiosStatus === 404) {
                    status = 502;
                    apiError.code = 'UPSTREAM_NOT_FOUND';
                }
                else if (axiosStatus === 401) {
                    status = 401;
                    apiError.code = 'UPSTREAM_UNAUTHORIZED';
                }
                else if (axiosStatus === 408) {
                    status = 504;
                    apiError.code = 'UPSTREAM_TIMEOUT';
                }
                res.status(status).json(apiError);
            }
        };
        this.clearChatHistories = async (req, res) => {
            try {
                const { error, value } = this.historyDeleteSchema.validate(req.query);
                if (error) {
                    const apiError = {
                        code: 'VALIDATION_ERROR',
                        message: error?.details?.[0]?.message || error?.message || '请求参数校验失败',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(400).json(apiError);
                    return;
                }
                const { agentId } = value;
                await this.fastgptSessionService.clearHistories(agentId);
                res.json({ success: true, data: null, timestamp: new Date().toISOString() });
            }
            catch (err) {
                console.error('清空聊天历史失败:', err);
                const apiError = {
                    code: 'CLEAR_HISTORY_FAILED',
                    message: err instanceof Error ? err.message : '清空聊天历史失败',
                    timestamp: new Date().toISOString(),
                };
                let status = 500;
                const errCode = err?.code;
                const axiosStatus = err?.response?.status;
                if (errCode === 'NOT_FOUND') {
                    status = 404;
                    apiError.code = 'AGENT_NOT_FOUND';
                }
                else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
                    status = 400;
                    apiError.code = errCode;
                }
                else if (axiosStatus === 404) {
                    status = 502;
                    apiError.code = 'UPSTREAM_NOT_FOUND';
                }
                else if (axiosStatus === 401) {
                    status = 401;
                    apiError.code = 'UPSTREAM_UNAUTHORIZED';
                }
                else if (axiosStatus === 408) {
                    status = 504;
                    apiError.code = 'UPSTREAM_TIMEOUT';
                }
                res.status(status).json(apiError);
            }
        };
        this.retryChatMessage = async (req, res) => {
            const chatIdParam = req.params.chatId;
            if (!chatIdParam) {
                const apiError = {
                    code: 'VALIDATION_ERROR',
                    message: '缺少 chatId 参数',
                    timestamp: new Date().toISOString(),
                };
                res.status(400).json(apiError);
                return;
            }
            const chatId = chatIdParam;
            const { error, value } = this.historyRetrySchema.validate(req.body);
            if (error) {
                const apiError = {
                    code: 'VALIDATION_ERROR',
                    message: error?.details?.[0]?.message || error?.message || '请求参数校验失败',
                    timestamp: new Date().toISOString(),
                };
                res.status(400).json(apiError);
                return;
            }
            const { agentId, dataId, stream, detail } = value;
            try {
                const historyDetail = await this.fastgptSessionService.getHistoryDetail(agentId, chatId);
                const prepared = this.fastgptSessionService.prepareRetryPayload(historyDetail, dataId);
                if (!prepared || !prepared.messages || prepared.messages.length === 0) {
                    const apiError = {
                        code: 'RETRY_TARGET_NOT_FOUND',
                        message: '未找到可重新生成的用户消息',
                        timestamp: new Date().toISOString(),
                    };
                    res.status(404).json(apiError);
                    return;
                }
                const options = {
                    chatId,
                    ...(typeof detail === 'boolean' ? { detail } : {}),
                    ...(prepared.responseChatItemId ? { responseChatItemId: prepared.responseChatItemId } : {}),
                };
                if (stream) {
                    await this.handleStreamRequest(res, agentId, prepared.messages, options);
                    return;
                }
                await this.handleNormalRequest(res, agentId, prepared.messages, options);
            }
            catch (err) {
                console.error('重新生成聊天消息失败:', err);
                if (stream && res.headersSent) {
                    this.sendSSEEvent(res, 'error', {
                        code: 'RETRY_FAILED',
                        message: err instanceof Error ? err.message : '重新生成失败',
                        timestamp: new Date().toISOString(),
                    });
                    res.end();
                    return;
                }
                const apiError = {
                    code: 'RETRY_FAILED',
                    message: err instanceof Error ? err.message : '重新生成失败',
                    timestamp: new Date().toISOString(),
                };
                res.status(500).json(apiError);
            }
        };
        this.agentService = new AgentConfigService_1.AgentConfigService();
        this.chatService = new ChatProxyService_1.ChatProxyService(this.agentService);
        this.initService = new ChatInitService_1.ChatInitService(this.agentService);
        this.fastgptSessionService = new FastGPTSessionService_1.FastGPTSessionService(this.agentService);
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
                if (!eventName)
                    return;
                if (eventName === 'interactive') {
                    console.log('🧩 收到交互节点事件 interactive，payload 预览:', (() => { try {
                        return JSON.stringify(data).slice(0, 300);
                    }
                    catch {
                        return '[Unserializable payload]';
                    } })());
                    this.sendSSEEvent(res, 'interactive', data);
                    return;
                }
                if (eventName === 'chatId') {
                    console.log('🆔 透传本次使用的 chatId:', (data && (data.chatId || data.id)) || data);
                    this.sendSSEEvent(res, 'chatId', data);
                    return;
                }
                console.log('📎 透传 FastGPT 事件:', eventName);
                this.sendSSEEvent(res, eventName, data);
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