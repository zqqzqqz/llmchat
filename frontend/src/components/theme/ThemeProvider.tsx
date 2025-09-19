import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeMode } from '@/types';
import { useChatStore } from '@/store/chatStore';

interface ThemeContextType {
  theme: 'light' | 'dark';
  userPreference: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  isAutoMode: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 主题上下文的Hook
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'auto'
}) => {
  const { preferences, updatePreferences } = useChatStore();
  const [theme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [autoUpdateInterval, setAutoUpdateInterval] = useState<NodeJS.Timeout | null>(null);

  const userPreference = preferences.theme.userPreference;
  const isAutoMode = userPreference === 'auto';

  // 初始化主题
  useEffect(() => {
    updateTheme(userPreference);
    setupAutoUpdate();
    
    return () => {
      if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
      }
    };
  }, []);

  // 监听用户偏好变化
  useEffect(() => {
    updateTheme(userPreference);
    setupAutoUpdate();
  }, [userPreference]);

  // 设置自动更新定时器
  const setupAutoUpdate = () => {
    if (autoUpdateInterval) {
      clearInterval(autoUpdateInterval);
    }
    
    if (userPreference === 'auto') {
      // 每分钟检查一次时间，用于自动切换主题
      const interval = setInterval(() => {
        updateTheme('auto');
      }, 60000);
      setAutoUpdateInterval(interval);
    }
  };

  const updateTheme = (preference: ThemeMode) => {
    if (preference === 'auto') {
      const now = new Date();
      const hour = now.getHours();
      const minutes = now.getMinutes();
      const currentTime = hour * 60 + minutes;
      
      // 使用用户设置的时间或默认时间
      const lightStart = parseTime(preferences.autoThemeSchedule.lightModeStart); // 默认 6:00
      const darkStart = parseTime(preferences.autoThemeSchedule.darkModeStart);   // 默认 18:00
      
      const isDarkTime = currentTime >= darkStart || currentTime < lightStart;
      setCurrentTheme(isDarkTime ? 'dark' : 'light');
    } else {
      setCurrentTheme(preference);
    }
  };

  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const toggleTheme = () => {
    const themes: ThemeMode[] = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(userPreference);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    
    updatePreferences({
      theme: {
        ...preferences.theme,
        userPreference: nextTheme,
        isAutoMode: nextTheme === 'auto',
        mode: nextTheme === 'auto' ? preferences.theme.mode : nextTheme
      }
    });
  };

  const setTheme = (newTheme: ThemeMode) => {
    updatePreferences({
      theme: {
        ...preferences.theme,
        userPreference: newTheme,
        isAutoMode: newTheme === 'auto',
        mode: newTheme === 'auto' ? preferences.theme.mode : newTheme
      }
    });
  };

  // 应用主题到DOM
  useEffect(() => {
    const root = document.documentElement;
    
    // 移除所有主题类
    root.classList.remove('light', 'dark');
    
    // 添加当前主题类
    root.classList.add(theme);
    
    // 设置data属性（兼容某些UI库）
    root.setAttribute('data-theme', theme);
    
    // 更新meta标签（移动端状态栏）
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#111827' : '#ffffff');
    } else {
      // 如果不存在，创建一个
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.content = theme === 'dark' ? '#111827' : '#ffffff';
      document.head.appendChild(meta);
    }
  }, [theme]);

  // 监听系统主题变化（当用户在操作系统中切换主题时）
  useEffect(() => {
    if (userPreference === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        if (userPreference === 'auto') {
          updateTheme('auto');
        }
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [userPreference]);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      userPreference, 
      toggleTheme, 
      setTheme, 
      isAutoMode 
    }}>
      <div className={`min-h-screen transition-colors duration-300 ${
        theme === 'dark' ? 'dark' : ''
      }`}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
};