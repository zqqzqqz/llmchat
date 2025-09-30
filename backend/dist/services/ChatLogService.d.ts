export declare class ChatLogService {
    private enabled;
    private logDir;
    private recordNormal;
    private recordStream;
    private includeRaw;
    private includeNormalized;
    private observability;
    constructor();
    private ensureDir;
    private getLogFilePath;
    private appendFile;
    private appendDb;
    logCompletion(params: {
        agentId: string;
        provider: string;
        endpoint: string;
        requestMeta?: Record<string, any>;
        rawResponse?: any;
        normalizedResponse?: any;
    }): void;
    logStreamEvent(params: {
        agentId: string;
        chatId?: string;
        provider?: string;
        endpoint?: string;
        eventType: string;
        data: any;
    }): void;
    private pushObservability;
}
//# sourceMappingURL=ChatLogService.d.ts.map