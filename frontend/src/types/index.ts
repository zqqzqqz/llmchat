/**
 * 智能体接口
 */
export interface Agent {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  model: string;
  status: AgentStatus;
  capabilities: string[];
  provider: string;
}

/**
 * 智能体状态
 */
export type AgentStatus = 'active' | 'inactive' | 'error' | 'loading';

/**
 * 聊天消息接口
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    provider?: string;
    agentId?: string;
  };
}

/**
 * 聊天选项
 */
export interface ChatOptions {
  stream?: boolean;
  chatId?: string;
  detail?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 聊天响应
 */
export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 流式响应状态
 */
export interface StreamStatus {
  type: 'flowNodeStatus' | 'progress' | 'error' | 'complete';
  status: 'running' | 'completed' | 'error';
  moduleName?: string;
  progress?: number;
  error?: string;
}

/**
 * API错误响应
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

/**
 * 主题类型
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * 主题配置
 */
export interface ThemeConfig {
  mode: ThemeMode;
  isAutoMode: boolean;
  userPreference: ThemeMode;
}

/**
 * 用户偏好设置
 */
export interface UserPreferences {
  theme: ThemeConfig;
  streamingEnabled: boolean;
  autoThemeSchedule: {
    enabled: boolean;
    lightModeStart: string; // HH:mm 格式
    darkModeStart: string;  // HH:mm 格式
  };
  defaultAgent?: string;
  language: 'zh-CN' | 'en-US';
}

/**
 * 聊天会话
 */
export interface ChatSession {
  id: string;
  title: string;
  agentId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    totalTokens: number;
    messageCount: number;
  };
}

/**
 * 应用状态
 */
export interface AppState {
  // 智能体相关
  agents: Agent[];
  currentAgent: Agent | null;
  agentsLoading: boolean;
  agentsError: string | null;
  
  // 聊天相关
  messages: ChatMessage[];
  currentSession: ChatSession | null;
  isStreaming: boolean;
  streamingStatus: StreamStatus | null;
  
  // 主题相关
  theme: ThemeConfig;
  
  // 用户偏好
  preferences: UserPreferences;
  
  // UI状态
  sidebarOpen: boolean;
  agentSelectorOpen: boolean;
  
  // 错误状态
  globalError: string | null;
}

/**
 * API请求选项
 */
export interface RequestOptions {
  timeout?: number;
  signal?: AbortSignal;
  retries?: number;
}

/**
 * 智能体健康状态
 */
export interface AgentHealthStatus {
  agentId: string;
  status: AgentStatus;
  responseTime?: number;
  lastChecked: string;
  error?: string;
}

/**
 * 组件通用Props
 */
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

/**
 * 智能体选择器Props
 */
export interface AgentSelectorProps extends BaseComponentProps {
  agents: Agent[];
  currentAgent: Agent | null;
  onAgentChange: (agent: Agent) => void;
  loading?: boolean;
  disabled?: boolean;
}

/**
 * 主题切换Props
 */
export interface ThemeToggleProps extends BaseComponentProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  variant?: 'icon' | 'button';
}

/**
 * 消息组件Props
 */
export interface MessageProps extends BaseComponentProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onRetry?: () => void;
  onEdit?: (content: string) => void;
  onDelete?: () => void;
}

/**
 * 聊天输入Props
 */
export interface ChatInputProps extends BaseComponentProps {
  onSendMessage: (content: string, options?: ChatOptions) => void;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
}