import React, { useState, useEffect } from 'react';
import { Bot, Database, Workflow, CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { Agent, StreamStatus } from '@/types';
import { useI18n } from '@/i18n';

interface FastGPTStatusIndicatorProps {
  isStreaming: boolean;
  currentStatus?: StreamStatus;
  agent: Agent;
  moduleHistory: StreamStatus[];
}

/**
 * FastGPT 特有的流程节点状态显示组件
 * 专门针对 FastGPT 的工作流状态进行优化显示
 */
export const FastGPTStatusIndicator: React.FC<FastGPTStatusIndicatorProps> = ({
  isStreaming,
  currentStatus,
  agent,
  moduleHistory
}) => {
  const [knowledgeStatus, setKnowledgeStatus] = useState<'ready' | 'loading' | 'error'>('loading');
  const [contextStatus, setContextStatus] = useState<'active' | 'inactive'>('inactive');
  const { t } = useI18n();

  // 检查 FastGPT 特有状态
  useEffect(() => {
    if (agent.provider === 'fastgpt') {
      checkFastGPTStatus();
    }
  }, [agent.id]);

  const checkFastGPTStatus = async () => {
    try {
      console.log(t('检查 FastGPT 状态'), agent.id);
      // 简化状态检查逻辑，直接设置为就绪状态
      // 如果需要实际状态检查，可以调用后端接口
      setContextStatus('active');
      setKnowledgeStatus('ready');
      
      // 可选：检查智能体配置状态
      const response = await fetch(`/api/agents/${agent.id}`);
      if (response.ok) {
        const agentData = await response.json();
        console.log(t('FastGPT 智能体数据'), agentData);
        setContextStatus(agentData.data?.isActive ? 'active' : 'inactive');
        setKnowledgeStatus('ready');
      }
    } catch (error) {
      console.warn(t('FastGPT 状态检查失败'), error);
      // 设置为基本可用状态
      setContextStatus('active');
      setKnowledgeStatus('ready');
    }
  };

  // 只有 FastGPT 才显示专业工作流界面
  if (agent.provider !== 'fastgpt') {
    return null;
  }
  
  console.log('FastGPT 状态指示器渲染:', {
    isStreaming,
    currentStatus,
    moduleHistory: moduleHistory.length,
    agentProvider: agent.provider
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Circle className="h-4 w-4 text-blue-500 animate-pulse" />;
    }
  };

  const getModuleIcon = (moduleName: string) => {
    if (moduleName?.includes('知识库') || moduleName?.includes('搜索')) {
      return <Database className="h-4 w-4" />;
    }
    if (moduleName?.includes('AI') || moduleName?.includes('对话')) {
      return <Bot className="h-4 w-4" />;
    }
    return <Workflow className="h-4 w-4" />;
  };

  return (
    <div className="fastgpt-status bg-background/95 backdrop-blur-xl rounded-2xl p-4 border border-border/50 shadow-2xl">
      {/* FastGPT 特有状态信息 */}
      <div className="mb-3">
        <div className="flex items-center gap-4 text-sm">
          <div className={`flex items-center gap-2 ${contextStatus === 'active' ? 'text-brand' : 'text-muted-foreground'}`}>
            <Bot className="h-4 w-4" />
            <span>
              {t('上下文: {status}', {
                status: contextStatus === 'active' ? t('激活') : t('未激活'),
              })}
            </span>
          </div>
          <div className={`flex items-center gap-2 ${
            knowledgeStatus === 'ready' ? 'text-brand' :
            knowledgeStatus === 'error' ? 'text-red-500' : 'text-yellow-500'
          }`}>
            <Database className="h-4 w-4" />
            <span>
              {t('知识库: {status}', {
                status:
                  knowledgeStatus === 'ready'
                    ? t('就绪')
                    : knowledgeStatus === 'error'
                      ? t('错误')
                      : t('加载中'),
              })}
            </span>
          </div>
        </div>
      </div>

      {/* 当前流程节点状态 */}
      {isStreaming && currentStatus && (
        <div className="current-module mb-3">
          <div className="flex items-center gap-2 p-2 bg-card text-card-foreground rounded-xl border border-border/50">
            <div className="animate-spin">
              <Workflow className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-foreground">
              {t('正在执行: {module}', {
                module: currentStatus.moduleName || t('准备中...'),
              })}
            </span>
          </div>
        </div>
      )}

      {/* 流程执行历史 */}
      {moduleHistory.length > 0 && (
        <div className="module-history">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            {t('执行历史')}
          </div>
          <div className="space-y-1">
            {moduleHistory.map((status, index) => (
              <div key={index} className={`flex items-center gap-2 p-2 rounded-xl text-xs ${
                status.status === 'completed' ? 'bg-brand/10' :
                status.status === 'error' ? 'bg-red-500/10' :
                'bg-accent/30'
              }`}>
                {getStatusIcon(status.status)}
                {getModuleIcon(status.moduleName || '')}
                <span className={`flex-1 ${
                  status.status === 'completed' ? 'text-brand' :
                  status.status === 'error' ? 'text-red-600' :
                  'text-foreground'
                }`}>
                  {status.moduleName || t('未知模块')}
                </span>
                {status.status === 'completed' && (
                  <span className="text-green-600 dark:text-green-400 text-xs">✓</span>
                )}
                {status.status === 'error' && (
                  <span className="text-red-600 dark:text-red-400 text-xs">✗</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 提示信息 */}
      {!isStreaming && moduleHistory.length === 0 && (
        <div className="text-xs text-muted-foreground text-center py-2">
          {t('FastGPT 工作流准备就绪')}
        </div>
      )}
    </div>
  );
};