import React, { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ChatContainer } from './chat/ChatContainer';
import { useChatStore } from '@/store/chatStore';

export const ChatApp: React.FC = () => {
  const { sidebarOpen, initializeAgentSessions } = useChatStore();

  // huihua.md 要求 1：页面初始加载后检查
  useEffect(() => {
    initializeAgentSessions();
  }, [initializeAgentSessions]);

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* 侧边栏 */}
      <Sidebar />
      
      {/* 主内容区域 */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
        sidebarOpen ? 'lg:ml-0' : 'lg:ml-0'
      }`}>
        <Header />
        <main className="flex-1 overflow-hidden">
          <ChatContainer />
        </main>
      </div>
    </div>
  );
};