import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/ui/Toast';
import { translate } from '@/i18n';
import { Agent, OriginalChatMessage, ChatOptions, ChatResponse, ChatAttachmentMetadata } from '@/types';

export const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      } else {
        reject(new Error(translate('无法读取文件内容')));
      }
    };
    reader.onerror = () => reject(reader.error || new Error(translate('文件读取失败')));
    reader.readAsDataURL(blob);
  });
}

// 请求拦截器：自动附加 Authorization
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理错误响应与 401 统一登出
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error(translate('API请求错误'), error);
    const status = error?.response?.status;
    if (status === 401) {
      // 统一登出并跳转登录
      const { logout } = useAuthStore.getState();
      logout();
      toast({ type: 'warning', title: translate('登录状态已过期，请重新登录') });
      const target = window.location.pathname + (window.location.search || '');
      window.location.assign(`/login?redirect=${encodeURIComponent(target)}`);
      return Promise.reject(error);
    }
    // 网络错误与超时提示
    if (error.code === 'ECONNABORTED' || (typeof error.message === 'string' && error.message.includes('timeout'))) {
      error.message = translate('请求超时，请检查网络连接');
    } else if (error.code === 'ERR_NETWORK') {
      error.message = translate('网络连接失败，请检查后端服务是否启动');
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
    console.log(translate('检查智能体状态'), id);
    try {
      const response = await api.get(`/agents/${id}/status`);
      console.log(translate('智能体状态响应'), response.data);
      return response.data.data;
    } catch (error) {
      console.error(translate('检查智能体状态失败'), error);
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
    const { attachments, voiceNote, ...restOptions } = options || {};
    const response = await api.post('/chat/completions', {
      agentId,
      messages,
      stream: false,
      ...(restOptions.chatId ? { chatId: restOptions.chatId } : {}),
      ...(typeof restOptions.detail === 'boolean' ? { detail: restOptions.detail } : {}),
      ...(typeof restOptions.temperature === 'number' ? { temperature: restOptions.temperature } : {}),
      ...(typeof restOptions.maxTokens === 'number' ? { maxTokens: restOptions.maxTokens } : {}),
      ...(restOptions.variables ? { variables: restOptions.variables } : {}),
      ...(restOptions.responseChatItemId ? { responseChatItemId: restOptions.responseChatItemId } : {}),
      ...(attachments && attachments.length ? { attachments } : {}),
      ...(voiceNote ? { voiceNote } : {}),
    });
    return response.data.data;
  },

  async sendStreamMessage(
    agentId: string,
    messages: OriginalChatMessage[],
    callbacks: {
      onChunk: (chunk: string) => void;
      onStatus?: (status: any) => void;
      onInteractive?: (data: any) => void;
      onChatId?: (chatId: string) => void;
      signal?: AbortSignal;
    },
    options?: ChatOptions
  ): Promise<void> {
    const { onChunk, onStatus, onInteractive, onChatId, signal } = callbacks;
    const { attachments, voiceNote, ...restOptions } = options || {};

    const payload = {
      agentId,
      messages,
      stream: true,
      ...(restOptions.chatId ? { chatId: restOptions.chatId } : {}),
      ...(typeof restOptions.detail === 'boolean' ? { detail: restOptions.detail } : {}),
      ...(typeof restOptions.temperature === 'number' ? { temperature: restOptions.temperature } : {}),
      ...(typeof restOptions.maxTokens === 'number' ? { maxTokens: restOptions.maxTokens } : {}),
      ...(restOptions.variables ? { variables: restOptions.variables } : {}),
      ...(restOptions.responseChatItemId ? { responseChatItemId: restOptions.responseChatItemId } : {}),
      ...(attachments && attachments.length ? { attachments } : {}),
      ...(voiceNote ? { voiceNote } : {}),
    };

    const authToken = useAuthStore.getState().token;
    const response = await fetch('/api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        const { logout } = useAuthStore.getState();
        logout();
        toast({ type: 'warning', title: translate('登录状态已过期，请重新登录') });
        const target = window.location.pathname + (window.location.search || '');
        window.location.assign(`/login?redirect=${encodeURIComponent(target)}`);
        return;
      }
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

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

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

          // 处理 SSE 事件类型
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
            continue;
          }

          // 处理 SSE 数据
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);

            if (dataStr === '[DONE]') {
              return;
            }

            try {
              const data = JSON.parse(dataStr);

              // 根据事件类型处理数据
              switch (currentEventType) {
                case 'chunk':
                  // 后端自定义的 chunk 事件
                  if (data.content) {
                    onChunk(data.content);
                  }
                  break;

                case 'status':
                  // 后端自定义的 status 事件
                  onStatus?.(data);
                  break;

                case 'flowNodeStatus': {
                  // FastGPT 官方流程节点状态事件
                  const statusData = {
                    type: 'flowNodeStatus',
                    status: data.status || 'running',
                    moduleName: data.name || data.moduleName || translate('未知模块')
                  };
                  onStatus?.(statusData);
                  break;
                }

                case 'answer': {
                  // FastGPT 官方答案事件
                  const answerContent = data.choices?.[0]?.delta?.content || data.content || '';
                  if (answerContent) onChunk(answerContent);
                  break;
                }

                case 'interactive':
                  // FastGPT 交互节点事件（detail=true 时出现）
                  onInteractive?.(data);
                  break;

                case 'chatId':
                  if (data?.chatId) onChatId?.(data.chatId);
                  break;

                default:
                  // 默认处理，兼容非 SSE 格式
                  if (data.content) {
                    onChunk(data.content);
                  }
              }
            } catch (parseError) {
              console.warn(translate('解析 SSE 数据失败'), parseError, translate('原始数据'), dataStr);
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
    onComplete?: (data: any) => void,
    opts?: { signal?: AbortSignal }
  ): Promise<void> {
    const search = new URLSearchParams({ appId: agentId, stream: 'true' });
    if (chatId) search.set('chatId', chatId);

    const authToken = useAuthStore.getState().token;
    const response = await fetch(`/api/chat/init?${search.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      signal: opts?.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        const { logout } = useAuthStore.getState();
        logout();
        toast({ type: 'warning', title: translate('登录状态已过期，请重新登录') });
        const target = window.location.pathname + (window.location.search || '');
        window.location.assign(`/login?redirect=${encodeURIComponent(target)}`);
        return;
      }
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
              console.warn(translate('解析 Init SSE 数据失败'), e, translate('原始数据'), dataStr);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  async updateUserFeedback(
    agentId: string,
    chatId: string,
    dataId: string,
    type: 'good' | 'bad',
    cancel: boolean = false
  ): Promise<void> {
    try {
      const payload: any = {
        agentId,
        chatId,
        dataId,
        ...(type === 'good' && !cancel ? { userGoodFeedback: 'yes' } : {}),
        ...(type === 'bad' && !cancel ? { userBadFeedback: 'yes' } : {}),
      };
      await api.post('/chat/feedback', payload);
    } catch (e) {
      console.error(translate('提交点赞/点踩反馈失败'), e);
      throw e;
    }
  }

};

export async function uploadAttachment(
  file: File | Blob,
  opts?: { source?: 'upload' | 'voice'; filename?: string }
): Promise<ChatAttachmentMetadata> {
  const base64 = await blobToBase64(file);
  const name = opts?.filename || ('name' in file ? (file as File).name : 'attachment');
  const mimeType = 'type' in file && file.type ? file.type : 'application/octet-stream';
  const size = 'size' in file && typeof file.size === 'number' ? file.size : base64.length * 0.75;

  const { data } = await api.post<{ success: boolean; data: ChatAttachmentMetadata }>(
    '/chat/attachments',
    {
      filename: name,
      mimeType,
      size,
      data: base64,
      source: opts?.source ?? 'upload',
    }
  );

  return data.data;
}