import React, { useEffect, useRef, useState } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChatStore } from '@/store/chatStore';
import { useChat } from '@/hooks/useChat';
import { Bot, Sparkles } from 'lucide-react';
import { chatService } from '@/services/api';

export const ChatContainer: React.FC = () => {
  const {
    messages,
    currentAgent,
    isStreaming,
    preferences,
    currentSession,
    addMessage,
    updateLastMessage,
    setIsStreaming,
    createNewSession,
  } = useChatStore();
  const { sendMessage, continueInteractiveSelect, continueInteractiveForm } = useChat();

  // 避免重复触发同一会话/智能体的开场白
  const welcomeTriggeredKeyRef = useRef<string | null>(null);

  // init 变量流程：隐藏输入框、收集初始变量
  const [hideComposer, setHideComposer] = useState(false);
  const [pendingInitVars, setPendingInitVars] = useState<Record<string, any> | null>(null);

  // 将 FastGPT init 返回的 variables 转为交互气泡
  const renderVariablesAsInteractive = (initData: any) => {
    try {
      const vars = initData?.app?.chatConfig?.variables || [];
      if (!Array.isArray(vars) || vars.length === 0) return;

      // 仅 1 个且为 select -> 下拉选择气泡（userSelect）
      if (vars.length === 1 && vars[0]?.type === 'select' && Array.isArray(vars[0]?.list)) {
        const v = vars[0];
        const interactive = {
          type: 'userSelect' as const,
          origin: 'init' as const,
          params: {
            varKey: v.key,
            description: v.description || v.label || '请选择一个选项以继续',
            userSelectOptions: (v.list || []).map((opt: any) => ({
              key: String(opt.value),              // 发送值
              value: String(opt.label ?? opt.value) // 显示文本
            }))
          }
        };
        addMessage({ interactive });
        setHideComposer(true);
        return;
      }

      // 多变量或非 select 类型 -> 合并为一个表单（userInput）
      const inputForm = vars.map((v: any, idx: number) => {
        const t = v.type;
        const mappedType = t === 'number' || t === 'numberInput' ? 'numberInput' : (t === 'select' ? 'select' : 'input');
        return {
          type: mappedType,
          key: v.key || `field_${idx}`,
          label: v.label || v.key || `字段${idx + 1}`,
          description: v.description || '',
          value: v.defaultValue ?? '',
          defaultValue: v.defaultValue ?? '',
          valueType: v.valueType || (mappedType === 'numberInput' ? 'number' : 'string'),
          required: !!v.required,
          list: Array.isArray(v.list) ? v.list : []
        };
      });

      const interactive = {
        type: 'userInput' as const,
        origin: 'init' as const,
        params: {
          description: '请填写以下信息以继续',
          inputForm
        }
      };
      addMessage({ interactive });
      setHideComposer(true);
    } catch (e) {
      console.warn('渲染 variables 失败:', e);
    }
  };

  // 交互回调：区分 init 起源与普通交互
  const handleInteractiveSelect = (payload: any) => {
    if (typeof payload === 'string') {
      // 普通交互（非 init）：直接继续运行
      return continueInteractiveSelect(payload);
    }
    if (payload && payload.origin === 'init') {
      // init 交互：仅收集变量，显示输入框，不请求后端
      setPendingInitVars((prev) => ({ ...(prev || {}), [payload.key]: payload.value }));
      setHideComposer(false);
    }
  };

  const handleInteractiveFormSubmit = (payload: any) => {
    // 非 init 表单：直接继续运行
    if (!payload || payload.origin !== 'init') {
      return continueInteractiveForm(payload);
    }
    // init 表单：仅收集变量，显示输入框
    const values = payload.values || {};
    setPendingInitVars((prev) => ({ ...(prev || {}), ...values }));
    setHideComposer(false);
  };

  // 发送消息：若存在 init 变量，则在首次发送时一并携带
  const handleSendMessage = async (content: string) => {
    const vars = pendingInitVars || undefined;
    const options = vars ? { variables: vars, detail: true } : { detail: true };
    await sendMessage(content, options);
    if (vars) setPendingInitVars(null);
  };


  useEffect(() => {
    // 仅在有智能体、当前没有消息、且不在流式中时触发
    if (!currentAgent) return;
    if (isStreaming) return;
    if (messages.length > 0) return;

    let sessionId = currentSession?.id;

    const run = async () => {
      // 确保存在会话（新建对话场景）
      if (!sessionId) {
        createNewSession();
        const latest = useChatStore.getState().currentSession;
        sessionId = latest?.id;
      }

      const key = `${currentAgent.id}:${sessionId || 'nosession'}`;
      if (welcomeTriggeredKeyRef.current === key) return;
      welcomeTriggeredKeyRef.current = key;

      // 添加AI消息占位符，流式增量写入
      addMessage({ AI: '' });
      setIsStreaming(true);

      try {
        if (preferences.streamingEnabled) {
          await chatService.initStream(
            currentAgent.id,
            sessionId,
            (chunk) => {
              updateLastMessage(chunk);
            },
            (initData) => {
              // 流式开场白完成后，根据 variables 渲染交互气泡
              renderVariablesAsInteractive(initData);
            }
          );
        } else {
          const data = await chatService.init(currentAgent.id, sessionId);
          const content =
            data?.welcomeText ||
            data?.app?.chatConfig?.welcomeText ||
            data?.content ||
            `你好，我是 ${currentAgent.name}${currentAgent.description ? '：' + currentAgent.description : ''}`;
          updateLastMessage(content);
          // 非流式初始化后渲染 variables 为交互气泡
          renderVariablesAsInteractive(data);

        }
      } catch (e) {
        console.error('开场白加载失败:', e);
        const fallback = `你好，我是 ${currentAgent.name}${currentAgent.description ? '：' + currentAgent.description : ''}`;
        updateLastMessage(fallback);
      } finally {
        setIsStreaming(false);
      }
    };

    run();
    // 仅在智能体/会话变更或消息长度变化时检查
  }, [currentAgent?.id, currentSession?.id, messages.length, isStreaming, preferences.streamingEnabled, createNewSession, addMessage, updateLastMessage, setIsStreaming]);

  // 无智能体时的提示界面
  if (!currentAgent) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-r from-brand to-brand/70 rounded-2xl
            flex items-center justify-center">
            <Bot className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-3">
            欢迎使用 LLMChat
          </h2>
          <p className="text-muted-foreground mb-6">
            请选择一个智能体开始您的对话之旅
          </p>
        </div>
      </div>
    );
  }

  // 无消息时的欢迎界面（在副作用触发期间短暂显示）
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-2xl">
            <div className="w-20 h-20 mx-auto mb-8 bg-gradient-to-r from-brand to-brand/70 rounded-3xl
              flex items-center justify-center shadow-lg">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              与 {currentAgent.name} 对话
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              {currentAgent.description}
            </p>

            {/* 示例提示 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-background rounded-xl border border-border hover:bg-brand/10 transition-colors cursor-pointer"
                onClick={() => sendMessage('你好，请介绍一下你的能力')}
              >
                <h3 className="font-medium text-foreground mb-2">
                  👋 介绍与能力
                </h3>
                <p className="text-sm text-muted-foreground">
                  了解智能体的功能与特点
                </p>
              </div>

              <div className="p-4 bg-background rounded-xl border border-border hover:bg-brand/10 transition-colors cursor-pointer"
                onClick={() => sendMessage('你能帮我做什么？')}
              >
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  ❓ 探索功能
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  发现更多实用功能
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 输入区域 */}
        <div className="border-t border-border/50 bg-background p-4">
          <div className="max-w-4xl mx-auto">
            {!hideComposer && (
              <MessageInput
                onSendMessage={handleSendMessage}
                disabled={isStreaming}
                placeholder={`与 ${currentAgent.name} 对话...`}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // 有消息时的正常聊天界面
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-hidden">
        <MessageList
            messages={messages}
            isStreaming={isStreaming}
            onInteractiveSelect={handleInteractiveSelect}
            onInteractiveFormSubmit={handleInteractiveFormSubmit}
          />
      </div>
      <div className="border-t border-border/50 bg-background p-4">
        <div className="max-w-4xl mx-auto">
          {!hideComposer && (
            <MessageInput
              onSendMessage={handleSendMessage}
              disabled={isStreaming}
              placeholder={`与 ${currentAgent.name} 对话...`}
            />
          )}
        </div>
      </div>
    </div>
  );
};