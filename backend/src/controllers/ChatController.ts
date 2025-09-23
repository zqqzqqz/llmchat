import { Request, Response, NextFunction } from 'express';
import { AgentConfigService } from '@/services/AgentConfigService';
import { ChatProxyService } from '@/services/ChatProxyService';
import { ChatInitService } from '@/services/ChatInitService';
import { ChatMessage, ChatOptions, ApiError, StreamStatus } from '@/types';
import { generateId } from '@/utils/helpers';
import Joi from 'joi';

/**
 * 聊天控制器
 */
export class ChatController {
  private agentService: AgentConfigService;
  private chatService: ChatProxyService;
  private initService: ChatInitService;

  constructor() {
    this.agentService = new AgentConfigService();
    this.chatService = new ChatProxyService(this.agentService);
    this.initService = new ChatInitService(this.agentService);
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
    options: Joi.object({
      chatId: Joi.string().optional(),
      detail: Joi.boolean().optional(),
      temperature: Joi.number().min(0).max(2).optional(),
      maxTokens: Joi.number().min(1).max(32768).optional(),
    }).optional(),
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

      const { agentId, messages, stream, options } = value;

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
        await this.handleStreamRequest(res, agentId, messages, options);
      } else {
        await this.handleNormalRequest(res, agentId, messages, options);
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
        options
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
          message: error.details[0].message,
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
   * 获取聊天历史（如果有实现）
   * GET /api/chat/history/:sessionId
   */
  getChatHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;
      
      // TODO: 实现聊天历史获取逻辑
      res.json({
        success: true,
        data: {
          sessionId,
          messages: [],
          message: '聊天历史功能暂未实现',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const apiError: ApiError = {
        code: 'GET_HISTORY_FAILED',
        message: '获取聊天历史失败',
        timestamp: new Date().toISOString(),
      };
      
      res.status(500).json(apiError);
    }
  };
}