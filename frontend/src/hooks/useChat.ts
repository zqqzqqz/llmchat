import { useCallback } from 'react';
import { chatService } from '@/services/api';
import { useChatStore } from '@/store/chatStore';
import { ChatMessage, ChatOptions, OriginalChatMessage, convertFromHuihuaFormat } from '@/types';

export const useChat = () => {
  const {
    currentAgent,
    messages,
    preferences,
    currentSession,
    addMessage,
    updateLastMessage,
    setIsStreaming,
    setStreamingStatus,
    createNewSession,  // 新的创建会话方法
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
            console.log('收到 chatId 事件:', cid);
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
    setIsStreaming,
    setStreamingStatus,
    createNewSession,
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

  return {
    sendMessage,
    continueInteractiveSelect,
    continueInteractiveForm,
  };
};