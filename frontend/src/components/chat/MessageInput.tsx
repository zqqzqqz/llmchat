import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { ChatInputProps } from '@/types';

export const MessageInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = '输入消息...',
}) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="flex-1">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full resize-none rounded-lg border border-border-primary 
            bg-bg-secondary px-4 py-3 text-text-primary placeholder-text-tertiary
            focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className="flex items-center justify-center w-12 h-12 rounded-lg
          bg-accent-primary text-white hover:bg-accent-secondary
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors duration-200"
      >
        <Send className="h-5 w-5" />
      </button>
    </form>
  );
};