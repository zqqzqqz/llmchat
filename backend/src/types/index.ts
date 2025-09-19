/**
 * 智能体配置接口
 */
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  capabilities: string[];
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  provider: 'fastgpt' | 'openai' | 'anthropic' | 'custom';
  isActive: boolean;
  features: {
    supportsChatId: boolean;
    supportsStream: boolean;
    supportsDetail: boolean;
    supportsFiles: boolean;
    supportsImages: boolean;
    streamingConfig: {
      enabled: boolean;
      endpoint: 'same' | 'different';
      statusEvents: boolean;
      flowNodeStatus: boolean;
    };
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * 智能体状态
 */
export type AgentStatus = 'active' | 'inactive' | 'error' | 'loading';

/**
 * 简化的智能体信息（用于前端显示）
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
 * 聊天消息接口
 */
export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    provider?: string;
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
 * 智能体健康检查响应
 */
export interface AgentHealthStatus {
  agentId: string;
  status: AgentStatus;
  responseTime?: number;
  lastChecked: string;
  error?: string;
}

/**
 * 请求头类型
 */
export interface RequestHeaders {
  authorization?: string;
  'content-type'?: string;
  'user-agent'?: string;
  [key: string]: string | undefined;
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