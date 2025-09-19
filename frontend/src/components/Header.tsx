import React from 'react';
import { Menu } from 'lucide-react';
import { AgentSelector } from './agents/AgentSelector';
import { ThemeToggle } from './theme/ThemeToggle';
import { useChatStore } from '@/store/chatStore';

export const Header: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useChatStore();

  return (
    <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 sticky top-0 z-40">
      <div className="flex items-center justify-between max-w-none">
        {/* 左侧：菜单、智能体选择器 */}
        <div className="flex items-center gap-2 md:gap-4 flex-1">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            aria-label="切换侧边栏"
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-300" />
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