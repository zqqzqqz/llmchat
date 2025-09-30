import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { ThemeMode } from '@/types';
import { useI18n } from '@/i18n';

interface ThemeToggleProps {
  variant?: 'icon' | 'button' | 'dropdown';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'button',
  size = 'md',
  showLabel = true
}) => {
  const { userPreference, theme, toggleTheme, setTheme, isAutoMode } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { t } = useI18n();

  const getIcon = (mode: ThemeMode) => {
    const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
    switch (mode) {
      case 'light':
        return <Sun className={iconSize} />;
      case 'dark':
        return <Moon className={iconSize} />;
      case 'auto':
        return <Monitor className={iconSize} />;
    }
  };

  const getLabel = (mode: ThemeMode) => {
    switch (mode) {
      case 'light':
        return t('浅色模式');
      case 'dark':
        return t('深色模式');
      case 'auto':
        return t('自动模式');
    }
  };

  const getCurrentModeText = () => {
    if (isAutoMode) {
      return t('自动 (当前: {mode})', {
        mode: theme === 'dark' ? t('深色模式') : t('浅色模式'),
      });
    }
    return getLabel(userPreference);
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  };

  // 简单图标按钮
  if (variant === 'icon') {
    return (
      <IconButton
        onClick={toggleTheme}
        variant="glass"
        radius="lg"
        className={`${sizeClasses[size]}`}
        title={getCurrentModeText()}
        aria-label={t('切换主题')}
      >
        {getIcon(userPreference)}
      </IconButton>
    );
  }

  // 下拉选择按钮
  if (variant === 'dropdown') {
    return (
      <div className="relative">
        <Button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          variant="secondary"
          size="md"
          radius="lg"
          className={`flex items-center gap-2 border border-white/30 bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md hover:from-white/25 hover:to-white/10 transition-all duration-500 shadow-xl hover:shadow-2xl ${sizeClasses[size]}`}
        >
          {getIcon(userPreference)}
          {showLabel && <span>{getCurrentModeText()}</span>}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>

        {dropdownOpen && (
          <>
            {/* 遵罩 */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setDropdownOpen(false)}
            />
            
            {/* 下拉菜单 */}
            <div className="absolute right-0 top-full mt-1 w-48 bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl z-20">
              <div className="py-1">
                {(['light', 'dark', 'auto'] as ThemeMode[]).map((mode) => (
                  <Button
                    key={mode}
                    onClick={() => {
                      setTheme(mode);
                      setDropdownOpen(false);
                    }}
                    variant="ghost"
                    size="md"
                    radius="md"
                    className={`w-full justify-start gap-3 px-4 py-2 text-left hover:bg-gradient-to-br hover:from-brand/15 hover:to-brand/5 transition-all duration-200 ${userPreference === mode ? 'bg-brand/10 text-foreground' : 'text-foreground' }`}
                  >
                      {getIcon(mode)}
                      <div>
                        <div className="font-medium">{getLabel(mode)}</div>
                        {mode === 'auto' && (
                          <div className="text-xs opacity-75">
                          {t('根据时间自动切换')}
                          </div>
                        )}
                      </div>
                    {userPreference === mode && (
                      <div className="ml-auto w-2 h-2 bg-brand rounded-full" />
                    )}
                  </Button>
                ))}
              </div>
              
              {isAutoMode && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {t('当前: {mode}', {
                      mode: theme === 'dark' ? t('深色模式') : t('浅色模式'),
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // 默认按钮样式
  return (
    <Button
      onClick={toggleTheme}
      variant="secondary"
      size="md"
      radius="lg"
      className={`flex items-center gap-2 border border-white/30 bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md hover:from-white/25 hover:to-white/10 transition-all duration-500 shadow-xl hover:shadow-2xl ${sizeClasses[size]}`}
      title={t('切换到 {mode}', {
        mode: getLabel(userPreference === 'light' ? 'dark' : userPreference === 'dark' ? 'auto' : 'light'),
      })}
      aria-label={t('切换主题')}
    >
      {getIcon(userPreference)}
      {showLabel && (
        <span className="hidden sm:inline">
          {getCurrentModeText()}
        </span>
      )}
    </Button>
  );
};

// 默认导出组件（兼容性）
export default ThemeToggle;