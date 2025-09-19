import React, { useState } from 'react';
import { User, Bot, Copy, Check, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { ChatMessage } from '@/types';
import 'highlight.js/styles/github-dark.css';

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onRetry?: () => void;
  onEdit?: (content: string) => void;
  onDelete?: () => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  isStreaming = false,
  onRetry,
  onEdit,
  onDelete
}) => {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);
  
  // huihua.md 格式：检查是用户消息还是 AI 消息
  const isUser = message.HUMAN !== undefined;
  const isAssistant = message.AI !== undefined;
  const content = isUser ? message.HUMAN : message.AI;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const formatTime = () => {
    return new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 用户消息样式
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex items-start gap-3 max-w-[80%]">
          <div className="bg-blue-500 text-white rounded-2xl px-4 py-3 shadow-sm">
            <div className="whitespace-pre-wrap break-words">
              {content}
            </div>
            <div className="text-xs text-blue-100 mt-2 text-right">
              {formatTime()}
            </div>
          </div>
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>
    );
  }

  // 助手消息样式
  return (
    <div className="flex justify-start">
      <div className="flex items-start gap-3 max-w-[80%] w-full">
        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full 
          flex items-center justify-center flex-shrink-0">
          <Bot className="h-4 w-4 text-white" />
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-200 dark:border-gray-700 flex-1">
          {/* 消息内容 */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              rehypePlugins={[rehypeHighlight, rehypeRaw]}
              components={{
                code: ({ className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const isBlock = match && className;
                  
                  if (isBlock) {
                    return (
                      <div className="relative group">
                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigator.clipboard.writeText(String(children))}
                            className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="bg-gray-900 rounded-lg overflow-x-auto p-4 text-sm">
                          <code className={className}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    );
                  }
                  
                  return (
                    <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
            
            {/* 流式指示器 */}
            {isStreaming && (
              <div className="flex items-center mt-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse ml-1" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse ml-1" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
          </div>
          
          {/* 消息元数据 */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatTime()}</span>
            </div>
            
            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="复制"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
              
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="重新生成"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              
              <button
                onClick={() => setLiked(liked === true ? null : true)}
                className={`p-1 transition-colors ${
                  liked === true 
                    ? 'text-green-500' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title="点赞"
              >
                <ThumbsUp className="h-4 w-4" />
              </button>
              
              <button
                onClick={() => setLiked(liked === false ? null : false)}
                className={`p-1 transition-colors ${
                  liked === false 
                    ? 'text-red-500' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title="点踩"
              >
                <ThumbsDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};