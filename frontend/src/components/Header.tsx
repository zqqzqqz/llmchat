import React from 'react';
import { Menu } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { AgentSelector } from './agents/AgentSelector';
import { ThemeToggle } from './theme/ThemeToggle';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useChatStore } from '@/store/chatStore';
import { useI18n } from '@/i18n';

export const Header: React.FC = () => {
  const { sidebarOpen, setSidebarOpen } = useChatStore();
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/90 border-b border-border/50 px-4 py-3">
      <div className="flex items-center justify-between max-w-none">
        {/* 左侧：菜单、智能体选择器 */}
        <div className="flex items-center gap-2 md:gap-4 flex-1">
          <IconButton
            onClick={() => setSidebarOpen(!sidebarOpen)}
            variant="glass"
            radius="lg"
            aria-label={t('切换侧边栏')}
          >
            <Menu className="h-5 w-5 text-brand drop-shadow-sm" />
          </IconButton>
          
          {/* 智能体选择器 */}
          <div className="flex-1 max-w-md">
            <AgentSelector />
          </div>
        </div>

        {/* 右侧：主题切换 */}
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};