import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/ui/Toast';
import { debugLog } from '@/lib/debug';
import {
  Agent,
  OriginalChatMessage,
  ChatOptions,
  ChatResponse,
  FastGPTChatHistoryDetail,
  FastGPTChatHistorySummary,
  ProductPreviewRequest,
  ProductPreviewResponse,
} from '@/types';
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
} from '@/lib/fastgptEvents';

// API响应通用接口
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
  timestamp: string;
}

export const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
    console.error('API请求错误:', error);
    const status = error?.response?.status;
    if (status === 401) {
      // 统一登出并跳转登录
      const { logout } = useAuthStore.getState();
      logout();
      toast({ type: 'warning', title: '登录状态已过期，请重新登录' });
      const target = window.location.pathname + (window.location.search || '');
      window.location.assign(`/login?redirect=${encodeURIComponent(target)}`);
      return Promise.reject(error);
    }
    // 网络错误与超时提示
    if (error.code === 'ECONNABORTED' || (typeof error.message === 'string' && error.message.includes('timeout'))) {
      error.message = '请求超时，请检查网络连接';
    } else if (error.code === 'ERR_NETWORK') {
      error.message = '网络连接失败，请检查后端服务是否启动';
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
    debugLog('检查智能体状态:', id);
    try {
      const response = await api.get<ApiResponse>(`/agents/${id}/status`);
      debugLog('智能体状态响应:', response.data);
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
    const response = await api.post<ApiResponse<ChatResponse>>('/chat/completions', {
      agentId,
      messages,
      stream: false,
      ...(options?.chatId ? { chatId: options.chatId } : {}),
      ...(typeof options?.detail === 'boolean' ? { detail: options.detail } : {}),
      ...(typeof options?.temperature === 'number' ? { temperature: options.temperature } : {}),
      ...(typeof options?.maxTokens === 'number' ? { maxTokens: options.maxTokens } : {}),
      ...(options?.variables ? { variables: options.variables } : {}),
      ...(options?.responseChatItemId ? { responseChatItemId: options.responseChatItemId } : {}),
    });
    return response.data.data;
  },

  async sendStreamMessage(
    agentId: string,
    messages: OriginalChatMessage[],
    onChunk: (chunk: string) => void,
    onStatus?: (status: any) => void,
    options?: ChatOptions,
    onInteractive?: (data: any) => void,
    onChatId?: (chatId: string) => void,
    onReasoning?: (event: { event?: string; data: any }) => void,
    onEvent?: (eventName: string, data: any) => void
  ): Promise<void> {
    debugLog('发送流式消息请求:', { agentId, messageCount: messages.length, options });

    const authToken = useAuthStore.getState().token;
    const response = await fetch('/api/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        agentId,
        messages,
        stream: true,
        ...(options?.chatId ? { chatId: options.chatId } : {}),
        ...(typeof options?.detail === 'boolean' ? { detail: options.detail } : {}),
        ...(typeof options?.temperature === 'number' ? { temperature: options.temperature } : {}),
        ...(typeof options?.maxTokens === 'number' ? { maxTokens: options.maxTokens } : {}),
        ...(options?.variables ? { variables: options.variables } : {}),
        ...(options?.responseChatItemId ? { responseChatItemId: options.responseChatItemId } : {}),
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        const { logout } = useAuthStore.getState();
        logout();
        toast({ type: 'warning', title: '登录状态已过期，请重新登录' });
        const target = window.location.pathname + (window.location.search || '');
        window.location.assign(`/login?redirect=${encodeURIComponent(target)}`);
        return;
      }
      const errorText = await response.text();
      console.error('Stream request failed:', response.status, errorText);
      throw new Error(`Stream request failed: ${response.status} ${errorText}`);
    }

    debugLog('开始读取 SSE 流...');

    await consumeChatSSEStream(response, {
      onChunk,
      onStatus,
      onInteractive,
      onChatId,
      onReasoning,
      onEvent,
    });
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
    onComplete?: (data: any) => void
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
    });

    if (!response.ok) {
      if (response.status === 401) {
        const { logout } = useAuthStore.getState();
        logout();
        toast({ type: 'warning', title: '登录状态已过期，请重新登录' });
        const target = window.location.pathname + (window.location.search || '');
        window.location.assign(`/login?redirect=${encodeURIComponent(target)}`);
        return;
      }
      const errorText = await response.text();
      console.error('Init stream request failed:', response.status, errorText);
      throw new Error(`Init stream request failed: ${response.status} ${errorText}`);
    }

    await consumeChatSSEStream(response, {
      onChunk,
      onStatus: (status) => {
        if (status?.type === 'complete') {
          onComplete?.(status);
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
      console.error('提交点赞/点踩反馈失败:', e);
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

    if (!response.ok) {
      if (response.status === 401) {
        const { logout } = useAuthStore.getState();
        logout();
        toast({ type: 'warning', title: '登录状态已过期，请重新登录' });
        const target = window.location.pathname + (window.location.search || '');
        window.location.assign(`/login?redirect=${encodeURIComponent(target)}`);
        return;
      }
      const errorText = await response.text();
      console.error('Retry stream request failed:', response.status, errorText);
      throw new Error(`Retry stream request failed: ${response.status} ${errorText}`);
    }

    await consumeChatSSEStream(response, {
      onChunk,
      onStatus,
      onInteractive,
      onChatId,
      onReasoning,
      onEvent,
    });
  },

};

export const productPreviewService = {
  async generatePreview(payload: ProductPreviewRequest): Promise<ProductPreviewResponse> {
    const response = await api.post<ApiResponse<ProductPreviewResponse>>('/product-preview/generate', payload);
    return response.data.data;
  },
};