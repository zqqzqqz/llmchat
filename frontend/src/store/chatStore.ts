import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Agent, ChatMessage, StreamStatus, ChatSession, UserPreferences, AgentSessionsMap } from '@/types';

interface ChatState {
  // 智能体状态
  agents: Agent[];
  currentAgent: Agent | null;
  agentsLoading: boolean;
  agentsError: string | null;

  // 聊天状态（按 huihua.md 重构）
  agentSessions: AgentSessionsMap;     // 按智能体分组的会话字典
  currentSession: ChatSession | null;  // 当前会话
  messages: ChatMessage[];             // 当前会话的消息列表
  isStreaming: boolean;
  streamingStatus: StreamStatus | null;

  // 用户偏好
  preferences: UserPreferences;

  // UI 状态
  agentSelectorOpen: boolean;
  sidebarOpen: boolean;

  // Actions
  setAgents: (agents: Agent[]) => void;
  setCurrentAgent: (agent: Agent | null) => void;
  setAgentsLoading: (loading: boolean) => void;
  setAgentsError: (error: string | null) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;
  setIsStreaming: (streaming: boolean) => void;
  setStreamingStatus: (status: StreamStatus | null) => void;
  setAgentSelectorOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  createNewSession: () => void;
  deleteSession: (sessionId: string) => void;
  switchToSession: (sessionId: string) => void;
  renameSession: (sessionId: string, title: string) => void;
  initializeAgentSessions: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // 初始状态
      agents: [],
      currentAgent: null,
      agentsLoading: false,
      agentsError: null,
      agentSessions: {},  // 新的按智能体分组的会话字典
      messages: [],
      currentSession: null,
      isStreaming: false,
      streamingStatus: null,
      preferences: {
        theme: {
          mode: 'auto',
          isAutoMode: true,
          userPreference: 'auto',
        },
        streamingEnabled: true,
        autoThemeSchedule: {
          enabled: true,
          lightModeStart: '06:00',
          darkModeStart: '18:00',
        },
        language: 'zh-CN',
      },
      agentSelectorOpen: false,
      sidebarOpen: typeof window !== 'undefined' && window.innerWidth >= 1024,

      // Actions
      setAgents: (agents) => set({ agents }),
      
      // 智能体切换逻辑（按 huihua.md 要求）
      setCurrentAgent: (agent) => {
        if (!agent) {
          set({ currentAgent: null, currentSession: null, messages: [] });
          return;
        }
        
        const state = get();
        // huihua.md 要求：检查localStorage中是否有当前智能体id
        let agentSessions = state.agentSessions[agent.id];
        
        // 如没有则创建 agentId:[] 字典
        if (!agentSessions) {
          set((state) => ({
            agentSessions: {
              ...state.agentSessions,
              [agent.id]: []
            }
          }));
          agentSessions = [];
        }
        
        // 切换到该智能体并加载其会话列表
        const latestSession = agentSessions[0] || null;
        set({
          currentAgent: agent,
          currentSession: latestSession,
          messages: latestSession ? latestSession.messages : []
        });
      },
      
      setAgentsLoading: (loading) => set({ agentsLoading: loading }),
      setAgentsError: (error) => set({ agentsError: error }),

      // 添加消息（按 huihua.md 格式）
      addMessage: (message) =>
        set((state) => {
          const updatedMessages = [...state.messages, message];
          
          // 同步更新当前会话的消息
          if (state.currentSession && state.currentAgent) {
            const updatedAgentSessions = {
              ...state.agentSessions,
              [state.currentAgent.id]: state.agentSessions[state.currentAgent.id].map(session =>
                session.id === state.currentSession!.id
                  ? { ...session, messages: updatedMessages, updatedAt: new Date() }
                  : session
              )
            };
            
            // 自动更新会话标题（huihua.md 要求：取自首条消息前30字符）
            if (state.currentSession.messages.length === 0 && message.HUMAN) {
              const newTitle = message.HUMAN.length > 30 
                ? message.HUMAN.slice(0, 30) + '...' 
                : message.HUMAN;
              
              updatedAgentSessions[state.currentAgent.id] = updatedAgentSessions[state.currentAgent.id].map(session =>
                session.id === state.currentSession!.id
                  ? { ...session, title: newTitle }
                  : session
              );
            }
            
            return {
              messages: updatedMessages,
              agentSessions: updatedAgentSessions,
              currentSession: {
                ...state.currentSession,
                messages: updatedMessages,
                updatedAt: new Date()
              }
            };
          }
          
          return { messages: updatedMessages };
        }),

      // 更新最后一条消息（流式响应）- 修复实时更新问题
      updateLastMessage: (content) =>
        set((state) => {
          console.log('🔄 updateLastMessage 被调用:', content.substring(0, 50));
          console.log('📊 当前消息数量:', state.messages.length);

          // 创建全新的messages数组，确保引用更新
          const messages = state.messages.map((msg, index) => {
            if (index === state.messages.length - 1 && msg.AI !== undefined) {
              const updatedMessage = {
                ...msg,
                AI: (msg.AI || '') + content,
                _lastUpdate: Date.now() // 添加时间戳强制更新
              };
              console.log('📝 消息更新:', {
                beforeLength: msg.AI?.length || 0,
                afterLength: updatedMessage.AI.length,
                addedContent: content.length
              });
              return updatedMessage;
            }
            return msg;
          });

          console.log('✅ 状态更新完成，最新消息长度:', messages[messages.length - 1]?.AI?.length || 0);

          // 同步更新当前会话的消息
          if (state.currentSession && state.currentAgent) {
            const updatedAgentSessions = {
              ...state.agentSessions,
              [state.currentAgent.id]: state.agentSessions[state.currentAgent.id].map(session =>
                session.id === state.currentSession!.id
                  ? { ...session, messages, updatedAt: new Date() }
                  : session
              )
            };

            return {
              messages,
              agentSessions: updatedAgentSessions,
              currentSession: {
                ...state.currentSession,
                messages,
                updatedAt: new Date()
              }
            };
          }

          return { messages };
        }),

      clearMessages: () => set({ messages: [] }),
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),
      setStreamingStatus: (status) => set({ streamingStatus: status }),
      setAgentSelectorOpen: (open) => set({ agentSelectorOpen: open }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      updatePreferences: (newPreferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences },
        })),

      // 新建对话（按 huihua.md 要求）
      createNewSession: () => {
        const currentAgent = get().currentAgent;
        if (!currentAgent) return;
        
        // huihua.md 要求：新建对话时添加空messages的会话到agentId数组中
        const newSession: ChatSession = {
          id: Date.now().toString(),        // 时间戳字符串作为会话id
          title: '新对话',                   // 默认标题
          agentId: currentAgent.id,         // 关联的智能体ID
          messages: [],                     // 空的消息列表（huihua.md要求）
          createdAt: new Date(),           // 创建时间
          updatedAt: new Date(),           // 更新时间
        };
        
        set((state) => {
          const currentAgentSessions = state.agentSessions[currentAgent.id] || [];
          return {
            agentSessions: {
              ...state.agentSessions,
              [currentAgent.id]: [newSession, ...currentAgentSessions]
            },
            currentSession: newSession,
            messages: []  // 当前消息列表为空
          };
        });
      },

      // 删除会话
      deleteSession: (sessionId) =>
        set((state) => {
          if (!state.currentAgent) return state;
          
          const updatedSessions = state.agentSessions[state.currentAgent.id].filter(s => s.id !== sessionId);
          const newCurrentSession = state.currentSession?.id === sessionId ? null : state.currentSession;
          
          return {
            agentSessions: {
              ...state.agentSessions,
              [state.currentAgent.id]: updatedSessions
            },
            currentSession: newCurrentSession,
            messages: newCurrentSession ? newCurrentSession.messages : []
          };
        }),

      // 切换会话（huihua.md 要求：点击显示详细内容）
      switchToSession: (sessionId) => {
        const state = get();
        const currentAgent = state.currentAgent;
        
        if (!currentAgent) return;
        
        // 从localStorage中获取当前智能体的会话列表
        const agentSessions = state.agentSessions[currentAgent.id] || [];
        const targetSession = agentSessions.find(s => s.id === sessionId);
        
        if (targetSession) {
          // huihua.md 要求：点击会话标题显示该会话的详细内容（messages列表）
          set({ 
            currentSession: targetSession, 
            messages: targetSession.messages  // 显示该会话的messages
          });
        }
      },

      // 重命名会话
      renameSession: (sessionId, title) =>
        set((state) => {
          if (!state.currentAgent) return state;
          
          return {
            agentSessions: {
              ...state.agentSessions,
              [state.currentAgent.id]: state.agentSessions[state.currentAgent.id].map(s => 
                s.id === sessionId ? { ...s, title, updatedAt: new Date() } : s
              )
            }
          };
        }),
        
      // 初始化检查（huihua.md 要求 1）
      initializeAgentSessions: () => {
        const state = get();
        const currentAgent = state.currentAgent;
        
        // huihua.md 要求：页面初始加载后检查localStorage中是否有当前选中智能体的id
        if (currentAgent && !state.agentSessions[currentAgent.id]) {
          // 如没有则创建一个当前智能体的id的字典
          set((state) => ({
            agentSessions: {
              ...state.agentSessions,
              [currentAgent.id]: []  // agentId:[]
            }
          }));
        }
      },
    }),
    {
      name: 'llmchat-storage',
      // 完全重构，不保留旧数据
      partialize: (state) => ({
        currentAgent: state.currentAgent,
        preferences: state.preferences,
        agentSessions: state.agentSessions,  // 保存新的数据结构
        currentSession: state.currentSession,
      }),
      version: 2,  // 新版本，不兼容旧数据
      onRehydrateStorage: () => (state) => {
        // huihua.md 要求：数据恢复后执行初始化检查
        if (state) {
          setTimeout(() => {
            state.initializeAgentSessions();
          }, 0);
        }
      }
    }
  )
);

/**
 * 获取当前智能体的会话列表（huihua.md 要求：只显示当前智能体的会话）
 */
export const getCurrentAgentSessions = (): ChatSession[] => {
  const { agentSessions, currentAgent } = useChatStore.getState();
  return currentAgent ? (agentSessions[currentAgent.id] || []) : [];
};