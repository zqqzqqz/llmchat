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
 * 聊天消息接口（按 huihua.md 要求的格式）
 */
export interface ChatMessage {
  AI?: string;    // AI回复内容
  HUMAN?: string; // 用户输入内容
}

/**
 * 原始消息接口（用于与后端通信）
 */
export interface OriginalChatMessage {
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
  // FastGPT 特有参数
  variables?: Record<string, any>; // 模块变量，会替换模块中输入框内容里的 [key]
  responseChatItemId?: string;     // 响应消息的 ID，FastGPT 会自动将该 ID 存入数据库
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
    message: OriginalChatMessage;  // 使用原始消息格式
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
 * 聊天会话（严格按照 huihua.md 定义）
 */
export interface ChatSession {
  id: string;              // 时间戳字符串(会话id)
  title: string;           // 会话标题（取自首条消息前30字符）
  agentId: string;         // 关联的智能体ID
  messages: ChatMessage[]; // 消息列表 [{'AI': string, 'HUMAN': string}]
  createdAt: Date;         // 创建时间
  updatedAt: Date;         // 更新时间
}

/**
 * 按智能体分组的会话字典（严格按照 huihua.md 格式）
 */
export interface AgentSessionsMap {
  [agentId: string]: ChatSession[];  // agentId:[会话数组]
}

/**
 * 应用状态（更新为支持 huihua.md 结构）
 */
export interface AppState {
  // 智能体相关
  agents: Agent[];
  currentAgent: Agent | null;
  agentsLoading: boolean;
  agentsError: string | null;
  
  // 聊天相关（按 huihua.md 重构）
  agentSessions: AgentSessionsMap;     // 按智能体分组的会话字典
  currentSession: ChatSession | null;  // 当前会话
  messages: ChatMessage[];             // 当前会话的消息列表
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
 * 消息组件Props（更新为支持新消息格式）
 */
export interface MessageProps extends BaseComponentProps {
  message: ChatMessage;  // 使用新的 huihua.md 格式
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

/**
 * 消息格式转换工具函数
 */
export const convertToHuihuaFormat = (messages: OriginalChatMessage[]): ChatMessage[] => {
  const result: ChatMessage[] = [];
  let currentPair: ChatMessage = {};
  
  messages.forEach(msg => {
    if (msg.role === 'user') {
      if (Object.keys(currentPair).length > 0) {
        result.push(currentPair);
        currentPair = {};
      }
      currentPair.HUMAN = msg.content;
    } else if (msg.role === 'assistant') {
      currentPair.AI = msg.content;
    }
  });
  
  if (Object.keys(currentPair).length > 0) {
    result.push(currentPair);
  }
  
  return result;
};

/**
 * 将 huihua.md 格式转换为原始格式（用于后端通信）
 */
export const convertFromHuihuaFormat = (huihuaMessages: ChatMessage[]): OriginalChatMessage[] => {
  const result: OriginalChatMessage[] = [];
  
  huihuaMessages.forEach((msg, index) => {
    if (msg.HUMAN) {
      result.push({
        id: `${Date.now()}-${index}-user`,
        role: 'user',
        content: msg.HUMAN,
        timestamp: new Date()
      });
    }
    if (msg.AI) {
      result.push({
        id: `${Date.now()}-${index}-assistant`,
        role: 'assistant',
        content: msg.AI,
        timestamp: new Date()
      });
    }
  });
  
  return result;
};