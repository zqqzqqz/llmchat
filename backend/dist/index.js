"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const dotenv_1 = __importDefault(require("dotenv"));
const agents_1 = require("@/routes/agents");
const chat_1 = require("@/routes/chat");
const auth_1 = require("@/routes/auth");
const admin_1 = require("@/routes/admin");
const errorHandler_1 = require("@/middleware/errorHandler");
const requestLogger_1 = require("@/middleware/requestLogger");
const rateLimiter_1 = require("@/middleware/rateLimiter");
const db_1 = require("@/utils/db");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:", "wss:"],
        },
    },
}));
app.use((0, cors_1.default)({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use((0, compression_1.default)({
    filter: (req, res) => {
        const accept = req.headers['accept'];
        if (typeof accept === 'string' && accept.includes('text/event-stream')) {
            return false;
        }
        if (req.path && req.path.startsWith('/api/chat/completions')) {
            return false;
        }
        return compression_1.default.filter(req, res);
    }
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger_1.requestLogger);
app.use('/api', rateLimiter_1.rateLimiter);
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
    });
});
app.use('/api/agents', agents_1.agentRoutes);
app.use('/api/chat', chat_1.chatRoutes);
app.use('/api/auth', auth_1.authRoutes);
app.use('/api/admin', admin_1.adminRoutes);
app.use('*', (req, res) => {
    res.status(404).json({
        code: 'NOT_FOUND',
        message: `端点 ${req.originalUrl} 不存在`,
        timestamp: new Date().toISOString(),
    });
});
app.use(errorHandler_1.errorHandler);
let server;
(0, db_1.initDB)()
    .then(() => {
    server = app.listen(PORT, () => {
        console.log(`🚀 LLMChat后端服务启动成功`);
        console.log(`📡 服务地址: http://localhost:${PORT}`);
        console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
        console.log(`⏰ 启动时间: ${new Date().toLocaleString()}`);
    });
})
    .catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
});
process.on('SIGTERM', () => {
    console.log('收到SIGTERM信号，开始优雅关闭...');
    server?.close(async () => {
        await (0, db_1.closeDB)().catch(() => void 0);
        console.log('服务器已关闭');
        process.exit(0);
    });
});
process.on('SIGINT', () => {
    console.log('收到SIGINT信号，开始优雅关闭...');
    server?.close(async () => {
        await (0, db_1.closeDB)().catch(() => void 0);
        console.log('服务器已关闭');
        process.exit(0);
    });
});
exports.default = app;
//# sourceMappingURL=index.js.map