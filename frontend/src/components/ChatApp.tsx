import React from 'react';
import { Header } from './Header';
import { ChatContainer } from './chat/ChatContainer';
import { useChatStore } from '@/store/chatStore';

export const ChatApp: React.FC = () => {
  const { currentAgent, messages, isStreaming } = useChatStore();

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 overflow-hidden">
        <ChatContainer />
      </main>
    </div>
  );
};