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
    const request: any = {
      chatId: options?.chatId,
      stream: stream && config.features.streamingConfig.enabled,
      detail: options?.detail || false,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    };

    // 添加系统消息
    if (config.systemPrompt) {
      request.messages.unshift({
        role: 'system',
        content: config.systemPrompt,
      });
    }

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

      // 转换响应格式
      return provider.transformResponse(response.data);
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
    onStatusChange?: (status: StreamStatus) => void,
    options?: ChatOptions
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
        onStatusChange
      );
    } catch (error) {
      console.error(`智能体 ${agentId} 流式请求失败:`, error);
      onStatusChange?.({
        type: 'error',
        status: 'error',
        error: getErrorMessage(error),
      });
      throw new Error(`智能体流式请求失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 处理流式响应
   */
  private async handleStreamResponse(
    stream: any,
    provider: AIProvider,
    config: AgentConfig,
    onChunk: (chunk: string) => void,
    onStatusChange?: (status: StreamStatus) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let buffer = '';

      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          try {
            // 处理SSE格式
            const sseData = line.startsWith('data: ') ? line.slice(6) : line;
            
            if (sseData === '[DONE]') {
              onStatusChange?.({
                type: 'complete',
                status: 'completed',
              });
              resolve();
              return;
            }

            const data = JSON.parse(sseData);
            
            // 处理内容块
            const content = provider.transformStreamResponse(data);
            if (content) {
              onChunk(content);
            }

            // 处理状态事件（仅FastGPT支持）
            if (config.features.streamingConfig.statusEvents && data.event) {
              onStatusChange?.({
                type: 'flowNodeStatus',
                status: data.event.status,
                moduleName: data.event.moduleName,
              });
            }
          } catch (parseError) {
            console.warn('解析流式数据失败:', parseError);
          }
        }
      });

      stream.on('end', () => {
        onStatusChange?.({
          type: 'complete',
          status: 'completed',
        });
        resolve();
      });

      stream.on('error', (error: Error) => {
        onStatusChange?.({
          type: 'error',
          status: 'error',
          error: error.message,
        });
        reject(error);
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