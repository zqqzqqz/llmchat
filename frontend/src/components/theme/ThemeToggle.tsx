import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export const ThemeToggle: React.FC = () => {
  const { userPreference, toggleTheme } = useTheme();

  const getIcon = () => {
    switch (userPreference) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'auto':
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getLabel = () => {
    switch (userPreference) {
      case 'light':
        return '浅色模式';
      case 'dark':
        return '深色模式';
      case 'auto':
        return '自动模式';
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm
        bg-bg-tertiary hover:bg-accent-primary/10 
        border border-border-primary hover:border-accent-primary
        text-text-secondary hover:text-accent-primary
        transition-all duration-200"
      title={getLabel()}
    >
      {getIcon()}
      <span className="hidden sm:inline">{getLabel()}</span>
    </button>
  );
};