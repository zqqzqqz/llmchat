import React from 'react';
import { User, Bot } from 'lucide-react';
import { ChatMessage } from '@/types';

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  isStreaming = false 
}) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-primary 
          flex items-center justify-center">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      
      <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
        isUser 
          ? 'bg-accent-primary text-white' 
          : 'bg-bg-secondary text-text-primary border border-border-primary'
      }`}>
        <div className="whitespace-pre-wrap break-words">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
          )}
        </div>
        
        {message.metadata && (
          <div className="text-xs mt-2 opacity-70">
            {message.metadata.model && (
              <span>模型: {message.metadata.model}</span>
            )}
            {message.metadata.tokens && (
              <span className="ml-2">令牌: {message.metadata.tokens}</span>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-bg-tertiary 
          flex items-center justify-center">
          <User className="h-4 w-4 text-text-secondary" />
        </div>
      )}
    </div>
  );
};