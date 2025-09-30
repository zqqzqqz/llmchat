import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import Joi from 'joi';

import { AgentConfigService } from '@/services/AgentConfigService';
import { ChatProxyService } from '@/services/ChatProxyService';
import { ChatInitService } from '@/services/ChatInitService';
import { ChatHistoryService } from '@/services/ChatHistoryService';
import { analyticsService } from '@/services/analyticsInstance';
import {
  ChatMessage,
  ChatOptions,
  ApiError,
  StreamStatus,
  ChatAttachmentMetadata,
  VoiceNoteMetadata,
} from '@/types';
import { generateId, formatFileSize } from '@/utils/helpers';

/**
 * 聊天控制器
 */
export class ChatController {
  private agentService: AgentConfigService;
  private chatService: ChatProxyService;
  private initService: ChatInitService;
  private historyService: ChatHistoryService;
  private uploadDir: string;

  constructor() {
    this.agentService = new AgentConfigService();
    this.chatService = new ChatProxyService(this.agentService);
    this.initService = new ChatInitService(this.agentService);
    this.historyService = new ChatHistoryService();
    this.uploadDir = path.resolve(__dirname, '../../uploads');
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
        timestamp: Joi.number().optional(),
        attachments: Joi.array().items(
          Joi.object({
            id: Joi.string().optional(),
            url: Joi.string().uri().optional(),
            name: Joi.string().required(),
            mimeType: Joi.string().required(),
            size: Joi.number().min(0).required(),
            source: Joi.string().valid('upload', 'voice', 'external').optional(),
          })
        ).optional(),
        voiceNote: Joi.object({
          id: Joi.string().optional(),
          url: Joi.string().uri().optional(),
          duration: Joi.number().min(0).required(),
          mimeType: Joi.string().required(),
          size: Joi.number().min(0).optional(),
        }).optional(),
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
    attachments: Joi.array().items(
      Joi.object({
        id: Joi.string().optional(),
        url: Joi.string().uri().optional(),
        name: Joi.string().required(),
        mimeType: Joi.string().required(),
        size: Joi.number().min(0).required(),
        source: Joi.string().valid('upload', 'voice', 'external').optional(),
      })
    ).optional(),
    voiceNote: Joi.object({
      id: Joi.string().optional(),
      url: Joi.string().uri().optional(),
      duration: Joi.number().min(0).required(),
      mimeType: Joi.string().required(),
      size: Joi.number().min(0).optional(),
    }).optional(),
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
  private attachmentUploadSchema = Joi.object({
    filename: Joi.string().max(256).required(),
    mimeType: Joi.string().max(128).required(),
    size: Joi.number().min(1).max(20 * 1024 * 1024).required(),
    data: Joi.string().required(),
    source: Joi.string().valid('upload', 'voice', 'external').optional(),
  });

  private decorateMessages(
    messages: ChatMessage[],
    attachments?: ChatAttachmentMetadata[] | null,
    voiceNote?: VoiceNoteMetadata | null
  ): ChatMessage[] {
    const list = (messages || []).map((msg) => ({
      ...msg,
      metadata: msg.metadata ? { ...msg.metadata } : undefined,
      attachments: msg.attachments ? [...msg.attachments] : undefined,
      voiceNote: msg.voiceNote ?? null,
    }));

    if ((!attachments || attachments.length === 0) && !voiceNote) {
      return list;
    }

    const index = this.findLastUserMessageIndex(list);
    if (index === -1) {
      return list;
    }

    const target = list[index];
    const summary: string[] = [];
    const mergedAttachments: ChatAttachmentMetadata[] = target.attachments
      ? [...target.attachments]
      : [];

    if (attachments && attachments.length > 0) {
      attachments.forEach((att, idx) => {
        mergedAttachments.push(att);
        summary.push(
          `附件${idx + 1}: ${att.name} (${formatFileSize(att.size)}) -> ${att.url}`
        );
      });
    }

    if (voiceNote) {
      summary.push(
        `语音: ${voiceNote.duration.toFixed(1)} 秒 (${voiceNote.mimeType}) -> ${voiceNote.url}`
      );
    }

    if (summary.length > 0) {
      target.content = `${target.content}\n\n${summary.join('\n')}`.trim();
    }

    target.attachments = mergedAttachments.length ? mergedAttachments : undefined;
    const finalVoice = voiceNote || target.voiceNote || null;
    target.voiceNote = finalVoice;
    target.metadata = {
      ...(target.metadata || {}),
      ...(mergedAttachments.length ? { attachments: mergedAttachments } : {}),
      ...(finalVoice ? { voiceNote: finalVoice } : {}),
    };

    return list;
  }

  private findLastUserMessageIndex(messages: ChatMessage[]): number {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === 'user') {
        return i;
      }
    }
    return -1;
  }

  private findLastUserMessage(messages: ChatMessage[]): ChatMessage | null {
    const index = this.findLastUserMessageIndex(messages);
    return index >= 0 ? messages[index] : null;
  }

  private resolveClientIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0];
    }
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded;
    }

    const realIp = req.headers['x-real-ip'];
    if (Array.isArray(realIp) && realIp.length > 0) {
      return realIp[0];
    }
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp;
    }

    if (typeof req.ip === 'string' && req.ip.trim()) {
      return req.ip;
    }

    const socketAddress = req.socket && typeof req.socket.remoteAddress === 'string'
      ? req.socket.remoteAddress
      : null;
    return socketAddress;
  }

  private async recordGeoSnapshot(req: Request, agentId: string, sessionId?: string | null): Promise<void> {
    try {
      const ip = this.resolveClientIp(req);
      await analyticsService.recordAgentRequest({
        agentId,
        sessionId: sessionId || null,
        ip: ip || null,
      });
    } catch (error) {
      console.warn('[ChatController] 记录地域分析失败:', error);
    }
  }

  private buildSessionTitle(messages: ChatMessage[]): string {
    const lastUser = this.findLastUserMessage(messages);
    if (!lastUser) {
      return '新对话';
    }
    const content = (lastUser.content || '').replace(/\s+/g, ' ').trim();
    if (!content) {
      return '新对话';
    }
    return content.length > 30 ? `${content.slice(0, 30)}...` : content;
  }

  private async recordUserHistory(
    sessionId: string,
    agentId: string,
    messages: ChatMessage[],
    attachments?: ChatAttachmentMetadata[] | null,
    voiceNote?: VoiceNoteMetadata | null
  ): Promise<void> {
    const lastUser = this.findLastUserMessage(messages);
    if (!lastUser) {
      return;
    }
    const metadata = (attachments && attachments.length) || voiceNote
      ? {
          attachments: attachments && attachments.length ? attachments : undefined,
          voiceNote: voiceNote || null,
        }
      : undefined;
    try {
      await this.historyService.appendMessage({
        sessionId,
        agentId,
        role: 'user',
        content: lastUser.content,
        metadata,
        messageId: lastUser.id,
        titleHint: this.buildSessionTitle(messages),
      });
    } catch (error) {
      console.warn('[ChatController] 记录用户消息失败:', error);
    }
  }

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
      const attachments: ChatAttachmentMetadata[] | undefined = value.attachments;
      const voiceNote: VoiceNoteMetadata | undefined = value.voiceNote;

      // 统一兼容：顶层与 options 的混用，归一化为 ChatOptions
      const normalizedOptions: ChatOptions = {
        ...(value.options || {}),
        ...(value.chatId ? { chatId: value.chatId } : {}),
        ...(typeof value.detail === 'boolean' ? { detail: value.detail } : {}),
        ...(typeof value.temperature === 'number' ? { temperature: value.temperature } : {}),
        ...(typeof value.maxTokens === 'number' ? { maxTokens: value.maxTokens } : {}),
        ...(value.variables ? { variables: value.variables } : {}),
        ...(value.responseChatItemId ? { responseChatItemId: value.responseChatItemId } : {}),
        ...(attachments ? { attachments } : {}),
        ...(voiceNote ? { voiceNote } : {}),
      };

      const sessionId = normalizedOptions.chatId || value.chatId || generateId();
      normalizedOptions.chatId = sessionId;

      const decoratedMessages = this.decorateMessages(
        Array.isArray(messages) ? messages : [],
        attachments,
        voiceNote
      );

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

      await this.historyService.ensureSession(
        sessionId,
        agentId,
        this.buildSessionTitle(decoratedMessages)
      );

      await this.recordGeoSnapshot(req, agentId, sessionId);

      await this.recordUserHistory(
        sessionId,
        agentId,
        decoratedMessages,
        attachments,
        voiceNote
      );

      console.log('🧪 [chatCompletions] 入参(归一化): ', {
        agentId,
        stream,
        options: normalizedOptions,
        messagesCount: decoratedMessages.length,
      });

      // 处理流式请求
      if (stream) {
        await this.handleStreamRequest(
          res,
          agentId,
          decoratedMessages,
          normalizedOptions,
          sessionId,
          attachments,
          voiceNote || null
        );
      } else {
        await this.handleNormalRequest(
          res,
          agentId,
          decoratedMessages,
          normalizedOptions,
          sessionId,
          attachments,
          voiceNote || null
        );
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
    options: ChatOptions | undefined,
    sessionId: string,
    _attachments?: ChatAttachmentMetadata[] | null,
    _voiceNote?: VoiceNoteMetadata | null
  ): Promise<void> {
    try {
      const response = await this.chatService.sendMessage(agentId, messages, options);
      const assistantContent =
        response?.choices?.[0]?.message?.content || '';

      try {
        await this.historyService.appendMessage({
          sessionId,
          agentId,
          role: 'assistant',
          content: assistantContent,
          metadata: options?.responseChatItemId
            ? { responseChatItemId: options.responseChatItemId }
            : undefined,
        });
      } catch (error) {
        console.warn('[ChatController] 记录助手消息失败:', error);
      }

      res.json({
        success: true,
        data: { ...response, chatId: sessionId },
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
    options: ChatOptions | undefined,
    sessionId: string,
    _attachments?: ChatAttachmentMetadata[] | null,
    _voiceNote?: VoiceNoteMetadata | null
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
      this.sendSSEEvent(res, 'chatId', { chatId: sessionId });
      this.sendSSEEvent(res, 'start', {
        id: generateId(),
        timestamp: new Date().toISOString(),
        agentId,
      });

      let assistantContent = '';

      // 发送流式消息
      await this.chatService.sendStreamMessage(
        agentId,
        messages,
        // 内容回调 - 确保正确调用
        (chunk: string) => {
          console.log('📨 收到内容块:', chunk.substring(0, 50));
          assistantContent += chunk;
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
          if (eventName === 'interactive') {
            console.log('🧩 收到交互节点事件 interactive，payload 预览:',
              (() => { try { return JSON.stringify(data).slice(0, 300); } catch { return '[Unserializable payload]'; } })()
            );
            this.sendSSEEvent(res, 'interactive', data);
          } else if (eventName === 'chatId') {
            console.log('🆔 透传本次使用的 chatId:', (data && (data.chatId || data.id)) || data);
            this.sendSSEEvent(res, 'chatId', data);
          } else {
            console.log('📎 收到未分类透传事件:', eventName);
          }
        }
        );

      if (assistantContent) {
        try {
          await this.historyService.appendMessage({
            sessionId,
            agentId,
            role: 'assistant',
            content: assistantContent,
            metadata: options?.responseChatItemId
              ? { responseChatItemId: options.responseChatItemId }
              : undefined,
          });
        } catch (error) {
          console.warn('[ChatController] 记录流式助手消息失败:', error);
        }
      }
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

      await this.recordGeoSnapshot(req, agent.id, typeof chatId === 'string' ? chatId : null);

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


  /**
   *   
   *  : /api/chat/feedback
   */
  const __tmp_feedback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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

      // 获取智能体配置
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

      // 组装 FastGPT 反馈 API 地址
      const baseUrl = agent.endpoint.replace('/api/v1/chat/completions', '');
      const url = `${baseUrl}/api/core/chat/feedback/updateUserFeedback`;

      // 构建请求体
      const payload: any = {
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

      const resp = await axios.post(url, payload, { headers });
      if (resp.data?.code !== 200) {
        throw new Error(resp.data?.message || '反馈失败');
      }

      res.json({ success: true, data: null, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error('提交点赞/点踩反馈失败:', err);
      const apiError: ApiError = {
        code: 'FEEDBACK_FAILED',
        message: err instanceof Error ? err.message : '反馈失败',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(apiError);
    }

  };



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

      // 获取智能体配置
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

      // 组装 FastGPT 反馈 API 地址
      const baseUrl = agent.endpoint.replace('/api/v1/chat/completions', '');
      const url = `${baseUrl}/api/core/chat/feedback/updateUserFeedback`;

      // 构建请求体
      const payload: any = {
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

      const resp = await axios.post(url, payload, { headers });
      if (resp.data?.code !== 200) {
        throw new Error(resp.data?.message || '反馈失败');
      }

      res.json({ success: true, data: null, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error('提交点赞/点踩反馈失败:', err);
      const apiError: ApiError = {
        code: 'FEEDBACK_FAILED',
        message: err instanceof Error ? err.message : '反馈失败',
        timestamp: new Date().toISOString(),
      };
      res.status(500).json(apiError);
    }
  };


  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      console.warn('[ChatController] 创建上传目录失败:', error);
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  uploadAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { error, value } = this.attachmentUploadSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: error?.details?.[0]?.message || '附件参数校验失败',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const buffer = Buffer.from(value.data, 'base64');
      if (!buffer || buffer.length === 0) {
        res.status(400).json({
          code: 'INVALID_ATTACHMENT',
          message: '附件内容不能为空',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (buffer.length > value.size * 1.2) {
        res.status(400).json({
          code: 'INVALID_ATTACHMENT',
          message: '附件大小与声明不符',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await this.ensureUploadDirectory();

      const fileId = generateId();
      const safeName = this.sanitizeFilename(value.filename);
      const finalName = `${fileId}-${safeName}`;
      const filePath = path.join(this.uploadDir, finalName);

      await fs.writeFile(filePath, buffer);

      const metadata: ChatAttachmentMetadata = {
        id: fileId,
        name: value.filename,
        mimeType: value.mimeType,
        size: buffer.length,
        url: `/uploads/${finalName}`,
        source: value.source || 'upload',
      };

      res.json({
        success: true,
        data: metadata,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[ChatController] 上传附件失败:', error);
      res.status(500).json({
        code: 'ATTACHMENT_UPLOAD_FAILED',
        message: '上传附件失败',
        timestamp: new Date().toISOString(),
      });
    }
  };


  /**
   * 获取聊天历史（如果有实现）
   * GET /api/chat/history/:sessionId
   */
  getChatHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const limitRaw = req.query.limit;
      const offsetRaw = req.query.offset;
      const roleRaw = req.query.role;

      const limit = limitRaw ? parseInt(String(limitRaw), 10) : undefined;
      const offset = offsetRaw ? parseInt(String(offsetRaw), 10) : undefined;
      let roles: Array<'user' | 'assistant' | 'system'> | undefined;

      if (roleRaw) {
        const roleList = Array.isArray(roleRaw)
          ? roleRaw
          : String(roleRaw).split(',');
        roles = roleList
          .map((r) => r.trim())
          .filter((r): r is 'user' | 'assistant' | 'system' =>
            ['user', 'assistant', 'system'].includes(r)
          );
      }

      const history = await this.historyService.getHistory(sessionId, {
        limit,
        offset,
        roles,
      });

      if (!history.session) {
        res.status(404).json({
          code: 'SESSION_NOT_FOUND',
          message: `未找到会话: ${sessionId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: history,
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