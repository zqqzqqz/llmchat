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

export class AdaptiveTtlPolicy {
  private ttl: number;
  private hits = 0;
  private misses = 0;
  private lastAdjusted = Date.now();
  private readonly sampleSize: number;
  private readonly adjustIntervalMs: number;
  private readonly expandRatio: number;
  private readonly shrinkRatio: number;

  constructor(private readonly options: AdaptiveCacheOptions) {
    this.ttl = options.initialTtl;
    this.sampleSize = options.sampleSize ?? 20;
    this.adjustIntervalMs = options.adjustIntervalMs ?? 60_000;
    this.expandRatio = options.expandRatio ?? 0.7;
    this.shrinkRatio = options.shrinkRatio ?? 0.3;
  }

  getTtl(): number {
    return this.ttl;
  }

  recordHit(): void {
    this.hits += 1;
    this.maybeAdjust();
  }

  recordMiss(): void {
    this.misses += 1;
    this.maybeAdjust();
  }

  reset(): void {
    this.ttl = this.options.initialTtl;
    this.hits = 0;
    this.misses = 0;
    this.lastAdjusted = Date.now();
  }

  notifyInvalidation(): void {
    this.ttl = Math.max(this.options.minTtl, this.ttl - this.options.step);
    this.hits = 0;
    this.misses = 0;
    this.lastAdjusted = Date.now();
  }

  private maybeAdjust(): void {
    const total = this.hits + this.misses;
    const now = Date.now();
    if (total < this.sampleSize && now - this.lastAdjusted < this.adjustIntervalMs) {
      return;
    }
    const ratio = total === 0 ? 0 : this.hits / total;
    if (ratio >= this.expandRatio && this.ttl < this.options.maxTtl) {
      this.ttl = Math.min(this.options.maxTtl, this.ttl + this.options.step);
    } else if (ratio <= this.shrinkRatio && this.ttl > this.options.minTtl) {
      this.ttl = Math.max(this.options.minTtl, this.ttl - this.options.step);
    }
    this.hits = 0;
    this.misses = 0;
    this.lastAdjusted = now;
  }
}
