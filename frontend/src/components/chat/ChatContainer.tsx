import React from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChatStore } from '@/store/chatStore';
import { useChat } from '@/hooks/useChat';

export const ChatContainer: React.FC = () => {
  const { messages, currentAgent, isStreaming } = useChatStore();
  const { sendMessage } = useChat();

  if (!currentAgent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-text-secondary mb-2">请选择一个智能体开始对话</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} isStreaming={isStreaming} />
      </div>
      <div className="border-t border-border-primary p-4">
        <MessageInput
          onSendMessage={sendMessage}
          disabled={isStreaming}
          placeholder={`与 ${currentAgent.name} 对话...`}
        />
      </div>
    </div>
  );
};