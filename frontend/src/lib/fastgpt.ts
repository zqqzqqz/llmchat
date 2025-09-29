import {
  ChatMessage,
  ChatSession,
  FastGPTChatHistoryDetail,
  FastGPTChatHistoryMessage,
  FastGPTChatHistorySummary,
} from '@/types';

const coerceDate = (value: string | number | Date | undefined): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  return new Date(value);
};

export const mapHistorySummaryToSession = (
  agentId: string,
  summary: FastGPTChatHistorySummary
): ChatSession => ({
  id: summary.chatId,
  title: summary.title || '未命名对话',
  agentId,
  messages: [],
  createdAt: coerceDate(summary.createdAt),
  updatedAt: coerceDate(summary.updatedAt || summary.createdAt),
});

const mapHistoryMessageToChatMessage = (message: FastGPTChatHistoryMessage): ChatMessage => {
  if (message.role === 'assistant') {
    return {
      AI: message.content,
      id: message.dataId || message.id,
      feedback: message.feedback ?? null,
    };
  }

  if (message.role === 'system') {
    return {
      AI: message.content,
      id: message.dataId || message.id,
    };
  }

  return {
    HUMAN: message.content,
    id: message.dataId || message.id,
  };
};

export const mapHistoryDetailToMessages = (
  detail: FastGPTChatHistoryDetail
): ChatMessage[] => {
  if (!detail?.messages || !Array.isArray(detail.messages)) {
    return [];
  }
  return detail.messages.map(mapHistoryMessageToChatMessage);
};

export const mergeHistoryDetailIntoSession = (
  session: ChatSession,
  detail: FastGPTChatHistoryDetail
): ChatSession => ({
  ...session,
  id: detail.chatId || session.id,
  title: detail.title || session.title,
  messages: mapHistoryDetailToMessages(detail),
  updatedAt: detail.metadata?.updatedAt ? coerceDate(detail.metadata.updatedAt) : new Date(),
});
