import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// 创建速率限制器
const rateLimiter = new RateLimiterMemory({
  points: 100, // 请求数量
  duration: 60, // 时间窗口（秒）
  blockDuration: 60, // 阻止时间（秒）
});

/**
 * 速率限制中间件
 */
export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const key = req.ip || 'anonymous';
    await rateLimiter.consume(key);
    next();
  } catch (rejRes: any) {
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

export { rateLimiterMiddleware as rateLimiter };