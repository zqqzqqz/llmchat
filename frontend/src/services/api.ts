import axios from 'axios';
import { Agent, OriginalChatMessage, ChatOptions, ChatResponse } from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 响应拦截器：处理错误响应
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API请求错误:', error);
    // 如果是网络错误或超时，提供友好的错误信息
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      error.message = '请求超时，请检查网络连接';
    } else if (error.code === 'ERR_NETWORK') {
      error.message = '网络连接失败，请检查后端服务是否启动';
    }
    return Promise.reject(error);
  }
);

export const agentService = {
  async getAgents(): Promise<Agent[]> {
    const response = await api.get('/agents');
    return response.data.data;
  },

  async getAgent(id: string): Promise<Agent> {
    const response = await api.get(`/agents/${id}`);
    return response.data.data;
  },

  async checkAgentStatus(id: string) {
    console.log('检查智能体状态:', id);
    try {
      const response = await api.get(`/agents/${id}/status`);
      console.log('智能体状态响应:', response.data);
      return response.data.data;
    } catch (error) {
      console.error('检查智能体状态失败:', error);
      throw error;
    }
  },
};

export const chatService = {
  async sendMessage(
    agentId: string,
    messages: OriginalChatMessage[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const response = await api.post('/chat/completions', {
      agentId,
      messages,
      stream: false,
      options,
    });
    return response.data.data;
  },

  async sendStreamMessage(
    agentId: string,
    messages: OriginalChatMessage[],
    onChunk: (chunk: string) => void,
    onStatus?: (status: any) => void,
    options?: ChatOptions
  ): Promise<void> {
    console.log('发送流式消息请求:', { agentId, messageCount: messages.length, options });
    
    const response = await fetch('/api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        agentId,
        messages,
        stream: true,
        options,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Stream request failed:', response.status, errorText);
      throw new Error(`Stream request failed: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let currentEventType = ''; // 追踪当前事件类型
    let buffer = '';

    console.log('开始读取 SSE 流...');

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('SSE 流读取完成');
          break;
        }

        const chunk = decoder.decode(value);
        buffer += chunk;
        
        // 按行分割处理
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个不完整的行

        for (const line of lines) {
          if (line.trim() === '') {
            // 空行重置事件类型
            currentEventType = '';
            continue;
          }
          
          console.log('处理 SSE 行:', line);
          
          // 处理 SSE 事件类型
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
            console.log('设置事件类型:', currentEventType);
            continue;
          }
          
          // 处理 SSE 数据
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            
            if (dataStr === '[DONE]') {
              console.log('收到完成信号');
              return;
            }
            
            try {
              const data = JSON.parse(dataStr);
              console.log('解析 SSE 数据:', { eventType: currentEventType, data });
              
              // 根据事件类型处理数据
              switch (currentEventType) {
                case 'chunk':
                  // 后端自定义的 chunk 事件
                  if (data.content) {
                    console.log('处理 chunk 事件:', data.content.substring(0, 50));
                    onChunk(data.content);
                  }
                  break;
                  
                case 'status':
                  // 后端自定义的 status 事件
                  console.log('处理 status 事件:', data);
                  onStatus?.(data);
                  break;
                  
                case 'flowNodeStatus':
                  // FastGPT 官方流程节点状态事件
                  const statusData = {
                    type: 'flowNodeStatus',
                    status: data.status || 'running',
                    moduleName: data.name || data.moduleName || '未知模块'
                  };
                  console.log('处理 flowNodeStatus 事件:', statusData);
                  onStatus?.(statusData);
                  break;
                  
                case 'answer':
                  // FastGPT 官方答案事件
                  const answerContent = data.choices?.[0]?.delta?.content || data.content || '';
                  if (answerContent) {
                    console.log('✅ 处理 answer 事件:', answerContent.substring(0, 50));
                    console.log('🔄 准备调用 onChunk 回调，内容长度:', answerContent.length);
                    onChunk(answerContent);
                    console.log('✅ onChunk 回调调用完成');
                  } else {
                    console.log('⚠️ answer 事件但内容为空:', data);
                  }
                  break;
                  
                default:
                  // 默认处理，兼容非 SSE 格式
                  if (data.content) {
                    console.log('默认内容处理:', data.content.substring(0, 50));
                    onChunk(data.content);
                  }
              }
            } catch (parseError) {
              console.warn('解析 SSE 数据失败:', parseError, '原始数据:', dataStr);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  // ===== 新增：初始化开场白（非流式） =====
  async init(agentId: string, chatId?: string): Promise<any> {
    const response = await api.get('/chat/init', {
      params: {
        appId: agentId,
        ...(chatId ? { chatId } : {}),
        stream: false,
      },
    });
    return response.data.data;
  },

  // ===== 新增：初始化开场白（流式） =====
  async initStream(
    agentId: string,
    chatId: string | undefined,
    onChunk: (chunk: string) => void,
    onComplete?: (data: any) => void
  ): Promise<void> {
    const search = new URLSearchParams({ appId: agentId, stream: 'true' });
    if (chatId) search.set('chatId', chatId);

    const response = await fetch(`/api/chat/init?${search.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Init stream request failed:', response.status, errorText);
      throw new Error(`Init stream request failed: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let currentEventType = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') { currentEventType = ''; continue; }
          if (line.startsWith('event: ')) { currentEventType = line.slice(7).trim(); continue; }
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') { return; }
            try {
              const data = JSON.parse(dataStr);
              switch (currentEventType) {
                case 'chunk':
                  if (data.content) onChunk(data.content);
                  break;
                case 'answer': {
                  const answerContent = data.choices?.[0]?.delta?.content || data.content || '';
                  if (answerContent) onChunk(answerContent);
                  break;
                }
                case 'complete':
                  onComplete?.(data.data ?? data);
                  break;
                case 'status':
                case 'flowNodeStatus':
                default:
                  // 开场白场景主要关心 chunk/complete，其他事件仅忽略
                  break;
              }
            } catch (e) {
              console.warn('解析 Init SSE 数据失败:', e, '原始数据:', dataStr);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};