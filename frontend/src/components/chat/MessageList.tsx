import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '@/types';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isStreaming = false 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-text-secondary">
          <div className="text-lg mb-2">开始对话</div>
          <div className="text-sm">发送消息开始与智能体对话</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={scrollRef}
      className="h-full overflow-y-auto p-4 space-y-4"
    >
      {messages.map((message, index) => (
        <MessageItem 
          key={message.id} 
          message={message}
          isStreaming={isStreaming && index === messages.length - 1}
        />
      ))}
    </div>
  );
};