"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    const { method, url, ip } = req;
    console.log(`📝 [${new Date().toISOString()}] ${method} ${url} - ${ip}`);
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const { statusCode } = res;
        const logLevel = statusCode >= 400 ? '❌' : '✅';
        console.log(`${logLevel} [${new Date().toISOString()}] ${method} ${url} - ${statusCode} - ${duration}ms`);
    });
    next();
};
exports.requestLogger = requestLogger;
//# sourceMappingURL=requestLogger.js.map