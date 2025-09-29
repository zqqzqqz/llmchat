import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  AgentConfig,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamStatus,
  RequestHeaders
} from '@/types';
import { AgentConfigService } from './AgentConfigService';
import { generateId, generateTimestamp, getErrorMessage } from '@/utils/helpers';
import { ChatLogService } from './ChatLogService';
import {
  getNormalizedEventKey,
  isChatIdEvent,
  isChunkLikeEvent,
  isDatasetEvent,
  isEndEvent,
  isInteractiveEvent,
  isReasoningEvent,
  isStatusEvent,
  isSummaryEvent,
  isToolEvent,
  isUsageEvent,
} from '@/utils/fastgptEvents';

interface SSEParsedEvent {
  event: string;
  data: string;
  id?: string;
  retry?: number;
}

/**
 * AI提供商适配器接口
 */
export interface AIProvider {
  name: string;
  transformRequest(messages: ChatMessage[], config: AgentConfig, stream: boolean, options?: ChatOptions): any;
  transformResponse(response: any): ChatResponse;
  transformStreamResponse(chunk: any): string;
  validateConfig(config: AgentConfig): boolean;
  buildHeaders(config: AgentConfig): RequestHeaders;
}

/**
 * FastGPT提供商适配器
 */
export class FastGPTProvider implements AIProvider {
  name = 'FastGPT';

  transformRequest(messages: ChatMessage[], config: AgentConfig, stream: boolean = false, options?: ChatOptions) {
    const detail = options?.detail ?? config.features?.supportsDetail ?? false;
    const request: any = {
      chatId: options?.chatId || `chat_${Date.now()}`,
      stream: stream && config.features.streamingConfig.enabled,
      detail,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    };

    // 添加 FastGPT 特有参数支持
    if (options?.variables) {
      request.variables = options.variables;
    }
    
    if (options?.responseChatItemId) {
      request.responseChatItemId = options.responseChatItemId;
    }

    // 添加系统消息
    if (config.systemPrompt) {
      request.messages.unshift({
        role: 'system',
        content: config.systemPrompt,
      });
    }

    console.log('FastGPT 请求数据:', JSON.stringify(request, null, 2));
    return request;
  }

  transformResponse(response: any): ChatResponse {
    return {
      id: response.id || generateId(),
      object: response.object || 'chat.completion',
      created: response.created || generateTimestamp(),
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

  transformStreamResponse(chunk: any): string {
    // FastGPT流式响应格式
    if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
      return chunk.choices[0].delta.content || '';
    }
    return '';
  }

  validateConfig(config: AgentConfig): boolean {
    return (
      config.provider === 'fastgpt' &&
      config.apiKey.startsWith('fastgpt-') &&
      config.endpoint.includes('/chat/completions')
    );
  }

  buildHeaders(config: AgentConfig): RequestHeaders {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };
  }
}

/**
 * OpenAI提供商适配器
 */
export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';

  transformRequest(messages: ChatMessage[], config: AgentConfig, stream: boolean = false, options?: ChatOptions) {
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

  transformResponse(response: any): ChatResponse {
    return {
      id: response.id || generateId(),
      object: response.object || 'chat.completion',
      created: response.created || generateTimestamp(),
      model: response.model,
      choices: response.choices.map((choice: any) => ({
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

  transformStreamResponse(chunk: any): string {
    if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
      return chunk.choices[0].delta.content || '';
    }
    return '';
  }

  validateConfig(config: AgentConfig): boolean {
    return (
      config.provider === 'openai' &&
      config.apiKey.startsWith('sk-') &&
      config.endpoint.includes('openai.com')
    );
  }

  buildHeaders(config: AgentConfig): RequestHeaders {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };
  }
}

/**
 * Anthropic提供商适配器
 */
export class AnthropicProvider implements AIProvider {
  name = 'Anthropic';

  transformRequest(messages: ChatMessage[], config: AgentConfig, stream: boolean = false, options?: ChatOptions) {
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

  transformResponse(response: any): ChatResponse {
    return {
      id: response.id || generateId(),
      object: 'chat.completion',
      created: generateTimestamp(),
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

  transformStreamResponse(chunk: any): string {
    if (chunk.type === 'content_block_delta') {
      return chunk.delta.text || '';
    }
    return '';
  }

  validateConfig(config: AgentConfig): boolean {
    return (
      config.endpoint.includes('anthropic.com') &&
      config.apiKey.startsWith('sk-ant-') &&
      config.provider === 'anthropic'
    );
  }

  buildHeaders(config: AgentConfig): RequestHeaders {
    return {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }
}

/**
 * 聊天代理服务
 */
export class ChatProxyService {
  private agentService: AgentConfigService;
  private httpClient: AxiosInstance;
  private providers: Map<string, AIProvider> = new Map();
  private chatLog: ChatLogService = new ChatLogService();

  constructor(agentService: AgentConfigService) {
    this.agentService = agentService;
    this.httpClient = axios.create({
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
    });

    // 注册提供商适配器
    this.registerProvider(new FastGPTProvider());
    this.registerProvider(new OpenAIProvider());
    this.registerProvider(new AnthropicProvider());
  }

  /**
   * 注册提供商适配器
   */
  private registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name.toLowerCase(), provider);
  }

  /**
   * 发送聊天消息（非流式）
   */
  async sendMessage(
    agentId: string,
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
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
      // 转换请求格式
      const requestData = provider.transformRequest(messages, config, false, options);
      
      // 构建请求头
      const headers = provider.buildHeaders(config);
      
      // 发送请求
      const response: AxiosResponse = await this.httpClient.post(
        config.endpoint,
        requestData,
        { headers }
      );

      // 转换响应格式并记录日志
      const normalized = provider.transformResponse(response.data);
      try {
        this.chatLog.logCompletion({
          agentId,
          provider: config.provider,
          endpoint: config.endpoint,
          requestMeta: {
            messagesCount: Array.isArray(messages) ? messages.length : 0,
            chatId: (requestData as any)?.chatId,
          },
          rawResponse: response.data,
          normalizedResponse: normalized,
        });
      } catch {}
      return normalized;
    } catch (error) {
      console.error(`智能体 ${agentId} 请求失败:`, error);
      throw new Error(`智能体请求失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 发送流式聊天消息
   */
  async sendStreamMessage(
    agentId: string,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onStatus: (status: StreamStatus) => void,
    options?: ChatOptions,
    onEvent?: (eventName: string, data: any) => void
  ): Promise<void> {
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
      // 转换请求格式
      const requestData = provider.transformRequest(messages, config, true, options);
      
      // 构建请求头
      const headers = provider.buildHeaders(config);
      
      // 在发送请求前，将本次使用的 chatId 透传给上层（用于交互节点继续运行复用 chatId）
      let usedChatId: string | undefined;
      try {
        usedChatId = (requestData as any)?.chatId;
        if (usedChatId) {
          // 记录 chatId 事件
          try {
            this.chatLog.logStreamEvent({
              agentId,
              chatId: usedChatId,
              provider: config.provider,
              endpoint: config.endpoint,
              eventType: 'chatId',
              data: { chatId: usedChatId },
            });
          } catch {}
          onEvent?.('chatId', { chatId: usedChatId });
        }
      } catch (_) {}

      // 发送流式请求
      const response = await this.httpClient.post(
        config.endpoint,
        requestData,
        {
          headers,
          responseType: 'stream',
        }
      );

      // 处理流式响应
      await this.handleStreamResponse(
        response.data,
        provider,
        config,
        onChunk,
        onStatus,
        onEvent,
        { agentId, endpoint: config.endpoint, provider: config.provider, ...(usedChatId ? { chatId: usedChatId } : {}) }
      );
    } catch (error) {
      console.error(`智能体 ${agentId} 流式请求失败:`, error);
      onStatus?.({
        type: 'error',
        status: 'error',
        error: getErrorMessage(error),
      });
      throw new Error(`智能体流式请求失败: ${getErrorMessage(error)}`);
    }
  }

  private findNextEventBoundary(buffer: string): { index: number; length: number } | null {
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

  private parseSSEEventBlock(rawBlock: string): SSEParsedEvent | null {
    const lines = rawBlock.split(/\r?\n/);
    let event = '';
    const dataLines: string[] = [];
    let id: string | undefined;
    let retry: number | undefined;

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

    const result: SSEParsedEvent = { event, data };
    if (typeof id === 'string') {
      result.id = id;
    }
    if (typeof retry === 'number') {
      result.retry = retry;
    }

    return result;
  }

  private logStreamEvent(
    ctx: { agentId: string; chatId?: string; endpoint: string; provider: string } | undefined,
    eventType: string,
    data: any
  ): void {
    try {
      this.chatLog.logStreamEvent({
        agentId: ctx?.agentId || 'unknown',
        ...(ctx?.provider ? { provider: ctx.provider } : {}),
        ...(ctx?.endpoint ? { endpoint: ctx.endpoint } : {}),
        ...(ctx?.chatId ? { chatId: ctx.chatId } : {}),
        eventType,
        data,
      });
    } catch {}
  }

  private extractReasoningPayload(data: any): any {
    return (
      data?.choices?.[0]?.delta?.reasoning_content ||
      data?.delta?.reasoning_content ||
      data?.reasoning_content ||
      data?.reasoning ||
      null
    );
  }

  private dispatchFastGPTEvent(
    provider: AIProvider,
    eventName: string,
    payload: any,
    onChunk: (chunk: string) => void,
    onStatus?: (status: StreamStatus) => void,
    onEvent?: (eventName: string, data: any) => void,
    ctx?: { agentId: string; chatId?: string; endpoint: string; provider: string }
  ): void {
    const resolvedEvent = (eventName || (typeof payload?.event === 'string' ? payload.event : '') || '').trim();
    const eventKey = getNormalizedEventKey(resolvedEvent || 'message');

    const emitEvent = (name: string, data: any) => {
      if (!onEvent) return;
      try {
        onEvent(name, data);
      } catch (emitError) {
        console.warn('事件回调执行失败:', emitError);
      }
    };

    if (isChatIdEvent(resolvedEvent)) {
      this.logStreamEvent(ctx, 'chatId', payload);
      emitEvent('chatId', payload);
      return;
    }

    if (isInteractiveEvent(resolvedEvent)) {
      this.logStreamEvent(ctx, 'interactive', payload);
      emitEvent('interactive', payload);
      return;
    }

    if (eventKey === getNormalizedEventKey('flowResponses')) {
      this.logStreamEvent(ctx, 'flowResponses', payload);
      onStatus?.({ type: 'progress', status: 'completed', moduleName: '执行完成' });
      emitEvent(resolvedEvent || 'flowResponses', payload);
      return;
    }

    if (isStatusEvent(resolvedEvent)) {
      const statusEvent: StreamStatus = {
        type: 'flowNodeStatus',
        status: (payload?.status ?? 'running') as StreamStatus['status'],
        moduleName: payload?.name || payload?.moduleName || payload?.id || '未知模块',
      };
      this.logStreamEvent(ctx, 'flowNodeStatus', payload);
      onStatus?.(statusEvent);
      emitEvent(resolvedEvent || 'flowNodeStatus', payload);
      return;
    }

    if (eventKey === getNormalizedEventKey('answer')) {
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

    if (isReasoningEvent(resolvedEvent)) {
      this.logStreamEvent(ctx, 'reasoning', payload);
      emitEvent('reasoning', { event: resolvedEvent || 'reasoning', data: payload });
      return;
    }

    if (isDatasetEvent(resolvedEvent) || isSummaryEvent(resolvedEvent) || isToolEvent(resolvedEvent)) {
      this.logStreamEvent(ctx, resolvedEvent || 'event', payload);
      emitEvent(resolvedEvent || 'event', payload);
      return;
    }

    if (isUsageEvent(resolvedEvent)) {
      this.logStreamEvent(ctx, 'usage', payload);
      emitEvent('usage', payload);
      return;
    }

    if (isEndEvent(resolvedEvent)) {
      this.logStreamEvent(ctx, resolvedEvent || 'end', payload);
      onStatus?.({ type: 'complete', status: 'completed' });
      emitEvent(resolvedEvent || 'end', payload);
      return;
    }

    const transformed = provider.transformStreamResponse(payload);
    if (transformed) {
      this.logStreamEvent(ctx, 'chunk', transformed);
      onChunk(transformed);
    }

    if (resolvedEvent && !isChunkLikeEvent(resolvedEvent)) {
      emitEvent(resolvedEvent, payload);
    }
  }

  /**
   * 处理流式响应 - 兼容 FastGPT 全事件并支持多行 data
   */
  private async handleStreamResponse(
    stream: any,
    provider: AIProvider,
    config: AgentConfig,
    onChunk: (chunk: string) => void,
    onStatus?: (status: StreamStatus) => void,
    onEvent?: (eventName: string, data: any) => void,
    ctx?: { agentId: string; chatId?: string; endpoint: string; provider: string }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let buffer = '';
      let completed = false;

      console.log('开始处理流式响应，提供商:', config.provider);

      const flushEventBlock = (rawBlock: string) => {
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

        let payload: any = rawData;
        if (typeof rawData === 'string') {
          const trimmed = rawData.trim();
          if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
              payload = JSON.parse(rawData);
            } catch (parseError) {
              console.warn('解析 SSE 数据失败:', parseError, '原始数据:', rawData);
              payload = rawData;
            }
          }
        }

        this.dispatchFastGPTEvent(provider, parsed.event, payload, onChunk, onStatus, onEvent, ctx);
      };

      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();

        let boundary: { index: number; length: number } | null;
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

      stream.on('error', (error: Error) => {
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

  /**
   * 获取提供商适配器
   */
  private getProvider(providerName: string): AIProvider | undefined {
    return this.providers.get(providerName.toLowerCase());
  }

  /**
   * 验证智能体配置
   */
  async validateAgentConfig(agentId: string): Promise<boolean> {
    const config = await this.agentService.getAgent(agentId);
    if (!config) return false;

    const provider = this.getProvider(config.provider);
    if (!provider) return false;

    return provider.validateConfig(config);
  }
}