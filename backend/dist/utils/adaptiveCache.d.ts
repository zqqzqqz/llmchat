interface AdaptiveCacheOptions {
    initialTtl: number;
    minTtl: number;
    maxTtl: number;
    step: number;
    sampleSize?: number;
    adjustIntervalMs?: number;
    expandRatio?: number;
    shrinkRatio?: number;
}
export declare class AdaptiveTtlPolicy {
    private readonly options;
    private ttl;
    private hits;
    private misses;
    private lastAdjusted;
    private readonly sampleSize;
    private readonly adjustIntervalMs;
    private readonly expandRatio;
    private readonly shrinkRatio;
    constructor(options: AdaptiveCacheOptions);
    getTtl(): number;
    recordHit(): void;
    recordMiss(): void;
    reset(): void;
    notifyInvalidation(): void;
    private maybeAdjust;
}
export {};
//# sourceMappingURL=adaptiveCache.d.ts.map