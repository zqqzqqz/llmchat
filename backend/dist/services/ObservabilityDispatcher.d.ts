export interface ObservabilityEvent {
    timestamp: string;
    channel: 'normal' | 'stream';
    level: 'INFO' | 'WARN' | 'ERROR';
    agentId: string;
    provider?: string;
    endpoint?: string;
    chatId?: string;
    eventType?: string;
    payload: Record<string, any> | null;
}
export declare class ObservabilityDispatcher {
    private static instance;
    static getInstance(): ObservabilityDispatcher;
    private readonly exporters;
    private readonly queue;
    private flushing;
    private flushTimer;
    private readonly minBatchSize;
    private constructor();
    isEnabled(): boolean;
    enqueue(event: ObservabilityEvent): void;
    private scheduleFlush;
    private flush;
    private sendToExporter;
    private sendToHttp;
    private sendToElastic;
    private sendToClickHouse;
}
//# sourceMappingURL=ObservabilityDispatcher.d.ts.map