import { AgentConfig, ChatMessage, ChatOptions, ChatResponse, StreamStatus, RequestHeaders } from '@/types';
import { AgentConfigService } from './AgentConfigService';
export interface AIProvider {
    name: string;
    transformRequest(messages: ChatMessage[], config: AgentConfig, stream: boolean, options?: ChatOptions): any;
    transformResponse(response: any): ChatResponse;
    transformStreamResponse(chunk: any): string;
    validateConfig(config: AgentConfig): boolean;
    buildHeaders(config: AgentConfig): RequestHeaders;
}
export declare class FastGPTProvider implements AIProvider {
    name: string;
    transformRequest(messages: ChatMessage[], config: AgentConfig, stream?: boolean, options?: ChatOptions): any;
    transformResponse(response: any): ChatResponse;
    transformStreamResponse(chunk: any): string;
    validateConfig(config: AgentConfig): boolean;
    buildHeaders(config: AgentConfig): RequestHeaders;
}
export declare class OpenAIProvider implements AIProvider {
    name: string;
    transformRequest(messages: ChatMessage[], config: AgentConfig, stream?: boolean, options?: ChatOptions): {
        model: string;
        messages: {
            role: "user" | "assistant" | "system";
            content: string;
        }[];
        stream: boolean;
        max_tokens: number | undefined;
        temperature: number;
    };
    transformResponse(response: any): ChatResponse;
    transformStreamResponse(chunk: any): string;
    validateConfig(config: AgentConfig): boolean;
    buildHeaders(config: AgentConfig): RequestHeaders;
}
export declare class AnthropicProvider implements AIProvider {
    name: string;
    transformRequest(messages: ChatMessage[], config: AgentConfig, stream?: boolean, options?: ChatOptions): {
        model: string;
        max_tokens: number;
        messages: {
            role: "user" | "assistant" | "system";
            content: string;
        }[];
        stream: boolean;
        temperature: number;
    };
    transformResponse(response: any): ChatResponse;
    transformStreamResponse(chunk: any): string;
    validateConfig(config: AgentConfig): boolean;
    buildHeaders(config: AgentConfig): RequestHeaders;
}
export declare class ChatProxyService {
    private agentService;
    private httpClient;
    private providers;
    private chatLog;
    constructor(agentService: AgentConfigService);
    private registerProvider;
    sendMessage(agentId: string, messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;
    sendStreamMessage(agentId: string, messages: ChatMessage[], onChunk: (chunk: string) => void, onStatus: (status: StreamStatus) => void, options?: ChatOptions, onEvent?: (eventName: string, data: any) => void): Promise<void>;
    private findNextEventBoundary;
    private parseSSEEventBlock;
    private logStreamEvent;
    private extractReasoningPayload;
    private dispatchFastGPTEvent;
    private handleStreamResponse;
    private getProvider;
    validateAgentConfig(agentId: string): Promise<boolean>;
}
//# sourceMappingURL=ChatProxyService.d.ts.map