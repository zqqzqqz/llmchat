import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Square } from 'lucide-react';
import { ChatInputProps } from '@/types';

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
    console.log('文件上传功能待实现');
  };

  const handleVoiceRecord = () => {
    // TODO: 实现语音记录功能
    setIsRecording(!isRecording);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg">
      <form onSubmit={handleSubmit} className="flex items-end gap-3 p-4">
        {/* 附件按钮 */}
        <button
          type="button"
          onClick={handleFileUpload}
          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
            transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          title="附件"
        >
          <Paperclip className="h-5 w-5" />
        </button>

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
            className="w-full resize-none bg-transparent text-gray-900 dark:text-white 
              placeholder-gray-500 dark:placeholder-gray-400 border-0 outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
            style={{ minHeight: '20px', maxHeight: '200px' }}
          />
        </div>

        {/* 右侧按钮组 */}
        <div className="flex items-center gap-2">
          {/* 语音记录按钮 */}
          <button
            type="button"
            onClick={handleVoiceRecord}
            className={`flex-shrink-0 p-2 transition-colors rounded-lg ${
              isRecording
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={isRecording ? '停止录音' : '语音输入'}
          >
            {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {/* 发送按钮 */}
          <button
            type="submit"
            disabled={disabled || !message.trim()}
            className={`flex-shrink-0 p-3 rounded-xl transition-all duration-200 ${
              disabled || !message.trim()
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
            }`}
            title="发送消息 (Enter)"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </form>
      
      {/* 提示文本 */}
      <div className="px-4 pb-3 text-xs text-gray-500 dark:text-gray-400 text-center">
        按 Enter 发送，Shift + Enter 换行
      </div>
    </div>
  );
};