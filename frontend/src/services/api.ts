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

interface SSECallbacks {
  onChunk: (chunk: string) => void;
  onStatus?: (status: any) => void;
  onInteractive?: (data: any) => void;
  onChatId?: (chatId: string) => void;
  onReasoning?: (event: { event?: string; data: any }) => void;
  onEvent?: (eventName: string, data: any) => void;
}

interface SSEParsedEvent {
  event: string;
  data: string;
  id?: string;
  retry?: number;
}

const findNextEventBoundary = (buffer: string): { index: number; length: number } | null => {
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
};

const parseSSEEventBlock = (rawBlock: string): SSEParsedEvent | null => {
  const lines = rawBlock.split(/\r?\n/);
  let event = '';
  const dataLines: string[] = [];
  let id: string | undefined;
  let retry: number | undefined;

  for (const line of lines) {
    if (!line || line.startsWith(':')) continue;

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

  return { event, data, id, retry };
};

const extractReasoningPayload = (payload: any) =>
  payload?.choices?.[0]?.delta?.reasoning_content ||
  payload?.delta?.reasoning_content ||
  payload?.reasoning_content ||
  payload?.reasoning ||
  null;

const consumeChatSSEStream = async (
  response: Response,
  { onChunk, onStatus, onInteractive, onChatId, onReasoning, onEvent }: SSECallbacks
): Promise<void> => {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;

  const emitReasoning = (eventName: string, payload: any) => {
    if (!onReasoning) return;
    try {
      onReasoning({ event: eventName, data: payload });
    } catch (err) {
      console.warn('reasoning 回调执行失败:', err);
    }
  };

  const handleEvent = (eventName: string, payload: any) => {
    const resolvedEvent = (eventName || (typeof payload?.event === 'string' ? payload.event : '') || '').trim();
    const eventKey = getNormalizedEventKey(resolvedEvent || 'message');

    if (isChatIdEvent(resolvedEvent)) {
      const chatIdValue = payload?.chatId || payload?.id || payload;
      if (typeof chatIdValue === 'string') {
        onChatId?.(chatIdValue);
      }
      onEvent?.('chatId', payload);
      return;
    }

    if (isInteractiveEvent(resolvedEvent)) {
      onInteractive?.(payload);
      onEvent?.('interactive', payload);
      return;
    }

    if (isStatusEvent(resolvedEvent)) {
      const statusData = {
        type: 'flowNodeStatus',
        status: payload?.status || 'running',
        moduleName: payload?.name || payload?.moduleName || payload?.id || '未知模块',
      };
      onStatus?.(statusData);
      onEvent?.(resolvedEvent || 'flowNodeStatus', payload);
      return;
    }

    if (eventKey === getNormalizedEventKey('flowResponses')) {
      onStatus?.({ type: 'progress', status: 'completed', moduleName: '执行完成' });
      onEvent?.(resolvedEvent || 'flowResponses', payload);
      return;
    }

    if (eventKey === getNormalizedEventKey('answer')) {
      const answerContent = payload?.choices?.[0]?.delta?.content || payload?.content || '';
      if (answerContent) {
        onChunk(answerContent);
      }
      const reasoningContent = extractReasoningPayload(payload);
      if (reasoningContent) {
        emitReasoning(resolvedEvent || 'reasoning', reasoningContent);
      }
      onEvent?.('answer', payload);
      return;
    }

    if (isReasoningEvent(resolvedEvent)) {
      emitReasoning(resolvedEvent || 'reasoning', payload);
      onEvent?.('reasoning', { event: resolvedEvent || 'reasoning', data: payload });
      return;
    }

    if (isDatasetEvent(resolvedEvent) || isSummaryEvent(resolvedEvent) || isToolEvent(resolvedEvent)) {
      onEvent?.(resolvedEvent || 'event', payload);
      return;
    }

    if (isUsageEvent(resolvedEvent)) {
      onEvent?.('usage', payload);
      return;
    }

    if (isEndEvent(resolvedEvent)) {
      onEvent?.(resolvedEvent || 'end', payload);
      onStatus?.({ type: 'complete', status: 'completed' });
      return;
    }

    const reasoningContent = extractReasoningPayload(payload);

    if (!resolvedEvent || isChunkLikeEvent(resolvedEvent)) {
      const chunkContent = typeof payload === 'string'
        ? payload
        : payload?.content || payload?.choices?.[0]?.delta?.content || '';
      if (chunkContent) {
        onChunk(chunkContent);
      }
      if (reasoningContent) {
        emitReasoning(resolvedEvent || 'reasoning', reasoningContent);
      }
      if (resolvedEvent && !isChunkLikeEvent(resolvedEvent)) {
        onEvent?.(resolvedEvent, payload);
      }
      return;
    }

    if (typeof payload === 'string') {
      if (payload) {
        onChunk(payload);
      }
      if (reasoningContent) {
        emitReasoning(resolvedEvent || 'reasoning', reasoningContent);
      }
      onEvent?.(resolvedEvent, payload);
      return;
    }

    const fallbackContent = payload?.content || payload?.choices?.[0]?.delta?.content;
    if (fallbackContent) {
      onChunk(fallbackContent);
    }

    if (reasoningContent) {
      emitReasoning(resolvedEvent || 'reasoning', reasoningContent);
    }

    onEvent?.(resolvedEvent, payload);
  };

  const flushEventBlock = (rawBlock: string) => {
    const parsed = parseSSEEventBlock(rawBlock.replace(/\r/g, ''));
    if (!parsed || !parsed.data) {
      return;
    }

    const trimmed = parsed.data.trim();
    if (trimmed === '[DONE]') {
      if (!completed) {
        completed = true;
        onStatus?.({ type: 'complete', status: 'completed' });
        onEvent?.('end', { done: true });
      }
      return;
    }

    let payload: any = parsed.data;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        payload = JSON.parse(parsed.data);
      } catch (error) {
        console.warn('解析 SSE 数据失败:', error, '原始数据:', parsed.data);
        payload = parsed.data;
      }
    }

    handleEvent(parsed.event, payload);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let boundary: { index: number; length: number } | null;
      while ((boundary = findNextEventBoundary(buffer)) !== null) {
        const rawBlock = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary.length);

        if (rawBlock.trim().length === 0) {
          continue;
        }

        flushEventBlock(rawBlock);
      }
    }

    if (buffer.trim().length > 0) {
      flushEventBlock(buffer);
    }
  } finally {
    reader.releaseLock();
  }
};

export const agentService = {
  async getAgents(): Promise<Agent[]> {
    const response = await api.get<ApiResponse<Agent[]>>('/agents');
    return response.data.data;
  },

  async getAgent(id: string): Promise<Agent> {
    const response = await api.get<ApiResponse<Agent>>(`/agents/${id}`);
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

    debugLog('开始读取 SSE 流...');


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
    const response = await api.get<ApiResponse>('/chat/init', {
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
      },
      onEvent: (eventName, payload) => {
        if (eventName === 'complete') {
          onComplete?.((payload as any)?.data ?? payload);
        }
        if (eventName === 'end' && payload && typeof payload === 'object' && 'data' in payload) {
          onComplete?.((payload as any).data);
        }
      },
    });
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
  },

  async listHistories(agentId: string): Promise<FastGPTChatHistorySummary[]> {
    const response = await api.get<ApiResponse<FastGPTChatHistorySummary[]>>('/chat/history', { params: { agentId } });
    return response.data.data;
  },

  async getHistoryDetail(agentId: string, chatId: string): Promise<FastGPTChatHistoryDetail> {
    const response = await api.get<ApiResponse<FastGPTChatHistoryDetail>>(`/chat/history/${chatId}`, { params: { agentId } });
    return response.data.data;
  },

  async deleteHistory(agentId: string, chatId: string): Promise<void> {
    await api.delete(`/chat/history/${chatId}`, { params: { agentId } });
  },

  async clearHistories(agentId: string): Promise<void> {
    await api.delete('/chat/history', { params: { agentId } });
  },

  async retryMessage(
    agentId: string,
    chatId: string,
    dataId: string,
    options?: { detail?: boolean }
  ): Promise<ChatResponse> {
    const payload: Record<string, any> = {
      agentId,
      dataId,
      stream: false,
    };

    if (typeof options?.detail === 'boolean') {
      payload.detail = options.detail;
    }

    const response = await api.post<ApiResponse<ChatResponse>>(`/chat/history/${chatId}/retry`, payload);
    return response.data.data;
  },

  async retryStreamMessage(
    agentId: string,
    chatId: string,
    dataId: string,
    onChunk: (chunk: string) => void,
    onStatus?: (status: any) => void,
    options?: { detail?: boolean },
    onInteractive?: (data: any) => void,
    onChatId?: (chatId: string) => void,
    onReasoning?: (event: { event?: string; data: any }) => void,
    onEvent?: (eventName: string, data: any) => void
  ): Promise<void> {
    const authToken = useAuthStore.getState().token;
    const payload: Record<string, any> = {
      agentId,
      dataId,
      stream: true,
    };

    if (typeof options?.detail === 'boolean') {
      payload.detail = options.detail;
    }

    const response = await fetch(`/api/chat/history/${chatId}/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });


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
