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
export type AgentStatus = 'active' | 'inactive' | 'error' | 'loading';
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
export interface ChatOptions {
    stream?: boolean;
    chatId?: string;
    detail?: boolean;
    temperature?: number;
    maxTokens?: number;
    variables?: Record<string, any>;
    responseChatItemId?: string;
}
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
export interface StreamStatus {
    type: 'flowNodeStatus' | 'progress' | 'error' | 'complete';
    status: 'running' | 'completed' | 'error';
    moduleName?: string;
    progress?: number;
    error?: string;
}
export interface ApiError {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
}
export interface AgentHealthStatus {
    agentId: string;
    status: AgentStatus;
    responseTime?: number;
    lastChecked: string;
    error?: string;
}
export interface RequestHeaders {
    authorization?: string;
    'content-type'?: string;
    'user-agent'?: string;
    [key: string]: string | undefined;
}
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
//# sourceMappingURL=index.d.ts.map