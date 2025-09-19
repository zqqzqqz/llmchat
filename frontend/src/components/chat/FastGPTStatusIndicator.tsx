import React, { useState, useEffect } from 'react';
import { Bot, Database, Workflow, CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { Agent, StreamStatus } from '@/types';

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

  // 检查 FastGPT 特有状态
  useEffect(() => {
    if (agent.provider === 'fastgpt') {
      checkFastGPTStatus();
    }
  }, [agent.id]);

  const checkFastGPTStatus = async () => {
    try {
      console.log('检查 FastGPT 状态 for agent:', agent.id);
      // 简化状态检查逻辑，直接设置为就绪状态
      // 如果需要实际状态检查，可以调用后端接口
      setContextStatus('active');
      setKnowledgeStatus('ready');
      
      // 可选：检查智能体配置状态
      const response = await fetch(`/api/agents/${agent.id}`);
      if (response.ok) {
        const agentData = await response.json();
        console.log('FastGPT 智能体数据:', agentData);
        setContextStatus(agentData.data?.isActive ? 'active' : 'inactive');
        setKnowledgeStatus('ready');
      }
    } catch (error) {
      console.warn('FastGPT 状态检查失败:', error);
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
    <div className="fastgpt-status bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
      {/* FastGPT 特有状态信息 */}
      <div className="mb-3">
        <div className="flex items-center gap-4 text-sm">
          <div className={`flex items-center gap-2 ${contextStatus === 'active' ? 'text-green-600' : 'text-gray-500'}`}>
            <Bot className="h-4 w-4" />
            <span>上下文: {contextStatus === 'active' ? '激活' : '未激活'}</span>
          </div>
          <div className={`flex items-center gap-2 ${
            knowledgeStatus === 'ready' ? 'text-green-600' : 
            knowledgeStatus === 'error' ? 'text-red-500' : 'text-yellow-500'
          }`}>
            <Database className="h-4 w-4" />
            <span>知识库: {
              knowledgeStatus === 'ready' ? '就绪' : 
              knowledgeStatus === 'error' ? '错误' : '加载中'
            }</span>
          </div>
        </div>
      </div>

      {/* 当前流程节点状态 */}
      {isStreaming && currentStatus && (
        <div className="current-module mb-3">
          <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-md border">
            <div className="animate-spin">
              <Workflow className="h-4 w-4 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              正在执行: {currentStatus.moduleName || '准备中...'}
            </span>
          </div>
        </div>
      )}

      {/* 流程执行历史 */}
      {moduleHistory.length > 0 && (
        <div className="module-history">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
            执行历史
          </div>
          <div className="space-y-1">
            {moduleHistory.map((status, index) => (
              <div key={index} className={`flex items-center gap-2 p-2 rounded text-xs ${
                status.status === 'completed' ? 'bg-green-50 dark:bg-green-900/20' :
                status.status === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                'bg-blue-50 dark:bg-blue-900/20'
              }`}>
                {getStatusIcon(status.status)}
                {getModuleIcon(status.moduleName || '')}
                <span className={`flex-1 ${
                  status.status === 'completed' ? 'text-green-700 dark:text-green-300' :
                  status.status === 'error' ? 'text-red-700 dark:text-red-300' :
                  'text-blue-700 dark:text-blue-300'
                }`}>
                  {status.moduleName || '未知模块'}
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
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
          FastGPT 工作流准备就绪
        </div>
      )}
    </div>
  );
};