"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveTtlPolicy = void 0;
class AdaptiveTtlPolicy {
    constructor(options) {
        this.options = options;
        this.hits = 0;
        this.misses = 0;
        this.lastAdjusted = Date.now();
        this.ttl = options.initialTtl;
        this.sampleSize = options.sampleSize ?? 20;
        this.adjustIntervalMs = options.adjustIntervalMs ?? 60000;
        this.expandRatio = options.expandRatio ?? 0.7;
        this.shrinkRatio = options.shrinkRatio ?? 0.3;
    }
    getTtl() {
        return this.ttl;
    }
    recordHit() {
        this.hits += 1;
        this.maybeAdjust();
    }
    recordMiss() {
        this.misses += 1;
        this.maybeAdjust();
    }
    reset() {
        this.ttl = this.options.initialTtl;
        this.hits = 0;
        this.misses = 0;
        this.lastAdjusted = Date.now();
    }
    notifyInvalidation() {
        this.ttl = Math.max(this.options.minTtl, this.ttl - this.options.step);
        this.hits = 0;
        this.misses = 0;
        this.lastAdjusted = Date.now();
    }
    maybeAdjust() {
        const total = this.hits + this.misses;
        const now = Date.now();
        if (total < this.sampleSize && now - this.lastAdjusted < this.adjustIntervalMs) {
            return;
        }
        const ratio = total === 0 ? 0 : this.hits / total;
        if (ratio >= this.expandRatio && this.ttl < this.options.maxTtl) {
            this.ttl = Math.min(this.options.maxTtl, this.ttl + this.options.step);
        }
        else if (ratio <= this.shrinkRatio && this.ttl > this.options.minTtl) {
            this.ttl = Math.max(this.options.minTtl, this.ttl - this.options.step);
        }
        this.hits = 0;
        this.misses = 0;
        this.lastAdjusted = now;
    }
}
exports.AdaptiveTtlPolicy = AdaptiveTtlPolicy;
//# sourceMappingURL=adaptiveCache.js.map