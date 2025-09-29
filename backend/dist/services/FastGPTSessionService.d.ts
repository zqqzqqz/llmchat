import { AgentConfigService } from './AgentConfigService';
import { ChatMessage, FastGPTChatHistoryDetail, FastGPTChatHistorySummary } from '@/types';
interface ListParams {
    page?: number;
    pageSize?: number;
}
export declare class FastGPTSessionService {
    private readonly agentService;
    private readonly httpClient;
    private readonly historyListCache;
    private readonly historyDetailCache;
    private readonly inFlightRequests;
    private readonly historyListPolicy;
    private readonly historyDetailPolicy;
    constructor(agentService: AgentConfigService);
    private ensureFastGPTAgent;
    private getBaseUrl;
    private requestWithFallback;
    private getWithCache;
    private invalidateHistoryCaches;
    private normalizeHistorySummary;
    private normalizeHistoryMessage;
    private normalizeHistoryDetail;
    listHistories(agentId: string, pagination?: ListParams): Promise<FastGPTChatHistorySummary[]>;
    getHistoryDetail(agentId: string, chatId: string): Promise<FastGPTChatHistoryDetail>;
    deleteHistory(agentId: string, chatId: string): Promise<void>;
    clearHistories(agentId: string): Promise<void>;
    prepareRetryPayload(detail: FastGPTChatHistoryDetail, targetDataId: string): {
        messages: ChatMessage[];
        responseChatItemId?: string;
    } | null;
}
export type { FastGPTChatHistorySummary };
//# sourceMappingURL=FastGPTSessionService.d.ts.map