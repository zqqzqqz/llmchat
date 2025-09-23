"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = exports.rateLimiterMiddleware = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const rateLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
    points: 100,
    duration: 60,
    blockDuration: 60,
});
const rateLimiterMiddleware = async (req, res, next) => {
    try {
        const key = req.ip || 'anonymous';
        await rateLimiter.consume(key);
        next();
    }
    catch (rejRes) {
        const remainingPoints = rejRes?.remainingPoints || 0;
        const msBeforeNext = rejRes?.msBeforeNext || 60000;
        res.set({
            'Retry-After': Math.round(msBeforeNext / 1000),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': remainingPoints.toString(),
            'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext).toISOString(),
        });
        res.status(429).json({
            code: 'RATE_LIMIT_EXCEEDED',
            message: '请求过于频繁，请稍后再试',
            retryAfter: Math.round(msBeforeNext / 1000),
            timestamp: new Date().toISOString(),
        });
    }
};
exports.rateLimiterMiddleware = rateLimiterMiddleware;
exports.rateLimiter = exports.rateLimiterMiddleware;
//# sourceMappingURL=rateLimiter.js.map