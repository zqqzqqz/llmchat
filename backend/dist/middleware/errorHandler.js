"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errorHandler = (error, req, res, next) => {
    console.error('错误详情:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        timestamp: new Date().toISOString(),
    });
    if (res.headersSent) {
        return next(error);
    }
    const errorResponse = {
        code: 'INTERNAL_SERVER_ERROR',
        message: '服务器内部错误',
        timestamp: new Date().toISOString(),
    };
    if (error.name === 'ValidationError') {
        errorResponse.code = 'VALIDATION_ERROR';
        errorResponse.message = error.message;
        res.status(400);
    }
    else if (error.name === 'UnauthorizedError') {
        errorResponse.code = 'UNAUTHORIZED';
        errorResponse.message = '未授权访问';
        res.status(401);
    }
    else if (error.name === 'NotFoundError') {
        errorResponse.code = 'NOT_FOUND';
        errorResponse.message = '资源不存在';
        res.status(404);
    }
    else if (error.message.includes('timeout')) {
        errorResponse.code = 'REQUEST_TIMEOUT';
        errorResponse.message = '请求超时';
        res.status(408);
    }
    else {
        res.status(500);
    }
    if (process.env.NODE_ENV === 'development') {
        errorResponse.details = {
            stack: error.stack,
            name: error.name,
        };
    }
    res.json(errorResponse);
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map