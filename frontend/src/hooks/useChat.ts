import { useCallback } from 'react';
import { chatService } from '@/services/api';
import { useChatStore } from '@/store/chatStore';
import { ChatMessage, ChatOptions, OriginalChatMessage } from '@/types';
import { useI18n } from '@/i18n';

export const useChat = () => {
  const { t } = useI18n();
  const sendMessage = useCallback(async (
    content: string,
    options?: ChatOptions
  ) => {
    const state = useChatStore.getState();
    const { currentAgent, currentSession, preferences } = state;

    if (!currentAgent) {
      throw new Error(t('没有选择智能体'));
    }

    // 如果没有当前会话，创建一个（huihua.md 要求）
    if (!currentSession) {
      state.createNewSession();
    }

    const latestState = useChatStore.getState();
    const activeSession = latestState.currentSession;

    // 添加用户消息（按 huihua.md 格式）
    const userMessage: ChatMessage = {
      HUMAN: content,
      ...(options?.attachments ? { attachments: options.attachments } : {}),
      ...(options?.voiceNote ? { voiceNote: options.voiceNote } : {}),
    };
    useChatStore.getState().addMessage(userMessage);

    // 生成本次 AI 响应的唯一 dataId，并作为 FastGPT responseChatItemId
    const responseId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 创建助手消息占位符（携带 dataId）
    const assistantMessage: ChatMessage = {
      AI: '',
      id: responseId
    };
    useChatStore.getState().addMessage(assistantMessage);

    // 读取用于 chatId 的会话 id（首条消息已创建会话时需要从最新状态获取）
    let sessionIdForChat: string | undefined;
    sessionIdForChat = activeSession?.id;

    // 仅发送本次输入的消息，不打包历史消息
    const chatMessages: OriginalChatMessage[] = [
      {
        id: `${Date.now()}-user`,
        role: 'user',
        content,
        timestamp: Date.now(),
        metadata: {
          ...(options?.attachments ? { attachments: options.attachments } : {}),
          ...(options?.voiceNote ? { voiceNote: options.voiceNote } : {}),
        },
      },
    ];

    // 透传 chatId 到后端（以会话 id 作为 chatId），保留其他 options
    const mergedOptions: ChatOptions | undefined = sessionIdForChat
      ? { ...options, chatId: sessionIdForChat, responseChatItemId: responseId }
      : { ...options, responseChatItemId: responseId };

    try {
      useChatStore.getState().setIsStreaming(true);

      if (preferences.streamingEnabled) {
        const controller = new AbortController();
        useChatStore.getState().setStreamAbortController(controller);
        // 流式响应
        await chatService.sendStreamMessage(
          currentAgent.id,
          chatMessages,
          {
            onChunk: (chunk) => {
              useChatStore.getState().updateLastMessage(chunk);
            },
            onStatus: (status) => {
              useChatStore.getState().setStreamingStatus(status);
            },
            onInteractive: (interactiveData) => {
              try {
                useChatStore.getState().addMessage({ interactive: interactiveData });
              } catch (e) {
                console.warn(t('处理 interactive 事件失败'), e, interactiveData);
              }
            },
            onChatId: () => {},
            signal: controller.signal,
          },
          mergedOptions
        );
      } else {
        // 非流式响应
        const response = await chatService.sendMessage(
          currentAgent.id,
          chatMessages,
          mergedOptions
        );

        const assistantContent = response.choices[0]?.message?.content || '';
        useChatStore.getState().updateLastMessage(assistantContent);
      }

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        useChatStore.getState().updateLastMessage(t('（生成已停止）'));
      } else {
        console.error(t('发送消息失败'), error);
        useChatStore.getState().updateLastMessage(t('抱歉，发送消息时出现错误。请稍后重试。'));
      }
    } finally {
      useChatStore.getState().setStreamAbortController(null);
      useChatStore.getState().setIsStreaming(false);
      useChatStore.getState().setStreamingStatus(null);
    }
  }, [t]);

  // 继续运行：交互节点-用户选择
  const continueInteractiveSelect = useCallback(async (value: string) => {
    await sendMessage(value);
  }, [sendMessage]);

  // 继续运行：交互节点-表单输入
  const continueInteractiveForm = useCallback(async (values: Record<string, any>) => {
    const content = JSON.stringify(values);
    await sendMessage(content);
  }, [sendMessage]);

  return {
    sendMessage,
    continueInteractiveSelect,
    continueInteractiveForm,
  };
};