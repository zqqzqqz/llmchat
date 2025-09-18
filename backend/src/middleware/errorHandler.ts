import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@/types';

/**
 * 全局错误处理中间件
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('错误详情:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  // 如果响应已经发送，传递给默认错误处理器
  if (res.headersSent) {
    return next(error);
  }

  // 默认错误响应
  const errorResponse: ApiError = {
    code: 'INTERNAL_SERVER_ERROR',
    message: '服务器内部错误',
    timestamp: new Date().toISOString(),
  };

  // 根据错误类型自定义响应
  if (error.name === 'ValidationError') {
    errorResponse.code = 'VALIDATION_ERROR';
    errorResponse.message = error.message;
    res.status(400);
  } else if (error.name === 'UnauthorizedError') {
    errorResponse.code = 'UNAUTHORIZED';
    errorResponse.message = '未授权访问';
    res.status(401);
  } else if (error.name === 'NotFoundError') {
    errorResponse.code = 'NOT_FOUND';
    errorResponse.message = '资源不存在';
    res.status(404);
  } else if (error.message.includes('timeout')) {
    errorResponse.code = 'REQUEST_TIMEOUT';
    errorResponse.message = '请求超时';
    res.status(408);
  } else {
    res.status(500);
  }

  // 开发环境下返回错误堆栈
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = {
      stack: error.stack,
      name: error.name,
    };
  }

  res.json(errorResponse);
};