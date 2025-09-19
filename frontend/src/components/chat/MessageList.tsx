import React, { useEffect, useRef, memo, useState } from 'react';
import { ChatMessage, Agent, StreamStatus } from '@/types';
import { MessageItem } from './MessageItem';
import { FastGPTStatusIndicator } from './FastGPTStatusIndicator';
import { useChatStore } from '@/store/chatStore';

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
}

export const MessageList: React.FC<MessageListProps> = memo(({ 
  messages, 
  isStreaming = false 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const { currentAgent, streamingStatus } = useChatStore();
  const [moduleHistory, setModuleHistory] = useState<StreamStatus[]>([]);

  // 追踪 FastGPT 流程节点历史
  useEffect(() => {
    if (streamingStatus && streamingStatus.type === 'flowNodeStatus') {
      setModuleHistory(prev => {
        // 避免重复添加相同模块
        const exists = prev.some(item => 
          item.moduleName === streamingStatus.moduleName && 
          item.status === streamingStatus.status
        );
        
        if (!exists) {
          return [...prev, streamingStatus];
        }
        return prev;
      });
    }
    
    // 清空历史（当不是流式传输时）
    if (!isStreaming && !streamingStatus) {
      setModuleHistory([]);
    }
  }, [streamingStatus, isStreaming]);

  // 自动滚动到底部
  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming]);

  return (
    <div 
      ref={scrollRef}
      className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900"
    >
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {messages.map((message, index) => {
            // huihua.md 格式没有 id，使用 index 作为 key
            const isLastMessage = index === messages.length - 1;
            const isAssistantMessage = message.AI !== undefined;
            
            return (
              <div key={index}>
                <MessageItem 
                  message={message}
                  isStreaming={isStreaming && isLastMessage && isAssistantMessage}
                />
                {/* 最后一个消息的占位元素 */}
                {isLastMessage && (
                  <div ref={lastMessageRef} className="h-1" />
                )}
              </div>
            );
          })}
          
          {/* FastGPT 特有状态显示 - 始终显示当选择 FastGPT 智能体时 */}
          {currentAgent && currentAgent.provider === 'fastgpt' && (
            <div className="fastgpt-status-wrapper">
              <FastGPTStatusIndicator
                isStreaming={isStreaming}
                currentStatus={streamingStatus || undefined}
                agent={currentAgent}
                moduleHistory={moduleHistory}
              />
            </div>
          )}
          
          {/* 标准流式传输指示器（非 FastGPT） */}
          {isStreaming && (!currentAgent || currentAgent.provider !== 'fastgpt') && (
            <div className="flex justify-start">
              <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">正在生成回答...</span>
              </div>
            </div>
          )}
          
          {/* 底部留白 */}
          <div className="h-20" />
        </div>
      </div>
    </div>
  );
});