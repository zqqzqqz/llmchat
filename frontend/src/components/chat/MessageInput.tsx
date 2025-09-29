import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { ChatInputProps } from '@/types';
import { debugLog } from '@/lib/debug';

export const MessageInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = '输入消息...',
}) => {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 200) + 'px';
    }
  }, [message]);

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

  const handleFileUpload = () => {
    // TODO: 实现文件上传功能
    debugLog('文件上传功能待实现');
  };

  const handleVoiceRecord = () => {
    // TODO: 实现语音记录功能
    setIsRecording(!isRecording);
  };

  return (
    <div className="bg-background rounded-2xl border border-border/50 shadow-2xl backdrop-blur-md">
      <form onSubmit={handleSubmit} className="flex items-end gap-3 p-4">
        {/* 附件按钮 */}
        <IconButton
          type="button"
          onClick={handleFileUpload}
          variant="glass"
          radius="md"
          className="flex-shrink-0"
          title="附件"
        >
          <Paperclip className="h-5 w-5" />
        </IconButton>

        {/* 文本输入区域 */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full resize-none bg-transparent text-foreground
              placeholder-muted-foreground border-0 outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              scrollbar-thin scrollbar-thumb-muted"
            style={{ minHeight: '20px', maxHeight: '200px' }}
          />
        </div>

        {/* 右侧按钮组 */}
        <div className="flex items-center gap-2">
          {/* 语音记录按钮 */}
          <IconButton
            type="button"
            onClick={handleVoiceRecord}
            variant="ghost"
            radius="md"
            className={`flex-shrink-0 ${
              isRecording
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
            }`}
            title={isRecording ? '停止录音' : '语音输入'}
          >
            {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </IconButton>

          {/* 发送按钮 */}
          <Button
            type="submit"
            disabled={disabled || !message.trim()}
            variant="brand"
            size="icon"
            radius="md"
            title="发送消息 (Enter)"
            className={`${disabled || !message.trim() ? '' : 'shadow-xl hover:shadow-2xl transform hover:scale-105'}`}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </form>
      
      {/* 移除输入提示文案 */}
    </div>
  );
};