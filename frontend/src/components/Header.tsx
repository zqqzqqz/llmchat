import React from 'react';
import { AgentSelector } from './agents/AgentSelector';
import { ThemeToggle } from './theme/ThemeToggle';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-border-primary bg-bg-secondary px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-text-primary">LLMChat</h1>
          <AgentSelector />
        </div>
        <div className="flex items-center space-x-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};