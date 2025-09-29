import { Request, Response, NextFunction } from 'express';
import { AgentConfigService } from '@/services/AgentConfigService';
import { ChatProxyService } from '@/services/ChatProxyService';
import { ChatInitService } from '@/services/ChatInitService';
import { FastGPTSessionService } from '@/services/FastGPTSessionService';
import {
  ChatMessage,
  ChatOptions,
  ApiError,
  StreamStatus,
  FastGPTChatHistoryDetail,
  FastGPTChatHistorySummary,
} from '@/types';
import { generateId } from '@/utils/helpers';
import Joi from 'joi';

/**
 * 聊天控制器
 */
export class ChatController {
  private agentService: AgentConfigService;
  private chatService: ChatProxyService;
  private initService: ChatInitService;
  private fastgptSessionService: FastGPTSessionService;

  constructor() {
    this.agentService = new AgentConfigService();
    this.chatService = new ChatProxyService(this.agentService);
    this.initService = new ChatInitService(this.agentService);
    this.fastgptSessionService = new FastGPTSessionService(this.agentService);
  }

  /**
   * 聊天初始化请求验证Schema
   */
  private chatInitSchema = Joi.object({
    appId: Joi.string().required().messages({
      'any.required': '应用ID不能为空',
      'string.empty': '应用ID不能为空',
    }),
    chatId: Joi.string().optional(),
    stream: Joi.boolean().optional().default(false),
  });

  /**
   * 聊天请求验证Schema
   */
  private chatRequestSchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': '智能体ID不能为空',
      'string.empty': '智能体ID不能为空',
    }),
    messages: Joi.array().items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant', 'system').required(),
        content: Joi.string().required().messages({
          'any.required': '消息内容不能为空',
          'string.empty': '消息内容不能为空',
        }),
        id: Joi.string().optional(),
        timestamp: Joi.date().optional(),
        metadata: Joi.object().optional(),
      })
    ).min(1).required().messages({
      'array.min': '至少需要一条消息',
      'any.required': '消息列表不能为空',
    }),
    stream: Joi.boolean().optional().default(false),
    // 兼容顶层直传（标准FastGPT格式）
    chatId: Joi.string().optional(),
    detail: Joi.boolean().optional(),
    temperature: Joi.number().min(0).max(2).optional(),
    maxTokens: Joi.number().min(1).max(32768).optional(),
    variables: Joi.object().optional(),
    responseChatItemId: Joi.string().optional(),
    retainDatasetCite: Joi.boolean().optional(),
    appId: Joi.string().optional(),
    // 兼容原有 options 格式
    options: Joi.object({
      chatId: Joi.string().optional(),
      detail: Joi.boolean().optional(),
      temperature: Joi.number().min(0).max(2).optional(),
      maxTokens: Joi.number().min(1).max(32768).optional(),
      // 允许旧用法把 variables 放到 options 里
      variables: Joi.object().optional(),
      responseChatItemId: Joi.string().optional(),
    }).optional(),
  });

  private historyListSchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': '智能体ID不能为空',
      'string.empty': '智能体ID不能为空',
    }),
    page: Joi.number().min(1).optional(),
    pageSize: Joi.number().min(1).max(200).optional(),
  });

  private historyDetailSchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': '智能体ID不能为空',
      'string.empty': '智能体ID不能为空',
    }),
  });

  private historyDeleteSchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': '智能体ID不能为空',
      'string.empty': '智能体ID不能为空',
    }),
  });

  private historyRetrySchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': '智能体ID不能为空',
      'string.empty': '智能体ID不能为空',
    }),
    dataId: Joi.string().required().messages({
      'any.required': '消息ID不能为空',
      'string.empty': '消息ID不能为空',
    }),
    stream: Joi.boolean().optional().default(false),
    detail: Joi.boolean().optional(),
  });
  /**
   * 点赞/点踩反馈请求验证Schema
   */
  private feedbackSchema = Joi.object({
    agentId: Joi.string().required().messages({
      'any.required': '智能体ID不能为空',
      'string.empty': '智能体ID不能为空',
    }),
    chatId: Joi.string().required().messages({
      'any.required': 'chatId不能为空',
      'string.empty': 'chatId不能为空',
    }),
    dataId: Joi.string().required().messages({
      'any.required': 'dataId不能为空',
      'string.empty': 'dataId不能为空',
    }),
    userGoodFeedback: Joi.string().optional(),
    userBadFeedback: Joi.string().optional(),
  });

  /**
   * 发送聊天请求
   * POST /api/chat/completions
   */
  chatCompletions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 验证请求数据
      const { error, value } = this.chatRequestSchema.validate(req.body);
      if (error) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: error?.details?.[0]?.message || (error as any)?.message || '请求参数校验失败',
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      const { agentId, messages, stream } = value as any;
      // 统一兼容：顶层与 options 的混用，归一化为 ChatOptions
      const normalizedOptions: ChatOptions = {
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

      // 检查智能体是否存在
      const agent = await this.agentService.getAgent(agentId);
      if (!agent) {
        const apiError: ApiError = {
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        };
        res.status(404).json(apiError);
        return;
      }

      if (!agent.isActive) {
        const apiError: ApiError = {
          code: 'AGENT_INACTIVE',
          message: `智能体未激活: ${agentId}`,
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      // 处理流式请求
      if (stream) {
        await this.handleStreamRequest(res, agentId, messages, normalizedOptions);
      } else {
        await this.handleNormalRequest(res, agentId, messages, normalizedOptions);
      }
    } catch (error) {
      console.error('聊天请求处理失败:', error);

      // 如果响应头已发送（流式响应中），不能再发送JSON响应
      if (res.headersSent) {
        return;
      }

      const apiError: ApiError = {
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

  /**
   * 处理普通（非流式）聊天请求
   */
  private async handleNormalRequest(
    res: Response,
    agentId: string,
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<void> {
    try {
      const response = await this.chatService.sendMessage(agentId, messages, options);

      res.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const apiError: ApiError = {
        code: 'CHAT_SERVICE_ERROR',
        message: error instanceof Error ? error.message : '聊天服务错误',
        timestamp: new Date().toISOString(),
      };

      res.status(500).json(apiError);
    }
  }

  /**
   * 处理流式聊天请求 - 修复 FastGPT 流式响应
   */
  private async handleStreamRequest(
    res: Response,
    agentId: string,
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<void> {
    try {
      // 标准 SSE 响应头
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // 兼容反向代理
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
      // 立即刷新头部，避免缓冲
      // @ts-ignore Node.js typings 可能无 flushHeaders 声明
      typeof (res as any).flushHeaders === 'function' && (res as any).flushHeaders();

      console.log('🚀 开始处理流式请求，智能体:', agentId);

      // 发送初始化事件
      this.sendSSEEvent(res, 'start', {
        id: generateId(),
        timestamp: new Date().toISOString(),
        agentId,
      });

      // 发送流式消息
      await this.chatService.sendStreamMessage(
        agentId,
        messages,
        // 内容回调 - 确保正确调用
        (chunk: string) => {
          console.log('📨 收到内容块:', chunk.substring(0, 50));
          this.sendSSEEvent(res, 'chunk', { content: chunk });
        },
        // 状态回调 - 确保正确调用
        (status: StreamStatus) => {
          console.log('📊 收到状态更新:', status);
          this.sendSSEEvent(res, 'status', status);

          // 如果是完成或错误状态，结束响应
          if (status.type === 'complete' || status.type === 'error') {
            console.log('✅ 流式响应完成');
            this.sendSSEEvent(res, 'end', {
              timestamp: new Date().toISOString(),
            });
            res.end();
          }
        },
        options,
        // 事件透传回调：关注 FastGPT 的 interactive 以及 chatId 事件
        (eventName: string, data: any) => {
          if (!eventName) return;

          if (eventName === 'interactive') {
            console.log('🧩 收到交互节点事件 interactive，payload 预览:',
              (() => { try { return JSON.stringify(data).slice(0, 300); } catch { return '[Unserializable payload]'; } })()
            );
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
        }
      );
    } catch (error) {
      console.error('❌ 流式聊天请求失败:', error);

      // 发送错误事件
      this.sendSSEEvent(res, 'error', {
        code: 'STREAM_ERROR',
        message: error instanceof Error ? error.message : '流式响应错误',
        timestamp: new Date().toISOString(),
      });

      res.end();
    }
  }

  /**
   * 发送SSE事件
   */
  private sendSSEEvent(res: Response, event: string, data: any): void {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('发送SSE事件失败:', error);
    }
  }

  /**
   * 聊天初始化接口
   * GET /api/chat/init?appId=xxx&chatId=xxx&stream=true
   */
  chatInit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 参数验证
      const { error, value } = this.chatInitSchema.validate(req.query);
      if (error) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: error?.details?.[0]?.message || (error as any)?.message || '请求参数校验失败',
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      const { appId, chatId, stream } = value;

      console.log(`🚀 处理聊天初始化请求: appId=${appId}, chatId=${chatId}, stream=${stream}`);

      // 检查智能体是否存在且激活
      const agent = await this.agentService.getAgent(appId);
      if (!agent) {
        const apiError: ApiError = {
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${appId}`,
          timestamp: new Date().toISOString(),
        };
        res.status(404).json(apiError);
        return;
      }

      if (!agent.isActive) {
        const apiError: ApiError = {
          code: 'AGENT_INACTIVE',
          message: `智能体未激活: ${appId}`,
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      // 根据stream参数决定处理方式
      if (stream) {
        await this.handleInitStreamRequest(res, appId, chatId);
      } else {
        await this.handleInitNormalRequest(res, appId, chatId);
      }

    } catch (error) {
      console.error('聊天初始化请求处理失败:', error);

      // 如果响应头已发送（流式响应中），不能再发送JSON响应
      if (res.headersSent) {
        return;
      }

      const apiError: ApiError = {
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

  /**
   * 处理普通（非流式）初始化请求
   */
  private async handleInitNormalRequest(
    res: Response,
    appId: string,
    chatId?: string
  ): Promise<void> {
    try {
      const initData = await this.initService.getInitData(appId, chatId);

      res.json({
        success: true,
        data: initData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const apiError: ApiError = {
        code: 'INIT_SERVICE_ERROR',
        message: error instanceof Error ? error.message : '初始化服务错误',
        timestamp: new Date().toISOString(),
      };

      res.status(500).json(apiError);
    }
  }

  /**
   * 处理流式初始化请求
   */
  private async handleInitStreamRequest(
    res: Response,
    appId: string,
    chatId?: string
  ): Promise<void> {
    try {
      // 设置SSE响应头
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      // 立即刷新头部
      // @ts-ignore
      typeof (res as any).flushHeaders === 'function' && (res as any).flushHeaders();

      console.log('🚀 开始处理流式初始化请求，应用:', appId);
      console.log('ℹ️ 初始化流仅包含 start/chunk/complete/end 事件，不包含 interactive 事件');

      // 发送初始化事件
      this.sendSSEEvent(res, 'start', {
        id: generateId(),
        timestamp: new Date().toISOString(),
        appId,
        type: 'init'
      });

      // 调用流式初始化服务
      await this.initService.getInitDataStream(
        appId,
        chatId,
        // 内容回调 - 流式输出开场白
        (chunk: string) => {
          // console.log('📨 收到开场白内容块:', chunk.substring(0, 20));
          this.sendSSEEvent(res, 'chunk', { content: chunk });
        },
        // 完成回调 - 返回完整初始化数据
        (initData) => {
          console.log('✅ 初始化数据获取完成');
          this.sendSSEEvent(res, 'complete', {
            data: initData,
            timestamp: new Date().toISOString()
          });
          this.sendSSEEvent(res, 'end', {
            timestamp: new Date().toISOString(),
          });
          res.end();
        },
        // 错误回调
        (error) => {
          console.error('❌ 初始化流式处理失败:', error);
          this.sendSSEEvent(res, 'error', {
            error: error.message,
            timestamp: new Date().toISOString(),
          });
          this.sendSSEEvent(res, 'end', {
            timestamp: new Date().toISOString(),
          });
          res.end();
        }
      );

    } catch (error) {
      console.error('❌ 流式初始化请求处理失败:', error);

      if (!res.headersSent) {
        const apiError: ApiError = {
          code: 'INIT_STREAM_ERROR',
          message: error instanceof Error ? error.message : '流式初始化错误',
          timestamp: new Date().toISOString(),
        };
        res.status(500).json(apiError);
      } else {
        this.sendSSEEvent(res, 'error', {
          error: error instanceof Error ? error.message : '流式初始化错误',
          timestamp: new Date().toISOString(),
        });
        res.end();
      }
    }
  }
  /**
   * 点赞/点踩反馈
   * POST: /api/chat/feedback
   */
  updateUserFeedback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { error, value } = this.feedbackSchema.validate(req.body);
      if (error) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: error?.details?.[0]?.message || (error as any)?.message || '请求参数校验失败',
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      const { agentId, chatId, dataId, userGoodFeedback, userBadFeedback } = value as any;

      await this.fastgptSessionService.updateUserFeedback(agentId, {
        chatId,
        dataId,
        userGoodFeedback,
        userBadFeedback,
      });

      res.json({ success: true, data: null, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error('提交点赞/点踩反馈失败:', err);
      const apiError: ApiError = {
        code: 'FEEDBACK_FAILED',
        message: err instanceof Error ? err.message : '反馈失败',
        timestamp: new Date().toISOString(),
      };
      let status = 500;
      const errCode = (err as any)?.code;
      const axiosStatus = (err as any)?.response?.status;
      if (errCode === 'NOT_FOUND') {
        status = 404;
        apiError.code = 'AGENT_NOT_FOUND';
      } else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
        status = 400;
        apiError.code = errCode;
      } else if (axiosStatus === 404) {
        status = 502;
        apiError.code = 'UPSTREAM_NOT_FOUND';
      } else if (axiosStatus === 401) {
        status = 401;
        apiError.code = 'UPSTREAM_UNAUTHORIZED';
      } else if (axiosStatus === 408) {
        status = 504;
        apiError.code = 'UPSTREAM_TIMEOUT';
      }
      res.status(status).json(apiError);
    }
  };


  /**
   * 获取会话历史列表
   * GET /api/chat/history?agentId=xxx
   */
  listChatHistories = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = this.historyListSchema.validate(req.query);
      if (error) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: error?.details?.[0]?.message || (error as any)?.message || '请求参数校验失败',
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      const { agentId, page, pageSize } = value as { agentId: string; page?: number; pageSize?: number };

      const agent = await this.agentService.getAgent(agentId);
      if (!agent) {
        const apiError: ApiError = {
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        };
        res.status(404).json(apiError);
        return;
      }

      if (agent.provider !== 'fastgpt') {
        const apiError: ApiError = {
          code: 'INVALID_PROVIDER',
          message: `智能体 ${agentId} 不支持远程会话历史查询`,
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      const pagination: { page?: number; pageSize?: number } = {};
      if (typeof page === 'number') {
        pagination.page = page;
      }
      if (typeof pageSize === 'number') {
        pagination.pageSize = pageSize;
      }
      const histories: FastGPTChatHistorySummary[] = await this.fastgptSessionService.listHistories(
        agentId,
        pagination
      );

      res.json({
        success: true,
        data: histories,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('获取聊天历史列表失败:', err);
      const apiError: ApiError = {
        code: 'GET_HISTORY_LIST_FAILED',
        message: err instanceof Error ? err.message : '获取聊天历史失败',
        timestamp: new Date().toISOString(),
      };

      // 错误语义映射
      let status = 500;
      const errCode = err?.code;
      const axiosStatus = err?.response?.status;
      if (errCode === 'NOT_FOUND') {
        status = 404;
        apiError.code = 'AGENT_NOT_FOUND';
      } else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
        status = 400;
        apiError.code = errCode;
      } else if (axiosStatus === 404) {
        status = 502;
        apiError.code = 'UPSTREAM_NOT_FOUND';
      } else if (axiosStatus === 401) {
        status = 401;
        apiError.code = 'UPSTREAM_UNAUTHORIZED';
      } else if (axiosStatus === 408) {
        status = 504;
        apiError.code = 'UPSTREAM_TIMEOUT';
      }

      res.status(status).json(apiError);
    }
  };

  /**
   * 获取指定会话历史详情
   * GET /api/chat/history/:chatId?agentId=xxx
   */
  getChatHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { chatId: pathChatId, sessionId } = req.params as { chatId?: string; sessionId?: string };
      const chatId = pathChatId || sessionId;

      if (!chatId) {
        const apiError: ApiError = {
          code: 'CHAT_ID_REQUIRED',
          message: 'chatId 不能为空',
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      const { error, value } = this.historyDetailSchema.validate(req.query);
      if (error) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: error?.details?.[0]?.message || (error as any)?.message || '请求参数校验失败',
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      const { agentId } = value as { agentId: string };

      const agent = await this.agentService.getAgent(agentId);
      if (!agent) {
        const apiError: ApiError = {
          code: 'AGENT_NOT_FOUND',
          message: `智能体不存在: ${agentId}`,
          timestamp: new Date().toISOString(),
        };
        res.status(404).json(apiError);
        return;
      }

      if (agent.provider !== 'fastgpt') {
        const apiError: ApiError = {
          code: 'INVALID_PROVIDER',
          message: `智能体 ${agentId} 不支持远程会话历史查询`,
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      const detail: FastGPTChatHistoryDetail = await this.fastgptSessionService.getHistoryDetail(agentId, chatId);

      res.json({
        success: true,
        data: detail,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('获取聊天历史失败:', err);
      const apiError: ApiError = {
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
      } else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
        status = 400;
        apiError.code = errCode;
      } else if (axiosStatus === 404) {
        status = 502;
        apiError.code = 'UPSTREAM_NOT_FOUND';
      } else if (axiosStatus === 401) {
        status = 401;
        apiError.code = 'UPSTREAM_UNAUTHORIZED';
      } else if (axiosStatus === 408) {
        status = 504;
        apiError.code = 'UPSTREAM_TIMEOUT';
      }
      res.status(status).json(apiError);
    }
  };

  /**
   * 删除指定会话历史
   * DELETE /api/chat/history/:chatId?agentId=xxx
   */
  deleteChatHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const chatIdParam = req.params.chatId;
      if (!chatIdParam) {
        const apiError: ApiError = {
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
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: error?.details?.[0]?.message || (error as any)?.message || '请求参数校验失败',
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      const { agentId } = value as { agentId: string };
      await this.fastgptSessionService.deleteHistory(agentId, chatId);

      res.json({ success: true, data: null, timestamp: new Date().toISOString() });
    } catch (err: any) {
      console.error('删除聊天历史失败:', err);
      const apiError: ApiError = {
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
      } else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
        status = 400;
        apiError.code = errCode;
      } else if (axiosStatus === 404) {
        status = 502;
        apiError.code = 'UPSTREAM_NOT_FOUND';
      } else if (axiosStatus === 401) {
        status = 401;
        apiError.code = 'UPSTREAM_UNAUTHORIZED';
      } else if (axiosStatus === 408) {
        status = 504;
        apiError.code = 'UPSTREAM_TIMEOUT';
      }
      res.status(status).json(apiError);
    }
  };

  /**
   * 清空指定智能体的历史
   * DELETE /api/chat/history?agentId=xxx
   */
  clearChatHistories = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = this.historyDeleteSchema.validate(req.query);
      if (error) {
        const apiError: ApiError = {
          code: 'VALIDATION_ERROR',
          message: error?.details?.[0]?.message || (error as any)?.message || '请求参数校验失败',
          timestamp: new Date().toISOString(),
        };
        res.status(400).json(apiError);
        return;
      }

      const { agentId } = value as { agentId: string };
      await this.fastgptSessionService.clearHistories(agentId);

      res.json({ success: true, data: null, timestamp: new Date().toISOString() });
    } catch (err: any) {
      console.error('清空聊天历史失败:', err);
      const apiError: ApiError = {
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
      } else if (errCode === 'INVALID_PROVIDER' || errCode === 'INVALID_APP_ID') {
        status = 400;
        apiError.code = errCode;
      } else if (axiosStatus === 404) {
        status = 502;
        apiError.code = 'UPSTREAM_NOT_FOUND';
      } else if (axiosStatus === 401) {
        status = 401;
        apiError.code = 'UPSTREAM_UNAUTHORIZED';
      } else if (axiosStatus === 408) {
        status = 504;
        apiError.code = 'UPSTREAM_TIMEOUT';
      }
      res.status(status).json(apiError);
    }
  };

  /**
   * 重新生成指定消息
   * POST /api/chat/history/:chatId/retry
   */
  retryChatMessage = async (req: Request, res: Response): Promise<void> => {
    const chatIdParam = req.params.chatId;
    if (!chatIdParam) {
      const apiError: ApiError = {
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
      const apiError: ApiError = {
        code: 'VALIDATION_ERROR',
        message: error?.details?.[0]?.message || (error as any)?.message || '请求参数校验失败',
        timestamp: new Date().toISOString(),
      };
      res.status(400).json(apiError);
      return;
    }

    const { agentId, dataId, stream, detail } = value as { agentId: string; dataId: string; stream?: boolean; detail?: boolean };

    try {
      const historyDetail = await this.fastgptSessionService.getHistoryDetail(agentId, chatId);
      const prepared = this.fastgptSessionService.prepareRetryPayload(historyDetail, dataId);

      if (!prepared || !prepared.messages || prepared.messages.length === 0) {
        const apiError: ApiError = {
          code: 'RETRY_TARGET_NOT_FOUND',
          message: '未找到可重新生成的用户消息',
          timestamp: new Date().toISOString(),
        };
        res.status(404).json(apiError);
        return;
      }

      const options: ChatOptions = {
        chatId,
        ...(typeof detail === 'boolean' ? { detail } : {}),
        ...(prepared.responseChatItemId ? { responseChatItemId: prepared.responseChatItemId } : {}),
      };

      if (stream) {
        await this.handleStreamRequest(res, agentId, prepared.messages, options);
        return;
      }

      await this.handleNormalRequest(res, agentId, prepared.messages, options);
    } catch (err) {
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

      const apiError: ApiError = {
        code: 'RETRY_FAILED',
        message: err instanceof Error ? err.message : '重新生成失败',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(apiError);
    }
  };
}
