import { useState, useCallback } from 'react';
import { agentService } from '@/services/api';
import { useChatStore } from '@/store/chatStore';

export const useAgents = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { 
    setAgents, 
    setAgentsLoading, 
    setAgentsError,
    setCurrentAgent,
    currentAgent 
  } = useChatStore();

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setAgentsLoading(true);
    setError(null);
    setAgentsError(null);

    try {
      const agents = await agentService.getAgents();
      setAgents(agents);
      
      // 如果没有当前智能体，自动选择第一个可用的
      if (!currentAgent && agents.length > 0) {
        const firstActive = agents.find(agent => agent.status === 'active');
        if (firstActive) {
          setCurrentAgent(firstActive);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取智能体列表失败';
      setError(errorMessage);
      setAgentsError(errorMessage);
    } finally {
      setLoading(false);
      setAgentsLoading(false);
    }
  }, [currentAgent, setAgents, setAgentsLoading, setAgentsError, setCurrentAgent]);

  return {
    loading,
    error,
    fetchAgents,
  };
};