import { useState, useCallback, useRef } from 'react';
import { agentService } from '@/services/api';
import { useChatStore } from '@/store/chatStore';

import { useI18n } from '@/i18n';


export const useAgents = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { t } = useI18n();
  
  const { 
    setAgents, 
    setAgentsLoading, 
    setAgentsError,
    setCurrentAgent,
    currentAgent 
  } = useChatStore();

  const fetchAgents = useCallback(async () => {
    // 取消上一次请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    setAgentsLoading(true);
    setError(null);
    setAgentsError(null);

    try {
      const fetchedAgents = await agentService.getAgents();

      const hasProductPreview = fetchedAgents.some((agent) => agent.id === PRODUCT_PREVIEW_AGENT_ID);
      const hasVoiceCall = fetchedAgents.some((agent) => agent.id === VOICE_CALL_AGENT_ID);
      const agents = [
        ...fetchedAgents,
        ...(hasProductPreview ? [] : [PRODUCT_PREVIEW_AGENT]),
        ...(hasVoiceCall ? [] : [VOICE_CALL_AGENT]),
      ];
      
      // 检查请求是否被取消
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }
      
      setAgents(agents);
      
      // 如果没有当前智能体，自动选择第一个可用的
      if (!currentAgent && agents.length > 0) {
        const firstActive = agents.find(agent => agent.status === 'active') || agents[0];
        if (firstActive) {
          setCurrentAgent(firstActive);
        }
      }
    } catch (err) {
      // 如果是取消操作，不处理错误
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : t('获取智能体列表失败');
      setError(errorMessage);
      setAgentsError(errorMessage);
    } finally {
      setLoading(false);
      setAgentsLoading(false);
    }
  }, [currentAgent, setAgents, setAgentsLoading, setAgentsError, setCurrentAgent, t]);

  return {
    loading,
    error,
    fetchAgents,
  };
};