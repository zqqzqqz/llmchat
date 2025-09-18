import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeMode, ThemeConfig } from '@/types';

interface ThemeContextType {
  theme: 'light' | 'dark';
  userPreference: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'auto'
}) => {
  const [theme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [userPreference, setUserPreference] = useState<ThemeMode>(defaultTheme);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as ThemeMode;
    if (savedTheme) {
      setUserPreference(savedTheme);
    }
    updateTheme(savedTheme || defaultTheme);
  }, []);

  useEffect(() => {
    updateTheme(userPreference);
  }, [userPreference]);

  const updateTheme = (preference: ThemeMode) => {
    if (preference === 'auto') {
      const hour = new Date().getHours();
      setCurrentTheme(hour >= 6 && hour < 18 ? 'light' : 'dark');
    } else {
      setCurrentTheme(preference);
    }
  };

  const toggleTheme = () => {
    const themes: ThemeMode[] = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(userPreference);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    setUserPreference(nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  const setTheme = (newTheme: ThemeMode) => {
    setUserPreference(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, userPreference, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};