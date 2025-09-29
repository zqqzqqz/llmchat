import { useCallback } from 'react';
import { chatService } from '@/services/api';
import { useChatStore } from '@/store/chatStore';
import { ChatMessage, ChatOptions, OriginalChatMessage, convertFromHuihuaFormat } from '@/types';
import { parseReasoningPayload } from '@/lib/reasoning';
import { debugLog } from '@/lib/debug';
import { normalizeFastGPTEvent } from '@/lib/events';

export const useChat = () => {
  const {
    currentAgent,
    messages,
    preferences,
    currentSession,
    addMessage,
    updateLastMessage,
    updateMessageById,
    setIsStreaming,
    setStreamingStatus,
    createNewSession,  // 新的创建会话方法
    appendReasoningStep,
    finalizeReasoning,
    bindSessionId,
    appendAssistantEvent,
  } = useChatStore();

  const sendMessage = useCallback(async (
    content: string,
    options?: ChatOptions
  ) => {
    if (!currentAgent) {
      throw new Error('没有选择智能体');
    }

    // 如果没有当前会话，创建一个（huihua.md 要求）
    if (!currentSession) {
      createNewSession();
    }

    // 添加用户消息（按 huihua.md 格式）
    const userMessage: ChatMessage = {
      HUMAN: content
    };
    addMessage(userMessage);

    // 生成本次 AI 响应的唯一 dataId，并作为 FastGPT responseChatItemId
    const responseId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 创建助手消息占位符（携带 dataId）
    const assistantMessage: ChatMessage = {
      AI: '',
      id: responseId
    };
    addMessage(assistantMessage);

    // 读取用于 chatId 的会话 id（首条消息已创建会话时需要从最新状态获取）
    let sessionIdForChat: string | undefined;
    if (!currentSession) {
      const { currentSession: latestSession } = useChatStore.getState();
      sessionIdForChat = latestSession?.id;
    } else {
      sessionIdForChat = currentSession.id;
    }

    // 仅发送本次输入的消息，不打包历史消息
    const chatMessages: OriginalChatMessage[] = convertFromHuihuaFormat([userMessage]);

    // 透传 chatId 到后端（以会话 id 作为 chatId），保留其他 options
    const mergedOptions: ChatOptions | undefined = sessionIdForChat
      ? { ...options, chatId: sessionIdForChat, responseChatItemId: responseId }
      : { ...options, responseChatItemId: responseId };

    try {
      setIsStreaming(true);
      
      if (preferences.streamingEnabled) {
        // 流式响应
        await chatService.sendStreamMessage(
          currentAgent.id,
          chatMessages,
          (chunk) => {
            updateLastMessage(chunk);
          },
          (status) => {
            setStreamingStatus(status);
            if (status?.type === 'complete' || status?.type === 'error') {
              finalizeReasoning();
            }
          },
          mergedOptions,
          // onInteractive: 收到交互节点后，新增一条交互气泡
          (interactiveData) => {
            try {
              // 直接以交互数据作为一条新消息渲染
              addMessage({ interactive: interactiveData });
            } catch (e) {
              console.warn('处理 interactive 事件失败:', e, interactiveData);
            }
          },
          // onChatId: 可选记录
          (cid) => {
            if (cid && sessionIdForChat) {
              bindSessionId(sessionIdForChat, cid);
            }
          },
          (reasoningEvent) => {
            const parsed = parseReasoningPayload(reasoningEvent);
            if (!parsed) return;

            parsed.steps.forEach((step) => appendReasoningStep(step));

            if (parsed.finished) {
              finalizeReasoning(parsed.totalSteps);
            }
          },
          (eventName, payload) => {
            const normalized = normalizeFastGPTEvent(eventName, payload);
            if (!normalized) return;
            appendAssistantEvent(normalized);
          }
        );
      } else {
        // 非流式响应
        const response = await chatService.sendMessage(
          currentAgent.id,
          chatMessages,
          mergedOptions
        );
        
        const assistantContent = response.choices[0]?.message?.content || '';
        updateLastMessage(assistantContent);
      }
      
    } catch (error) {
      console.error('发送消息失败:', error);
      updateLastMessage('抱歉，发送消息时出现错误。请稍后重试。');
    } finally {
      setIsStreaming(false);
      setStreamingStatus(null);
    }
  }, [
    currentAgent,
    messages,
    preferences.streamingEnabled,
    currentSession,
    addMessage,
    updateLastMessage,
    updateMessageById,
    setIsStreaming,
    setStreamingStatus,
    createNewSession,
    appendReasoningStep,
    finalizeReasoning,
    bindSessionId,
    appendAssistantEvent,
  ]);

  // 继续运行：交互节点-用户选择
  const continueInteractiveSelect = useCallback(async (value: string) => {
    await sendMessage(value);
  }, [sendMessage]);

  // 继续运行：交互节点-表单输入
  const continueInteractiveForm = useCallback(async (values: Record<string, any>) => {
    const content = JSON.stringify(values);
    await sendMessage(content);
  }, [sendMessage]);

  const retryMessage = useCallback(async (messageId: string) => {
    if (!currentAgent || !currentSession) {
      throw new Error('没有选择智能体或会话');
    }

    const targetMessage = messages.find((msg) => msg.id === messageId);
    if (!targetMessage) {
      throw new Error('未找到需要重新生成的消息');
    }

    updateMessageById(messageId, (prev) => ({ ...prev, AI: '', reasoning: undefined }));

    try {
      setIsStreaming(true);

      if (preferences.streamingEnabled) {
        await chatService.retryStreamMessage(
          currentAgent.id,
          currentSession.id,
          messageId,
          (chunk) => {
            updateMessageById(messageId, (prev) => ({ ...prev, AI: `${prev.AI || ''}${chunk}` }));
          },
          (status) => {
            setStreamingStatus(status);
            if (status?.type === 'complete' || status?.type === 'error') {
              finalizeReasoning();
            }
          },
          { detail: true },
          (interactiveData) => {
            try {
              addMessage({ interactive: interactiveData });
            } catch (e) {
              console.warn('处理 retry interactive 事件失败:', e, interactiveData);
            }
          },
          (cid) => {
            debugLog('重新生成消息使用 chatId:', cid);
          },
          (reasoningEvent) => {
            const parsed = parseReasoningPayload(reasoningEvent);
            if (!parsed) return;

            parsed.steps.forEach((step) => appendReasoningStep(step));

            if (parsed.finished) {
              finalizeReasoning(parsed.totalSteps);
            }
          },
          (eventName, payload) => {
            const normalized = normalizeFastGPTEvent(eventName, payload);
            if (!normalized) return;
            appendAssistantEvent(normalized);
          }
        );
      } else {
        const response = await chatService.retryMessage(currentAgent.id, currentSession.id, messageId, { detail: true });
        const assistantContent = response.choices[0]?.message?.content || '';
        updateMessageById(messageId, (prev) => ({ ...prev, AI: assistantContent }));
      }
    } catch (error) {
      console.error('重新生成消息失败:', error);
      updateMessageById(messageId, (prev) => ({ ...prev, AI: '抱歉，重新生成时出现错误。请稍后重试。' }));
    } finally {
      setIsStreaming(false);
      setStreamingStatus(null);
    }
  }, [
    currentAgent,
    currentSession,
    messages,
    preferences.streamingEnabled,
    updateMessageById,
    setIsStreaming,
    setStreamingStatus,
    appendReasoningStep,
    finalizeReasoning,
    addMessage,
    appendAssistantEvent,
  ]);

  return {
    sendMessage,
    continueInteractiveSelect,
    continueInteractiveForm,
    retryMessage,
  };
};