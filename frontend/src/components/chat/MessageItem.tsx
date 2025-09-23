import React, { useState } from 'react';
import { User, Bot, Copy, Check, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { ChatMessage, Agent, StreamStatus } from '@/types';
import 'highlight.js/styles/github-dark.css';

interface MessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onRetry?: () => void;
  onEdit?: (content: string) => void;
  onDelete?: () => void;
  currentAgent?: Agent;
  streamingStatus?: StreamStatus;
}

export const MessageItem: React.FC<MessageItemProps> = ({ 
  message, 
  isStreaming = false,
  onRetry,
  onEdit,
  onDelete,
  currentAgent,
  streamingStatus
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
                  const match = /language-(\\w+)/.exec(className || '');
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
            
            {/* 在气泡内部渲染 FastGPT 状态面板（替代原三点动画） */}
            {isStreaming && currentAgent?.provider === 'fastgpt' && (
              <div className="flex justify-start mt-2">
                <div className="flex items-center space-x-2 px-4 py-2 rounded-lg shadow-sm border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  {/* 简单的“流程节点”图标 */}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <circle cx="6" cy="12" r="2"></circle>
                    <circle cx="12" cy="6" r="2"></circle>
                    <circle cx="18" cy="12" r="2"></circle>
                    <path d="M8 12h4M14 10l2-2M14 12h2"></path>
                  </svg>
                  {/* 三点动画 */}
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-sm"></span>
                  {streamingStatus?.type === 'flowNodeStatus' && (
                    <>
                      <span className="text-sm font-medium">{streamingStatus.moduleName || '未知模块'}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-1 ${
                        streamingStatus.status === 'error'
                          ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          : (streamingStatus.status === 'completed'
                              ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300')
                      }`}>
                        {streamingStatus.status || 'running'}
                      </span>
                    </>
                  )}
                </div>
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