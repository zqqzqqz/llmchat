export interface AgentConfig {
    id: string;
    name: string;
    description: string;
    endpoint: string;
    apiKey: string;
    model: string;
    appId?: string;
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
export interface FastGPTInitResponse {
    chatId: string;
    appId: string;
    variables: Record<string, any>;
    app: {
        chatConfig: {
            questionGuide: boolean;
            ttsConfig: {
                type: string;
            };
            whisperConfig: {
                open: boolean;
                autoSend: boolean;
                autoTTSResponse: boolean;
            };
            chatInputGuide: {
                open: boolean;
                textList: string[];
                customUrl: string;
            };
            instruction: string;
            variables: any[];
            fileSelectConfig: {
                canSelectFile: boolean;
                canSelectImg: boolean;
                maxFiles: number;
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
export interface FastGPTChatHistoryMessage {
    id?: string | undefined;
    dataId?: string | undefined;
    role: 'user' | 'assistant' | 'system';
    content: string;
    feedback?: 'good' | 'bad' | null | undefined;
    raw?: any;
}
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
//# sourceMappingURL=index.d.ts.map