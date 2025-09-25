import React from 'react';
import { Menu } from 'lucide-react';
import { AgentSelector } from './agents/AgentSelector';
import { ThemeToggle } from './theme/ThemeToggle';
import { useChatStore } from '@/store/chatStore';

export const Header: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useChatStore();

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/90 border-b border-border/50 px-4 py-3">
      <div className="flex items-center justify-between max-w-none">
        {/* 左侧：菜单、智能体选择器 */}
        <div className="flex items-center gap-2 md:gap-4 flex-1">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-3 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md border border-white/30 hover:from-white/25 hover:to-white/10 transition-all duration-500 shadow-xl hover:shadow-2xl focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label="切换侧边栏"
          >
            <Menu className="h-5 w-5 text-[#6cb33f] drop-shadow-sm" />
          </button>
          
          {/* 智能体选择器 */}
          <div className="flex-1 max-w-md">
            <AgentSelector />
          </div>
        </div>

        {/* 右侧：主题切换 */}
        <div className="flex items-center">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};