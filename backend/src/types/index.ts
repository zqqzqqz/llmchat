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
  appId?: string; // FastGPT 应用的真实 ObjectId（仅 provider=fastgpt 需要）
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
  timestamp?: number;
  attachments?: ChatAttachmentMetadata[];
  voiceNote?: VoiceNoteMetadata | null;
  metadata?: {
    model?: string;
    tokens?: number;
    provider?: string;
    attachments?: ChatAttachmentMetadata[];
    voiceNote?: VoiceNoteMetadata | null;
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
  attachments?: ChatAttachmentMetadata[];
  voiceNote?: VoiceNoteMetadata | null;
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
  createdAt: number;
  updatedAt: number;
  metadata?: {
    totalTokens: number;
    messageCount: number;
  };
}

export interface ChatAttachmentMetadata {
  id: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
  source?: 'upload' | 'voice' | 'external';
}

export interface VoiceNoteMetadata {
  id: string;
  url: string;
  duration: number;
  mimeType: string;
  size?: number;
}

/**
 * FastGPT初始化响应接口
 */
export interface FastGPTInitResponse {
  chatId: string;
  appId: string;
  variables: Record<string, any>;
  app: {
    chatConfig: {
      questionGuide: boolean;
      ttsConfig: { type: string };
      whisperConfig: { 
        open: boolean; 
        autoSend: boolean; 
        autoTTSResponse: boolean 
      };
      chatInputGuide: { 
        open: boolean; 
        textList: string[]; 
        customUrl: string 
      };
      instruction: string;
      variables: any[];
      fileSelectConfig: { 
        canSelectFile: boolean; 
        canSelectImg: boolean; 
        maxFiles: number 
      };
      welcomeText: string;
    };
    chatModels: string[];
    name: string;
    avatar: string;
    intro: string;
    type: string;
    pluginInputs: any[];
  };
}

/**
 * FastGPT 会话摘要
 */
export interface FastGPTChatHistorySummary {
  chatId: string;
  appId?: string | undefined;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number | undefined;
  tags?: string[] | undefined;
  raw?: any;
}

/**
 * FastGPT 历史消息
 */
export interface FastGPTChatHistoryMessage {
  id?: string | undefined;
  dataId?: string | undefined;
  role: 'user' | 'assistant' | 'system';
  content: string;
  feedback?: 'good' | 'bad' | null | undefined;
  raw?: any;
}

/**
 * FastGPT 会话详情
 */
export interface FastGPTChatHistoryDetail {
  chatId: string;
  appId?: string | undefined;
  title?: string | undefined;
  messages: FastGPTChatHistoryMessage[];
  metadata?: Record<string, any> | undefined;
}

export interface ProductPreviewBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProductPreviewRequest {
  sceneImage: string;
  productImage?: string;
  productQuery: string;
  personalization?: string;
  boundingBox: ProductPreviewBoundingBox;
}

export interface ProductPreviewResult {
  requestId?: string;
  traceId?: string;
  previewImage?: string;
  imageUrl?: string;
  status?: string;
  raw?: any;
}