import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';

import { agentRoutes } from '@/routes/agents';
import { chatRoutes } from '@/routes/chat';
import { authRoutes } from '@/routes/auth';
import { adminRoutes } from '@/routes/admin';
import { productPreviewRoutes } from '@/routes/productPreview';
import { errorHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { rateLimiter } from '@/middleware/rateLimiter';

import { initDB, closeDB } from '@/utils/db';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 基础中间件
app.use(helmet({
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

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// 禁用对 SSE/流式接口的压缩，避免缓冲影响实时性
app.use(compression({
  filter: (req, res) => {
    const accept = req.headers['accept'];
    if (typeof accept === 'string' && accept.includes('text/event-stream')) {
      return false; // 不压缩 SSE
    }
    // 显式禁用对流式聊天接口的压缩
    if (req.path && req.path.startsWith('/api/chat/completions')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态资源：附件上传目录
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// 请求日志
app.use(requestLogger);

// 速率限制
app.use('/api', rateLimiter);

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// API路由
app.use('/api/agents', agentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/product-preview', productPreviewRoutes);

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `端点 ${req.originalUrl} 不存在`,
    timestamp: new Date().toISOString(),
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器（先初始化数据库）
let server: import('http').Server;
initDB()
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

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，开始优雅关闭...');
  server?.close(async () => {
    await closeDB().catch(() => void 0);
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，开始优雅关闭...');
  server?.close(async () => {
    await closeDB().catch(() => void 0);
    console.log('服务器已关闭');
    process.exit(0);
  });
});

export default app;