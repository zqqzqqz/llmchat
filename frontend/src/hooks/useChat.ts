import { useCallback } from 'react';
import { chatService } from '@/services/api';
import { useChatStore } from '@/store/chatStore';
import { ChatMessage, ChatOptions } from '@/types';

export const useChat = () => {
  const {
    currentAgent,
    messages,
    preferences,
    addMessage,
    updateLastMessage,
    setIsStreaming,
    setStreamingStatus,
  } = useChatStore();

  const sendMessage = useCallback(async (
    content: string,
    options?: ChatOptions
  ) => {
    if (!currentAgent) {
      throw new Error('没有选择智能体');
    }

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      metadata: {
        agentId: currentAgent.id,
      },
    };
    addMessage(userMessage);

    // 创建助手消息占位符
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      metadata: {
        agentId: currentAgent.id,
        model: currentAgent.model,
        provider: currentAgent.provider,
      },
    };
    addMessage(assistantMessage);

    const chatMessages = [...messages, userMessage];
    
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
          options
        );
      } else {
        // 非流式响应
        const response = await chatService.sendMessage(
          currentAgent.id,
          chatMessages,
          options
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
    addMessage,
    updateLastMessage,
    setIsStreaming,
    setStreamingStatus,
  ]);

  return {
    sendMessage,
  };
};