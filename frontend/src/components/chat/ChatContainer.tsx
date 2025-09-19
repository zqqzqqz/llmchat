import React from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChatStore } from '@/store/chatStore';
import { useChat } from '@/hooks/useChat';
import { Bot, Sparkles } from 'lucide-react';

export const ChatContainer: React.FC = () => {
  const { messages, currentAgent, isStreaming, currentSession } = useChatStore();
  const { sendMessage } = useChat();

  // 无智能体时的提示界面
  if (!currentAgent) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl 
            flex items-center justify-center">
            <Bot className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
            欢迎使用 LLMChat
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            请选择一个智能体开始您的对话之旅
          </p>
        </div>
      </div>
    );
  }

  // 无消息时的欢迎界面
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-2xl">
            <div className="w-20 h-20 mx-auto mb-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl 
              flex items-center justify-center shadow-lg">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              与 {currentAgent.name} 对话
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              {currentAgent.description}
            </p>
            
            {/* 示例提示 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 
                hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                onClick={() => sendMessage('你好，请介绍一下你的能力')}
              >
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  👋 介绍与能力
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  了解智能体的功能与特点
                </p>
              </div>
              
              <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 
                hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                onClick={() => sendMessage('你能帮我做什么？')}
              >
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  ❓ 探索功能
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  发现更多实用功能
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* 输入区域 */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
          <div className="max-w-4xl mx-auto">
            <MessageInput
              onSendMessage={sendMessage}
              disabled={isStreaming}
              placeholder={`与 ${currentAgent.name} 对话...`}
            />
          </div>
        </div>
      </div>
    );
  }

  // 有消息时的正常聊天界面
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} isStreaming={isStreaming} />
      </div>
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <MessageInput
            onSendMessage={sendMessage}
            disabled={isStreaming}
            placeholder={`与 ${currentAgent.name} 对话...`}
          />
        </div>
      </div>
    </div>
  );
};