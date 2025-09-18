import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Agent, ChatMessage, StreamStatus, ChatSession, UserPreferences } from '@/types';

interface ChatState {
  // 智能体状态
  agents: Agent[];
  currentAgent: Agent | null;
  agentsLoading: boolean;
  agentsError: string | null;

  // 聊天状态
  messages: ChatMessage[];
  currentSession: ChatSession | null;
  isStreaming: boolean;
  streamingStatus: StreamStatus | null;

  // 用户偏好
  preferences: UserPreferences;

  // UI 状态
  agentSelectorOpen: boolean;

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
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // 初始状态
      agents: [],
      currentAgent: null,
      agentsLoading: false,
      agentsError: null,
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

      // Actions
      setAgents: (agents) => set({ agents }),
      setCurrentAgent: (agent) => set({ currentAgent: agent }),
      setAgentsLoading: (loading) => set({ agentsLoading: loading }),
      setAgentsError: (error) => set({ agentsError: error }),

      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),

      updateLastMessage: (content) =>
        set((state) => {
          const messages = [...state.messages];
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content += content;
          }
          return { messages };
        }),

      clearMessages: () => set({ messages: [] }),
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),
      setStreamingStatus: (status) => set({ streamingStatus: status }),
      setAgentSelectorOpen: (open) => set({ agentSelectorOpen: open }),

      updatePreferences: (newPreferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences },
        })),
    }),
    {
      name: 'llmchat-storage',
      partialize: (state) => ({
        currentAgent: state.currentAgent,
        preferences: state.preferences,
        messages: state.messages.slice(-50), // 只保存最近50条消息
      }),
    }
  )
);