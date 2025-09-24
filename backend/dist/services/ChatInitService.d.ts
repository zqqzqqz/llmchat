import { AgentConfigService } from './AgentConfigService';
import { FastGPTInitResponse } from '@/types';
export declare class ChatInitService {
    private httpClient;
    private agentService;
    private cache;
    private readonly CACHE_TTL;
    constructor(agentService: AgentConfigService);
    getInitData(appId: string, chatId?: string): Promise<FastGPTInitResponse>;
    getInitDataStream(appId: string, chatId: string | undefined, onChunk: (chunk: string) => void, onComplete: (data: FastGPTInitResponse) => void, onError: (error: Error) => void): Promise<void>;
    private callFastGPTInitAPI;
    private streamWelcomeText;
    private normalizeWelcomeText;
    clearCache(): void;
    clearExpiredCache(): void;
}
//# sourceMappingURL=ChatInitService.d.ts.map