import React, { useEffect } from 'react';
import { ChevronDown, Bot } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { useAgents } from '@/hooks/useAgents';

export const AgentSelector: React.FC = () => {
  const { 
    agents, 
    currentAgent, 
    agentSelectorOpen,
    setCurrentAgent,
    setAgentSelectorOpen 
  } = useChatStore();
  
  const { fetchAgents, loading } = useAgents();

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleAgentSelect = (agent: any) => {
    setCurrentAgent(agent);
    setAgentSelectorOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setAgentSelectorOpen(!agentSelectorOpen)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm
          bg-bg-tertiary hover:bg-accent-primary/10 
          border border-border-primary hover:border-accent-primary
          text-text-primary hover:text-accent-primary
          transition-all duration-200"
        disabled={loading}
      >
        <Bot className="h-4 w-4" />
        <span>{currentAgent?.name || '选择智能体'}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {agentSelectorOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-bg-primary 
          border border-border-primary rounded-lg shadow-lg z-50">
          <div className="p-2">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleAgentSelect(agent)}
                className="w-full text-left p-2 rounded hover:bg-bg-secondary
                  transition-colors duration-150"
              >
                <div className="font-medium text-text-primary">{agent.name}</div>
                <div className="text-xs text-text-secondary">{agent.description}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className={`h-2 w-2 rounded-full ${
                    agent.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  <span className="text-xs text-text-tertiary">{agent.provider}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};