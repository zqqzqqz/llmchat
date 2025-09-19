import React, { useEffect, useRef } from 'react';
import { ChevronDown, Bot, Wifi, WifiOff } from 'lucide-react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAgentSelectorOpen(false);
      }
    };

    if (agentSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [agentSelectorOpen, setAgentSelectorOpen]);

  const handleAgentSelect = (agent: any) => {
    setCurrentAgent(agent);
    setAgentSelectorOpen(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Wifi className="h-3 w-3 text-green-500" />;
      case 'inactive':
        return <WifiOff className="h-3 w-3 text-gray-400" />;
      case 'error':
        return <WifiOff className="h-3 w-3 text-red-500" />;
      default:
        return <div className="h-3 w-3 bg-gray-400 rounded-full animate-pulse" />;
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'fastgpt':
        return 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/20';
      case 'openai':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      case 'anthropic':
        return 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20';
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setAgentSelectorOpen(!agentSelectorOpen)}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm min-w-0
          bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700
          border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600
          text-gray-900 dark:text-white transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
          disabled:opacity-50 disabled:cursor-not-allowed
          max-w-full sm:max-w-xs lg:max-w-sm"
        disabled={loading}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Bot className="h-4 w-4 flex-shrink-0 text-blue-500" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">
              {currentAgent?.name || '选择智能体'}
            </div>
            {currentAgent && (
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                {getStatusIcon(currentAgent.status)}
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getProviderColor(currentAgent.provider)}`}>
                  {currentAgent.provider}
                </span>
              </div>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200 ${
          agentSelectorOpen ? 'rotate-180' : ''
        }`} />
      </button>

      {agentSelectorOpen && (
        <>
          {/* 移动端全屏遵罩 */}
          <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" 
            onClick={() => setAgentSelectorOpen(false)} />
          
          {/* 下拉菜单 */}
          <div className="absolute top-full left-0 right-0 mt-2 z-50
            lg:right-auto lg:w-80 
            bg-white dark:bg-gray-800 
            border border-gray-200 dark:border-gray-700 
            rounded-xl shadow-lg 
            animate-slide-down">
            
            {/* 标题 */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-gray-900 dark:text-white">选择智能体</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                切换到不同的AI助手
              </p>
            </div>
            
            {/* 智能体列表 */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center">
                  <div className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    加载中...
                  </div>
                </div>
              ) : agents.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  暂无可用的智能体
                </div>
              ) : (
                <div className="py-2">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => handleAgentSelect(agent)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700
                        transition-colors duration-150 flex items-start gap-3 ${
                        currentAgent?.id === agent.id 
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500' 
                          : ''
                      }`}
                    >
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full 
                        flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {agent.name}
                          </span>
                          {currentAgent?.id === agent.id && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                          {agent.description}
                        </p>
                        
                        <div className="flex items-center gap-2 text-xs">
                          {getStatusIcon(agent.status)}
                          <span className={`px-2 py-1 rounded-full font-medium ${getProviderColor(agent.provider)}`}>
                            {agent.provider}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {agent.model}
                          </span>
                        </div>
                        
                        {/* 能力标签 */}
                        {agent.capabilities && agent.capabilities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {agent.capabilities.slice(0, 3).map((capability) => (
                              <span key={capability} 
                                className="inline-block px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 
                                  text-gray-600 dark:text-gray-400 rounded">
                                {capability}
                              </span>
                            ))}
                            {agent.capabilities.length > 3 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                +{agent.capabilities.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};